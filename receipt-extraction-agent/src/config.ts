// Env, read once, in one place. Every other module reads through this file —
// never a scattered getenv per call site.

export interface Attachments {
  types: string[];
  maxFiles: number;
  maxFileSizeMB: number;
}

// From x-aep.attachments in agent.afm.md's front matter.
export const ATTACHMENTS: Attachments = {
  types: ["image/jpeg", "image/png"],
  maxFiles: 1,
  maxFileSizeMB: 10,
};

export interface Config {
  port: number;

  // Model access — required, no fallback (see agent-building/references/building.md, "Model access").
  modelEndpoint?: string;
  modelName?: string;
  modelApiKey?: string;
  modelApiFormat?: string;
  modelApiAuthScheme?: string;
  modelApiKeyHeader?: string;

  // memory-db (postgres-cnpg) — optional; absence means the in-memory backing.
  memoryDbHost?: string;
  memoryDbPort?: string;
  memoryDbName?: string;
  memoryDbUser?: string;
  memoryDbPassword?: string;

  // Tracing — optional.
  otelEndpoint?: string;
  otelApiKey?: string;
  otelServiceName?: string;
}

export const config: Config = {
  port: Number(process.env.PORT ?? 9090),

  modelEndpoint: process.env.MODEL_ENDPOINT,
  modelName: process.env.MODEL_NAME,
  modelApiKey: process.env.MODEL_API_KEY,
  modelApiFormat: process.env.MODEL_API_FORMAT,
  modelApiAuthScheme: process.env.MODEL_API_AUTH_SCHEME,
  modelApiKeyHeader: process.env.MODEL_API_KEY_HEADER,

  memoryDbHost: process.env.MEMORY_DB_HOST,
  memoryDbPort: process.env.MEMORY_DB_PORT,
  memoryDbName: process.env.MEMORY_DB_DBNAME,
  memoryDbUser: process.env.MEMORY_DB_USER,
  memoryDbPassword: process.env.MEMORY_DB_PASSWORD,

  otelEndpoint: process.env.AMP_OTEL_ENDPOINT,
  otelApiKey: process.env.AMP_AGENT_API_KEY,
  otelServiceName: process.env.OTEL_SERVICE_NAME,
};

// The required MODEL_* variables that are unset — what /healthz's `missing` reports.
// MEMORY_DB_* is never listed here: an agent run without it is correctly
// configured for the in-memory conversation store, not broken.
export function missingRequiredEnv(): string[] {
  const missing: string[] = [];
  if (!config.modelEndpoint) missing.push("MODEL_ENDPOINT");
  if (!config.modelName) missing.push("MODEL_NAME");
  if (!config.modelApiKey) missing.push("MODEL_API_KEY");
  if (!config.modelApiFormat) missing.push("MODEL_API_FORMAT");
  return missing;
}
