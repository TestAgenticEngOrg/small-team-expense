import "./tracing.js"; // side effects only; imported before anything creates a model client
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import { config, ATTACHMENTS, missingRequiredEnv } from "./config.js";
import { tracer } from "./tracing.js";
import { runTurn, callContext } from "./agent.js";
import {
  initStore, ensureStore, isStoreReady, loadConversation, saveConversation,
} from "./store.js";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

// Read at most BODY_CAP (24 MiB — 15 MiB of files is 20 MiB of base64, plus
// framing). Past it, answer 413 ONCE and keep reading without keeping
// anything, so the client finishes sending and actually sees the 413 —
// destroying the request or closing the socket mid-upload resets the
// connection and the caller gets a network error instead. Past twice the
// cap, stop draining and drop it. Resolves null when the request was refused.
const BODY_CAP = 24 * 1024 * 1024;

function readBody(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    const refuse = () => { over = true; chunks.length = 0; sendJson(res, 413, { error: "request too large" }); };
    if (Number(req.headers["content-length"] ?? 0) > BODY_CAP) refuse();
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2 * BODY_CAP) { req.destroy(); return; }
      if (over) return;
      if (size > BODY_CAP) { refuse(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(over ? null : Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
    req.on("close", () => { if (!req.complete) resolve(null); });
  });
}

interface Attachment { name: string; mediaType: string; data: string }

// The whole request vocabulary. A field outside it is refused, so a caller
// speaking a newer contract than this agent was built for hears so, instead
// of having the field silently ignored.
const BODY_FIELDS = new Set(["conversationId", "message", "attachments"]);

function validate(body: any): { conversationId?: string; message: string; attachments: Attachment[] } | { error: string } {
  const unknown = Object.keys(body ?? {}).find((key) => !BODY_FIELDS.has(key));
  if (unknown) return { error: `unknown field: ${unknown}` };
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : undefined;
  const message = typeof body?.message === "string" ? body.message.trim() : null;
  const attachments: Attachment[] = Array.isArray(body?.attachments) ? body.attachments : [];
  if (message === null) return { error: "expected { message: string }" };
  if (attachments.length > 0 && !ATTACHMENTS) return { error: "this agent does not accept attachments" };
  if (message === "" && attachments.length === 0) return { error: "expected a message or attachments" };
  if (ATTACHMENTS && attachments.length > ATTACHMENTS.maxFiles) return { error: `at most ${ATTACHMENTS.maxFiles} files per message` };
  let total = 0;
  for (const a of attachments) {
    if (typeof a?.name !== "string" || typeof a?.mediaType !== "string" || typeof a?.data !== "string") return { error: "each attachment needs name, mediaType and data" };
    if (!ATTACHMENTS!.types.includes(a.mediaType)) return { error: `${a.name}: this agent does not accept ${a.mediaType}` };
    const bytes = Buffer.byteLength(a.data, "base64");
    if (bytes > ATTACHMENTS!.maxFileSizeMB * 1024 * 1024) return { error: `${a.name}: larger than ${ATTACHMENTS!.maxFileSizeMB} MB` };
    total += bytes;
  }
  if (total > 15 * 1024 * 1024) return { error: "the files together are over 15 MB" };
  return { conversationId, message, attachments };
}

// Reads the AI SDK's APICallError body; returns null for anything else.
function guardrailBlock(err: unknown): { name: string; reason: string } | null {
  const body = (err as { responseBody?: string; data?: unknown })?.responseBody;
  if (!body) return null;
  try {
    const m = JSON.parse(body)?.message;
    if (m?.action !== "GUARDRAIL_INTERVENED") return null;
    return { name: m.interveningGuardrail ?? "guardrail", reason: m.actionReason ?? "refused by policy" };
  } catch { return null; }
}

