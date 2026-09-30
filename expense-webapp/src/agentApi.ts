// The receipt-extraction-agent has no OpenAPI contract — a fixed chat contract
// instead (specs/design/components/receipt-extraction-agent/agent.afm.md).
// It is an EXTRA sibling (expense-api is the primary dependency), so it is
// reached at /api/receipt-extraction-agent/, same-origin, through the same
// bearer + 401 rule as any other sibling (react-webapp, thunder-authentication).
import { apiJson } from "./authz/client";

// agent.afm.md's `attachments` block, compiled in as constants.
export const RECEIPT_ATTACHMENT_TYPES = ["image/jpeg", "image/png"] as const;
export const RECEIPT_MAX_FILES = 1;
export const RECEIPT_MAX_FILE_SIZE_MB = 10;

export interface ChatAttachment {
  name: string;
  mediaType: string;
  data: string; // base64
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  attachments?: ChatAttachment[];
}

export interface ChatResponse {
  conversationId: string;
  text: string;
  toolCalls: unknown[];
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** One turn: send the receipt photo, no prior conversation to carry. */
export async function extractReceiptFields(photo: File): Promise<ChatResponse> {
  const data = await fileToBase64(photo);
  const body: ChatRequest = {
    message: "",
    attachments: [{ name: photo.name, mediaType: photo.type, data }],
  };
  return apiJson<ChatResponse>("/receipt-extraction-agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