async function handleChat(req: IncomingMessage, res: ServerResponse, userId: string): Promise<void> {
  const raw = await readBody(req, res);
  if (raw === null) return; // readBody already answered 413 or the socket died

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { error: "expected { message: string }" });
  }

  const v = validate(parsed);
  if ("error" in v) return sendJson(res, 400, { error: v.error });
  const { conversationId, message, attachments } = v;

  await ensureStore(); // may throw -> caught below, 500

  let id: string;
  let history: ModelMessage[];
  if (conversationId !== undefined) {
    const loaded = await loadConversation(conversationId, userId);
    if (loaded === null) return sendJson(res, 404, { error: "conversation not found" });
    id = conversationId;
    history = loaded;
  } else {
    id = randomUUID();
    history = [];
  }

  type UserPart =
    | { type: "text"; text: string }
    | { type: "file"; data: string; mediaType: string; filename: string };

  const userParts: UserPart[] = [
    ...(message ? [{ type: "text" as const, text: message }] : []),
    ...attachments.map((a) => ({ type: "file" as const, data: a.data, mediaType: a.mediaType, filename: a.name })),
  ];
  const user: ModelMessage = { role: "user", content: userParts };
  const full = [...history, user];

  const model = config.modelName;
  const system = config.modelApiFormat === "openai-compatible" ? "openai" : "anthropic";

  let turn: Awaited<ReturnType<typeof runTurn>>;
  try {
    turn = await tracer.startActiveSpan(`chat ${model}`, async (span) => {
      try {
        const t = await runTurn(full);
        span.setAttributes({
          "gen_ai.system": system,
          "gen_ai.request.model": model ?? "unknown",
          "gen_ai.usage.input_tokens": t.usage.inputTokens ?? 0,
          "gen_ai.usage.output_tokens": t.usage.outputTokens ?? 0,
        });
        return t;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: 2 }); // ERROR
        throw err;
      } finally {
        span.end();
      }
    });
  } catch (err) {
    const g = guardrailBlock(err);
    if (g) return sendJson(res, 422, { error: g.reason, guardrail: g.name });
    const status = (err as { statusCode?: number })?.statusCode;
    if (attachments.length > 0 && (status === 400 || status === 413 || status === 415)) {
      console.error("model rejected attached files:", attachments.map((a) => `${a.name} (${a.mediaType})`), err);
      return sendJson(res, 422, { error: "the model could not read the attached file(s)", files: attachments.map((a) => a.name) });
    }
    console.error("chat turn failed:", err);
    return sendJson(res, 500, { error: "internal error" });
  }

  // Store text, not files — each file part becomes a note naming it.
  const storedParts: UserPart[] = userParts.map((p) =>
    p.type === "file" ? { type: "text", text: `[attached: ${p.filename} (${p.mediaType})]` } : p,
  );
  const stored: ModelMessage = { role: "user", content: storedParts };
  await saveConversation(id, userId, [...history, stored, ...turn.steps.flatMap((s) => s.response.messages)]);

  sendJson(res, 200, { conversationId: id, text: turn.text, toolCalls: turn.toolCalls });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? "/";

  if (req.method === "GET" && url === "/healthz") {
    const missing = missingRequiredEnv();
    const store = isStoreReady() ? "ready" : "initialising";
    if (missing.length > 0 || store !== "ready") {
      return sendJson(res, 503, { ok: false, missing, store });
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url === "/chat") {
    // Reject callers the gateway did not vouch for. A header Node saw TWICE
    // arrives as string[] — accepting it would key rows by a joined
    // "victim, attacker" value, so a non-string is refused rather than coerced.
    const userId = req.headers["x-user-id"];
    if (typeof userId !== "string" || userId === "") {
      res.statusCode = 401;
      res.end();
      return;
    }
    await callContext.run({ authorization: req.headers.authorization }, () => handleChat(req, res, userId));
    return;
  }

  res.statusCode = 404;
  res.end();
}

const server = createServer();
server.on("request", (req, res) => {
  void handle(req, res).catch((err) => { // the last line of defence
    console.error("chat turn failed:", err);
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    else res.destroy(); // already streaming: cut it
  });
});

// Never await initStore() before listen(): the DB may not be reachable yet.
initStore();
server.listen(config.port);
