// Imported for side effects from the top of main.ts, before anything creates
// a model client. Inert when the platform sets no AMP_OTEL_ENDPOINT — the
// decision to export or not is made here, at runtime, never by omitting this
// file (see agent-building/references/building.md, "Tracing").
import { trace } from "@opentelemetry/api";
import { NodeTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { config } from "./config.js";

export const tracer = trace.getTracer("agent");

if (config.otelEndpoint && config.otelApiKey) {
  const provider = new NodeTracerProvider({
    // SET THIS OR THE TRACES ARE ANONYMOUS.
    resource: new Resource({
      "service.name": config.otelServiceName ?? "receipt-extraction-agent",
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${config.otelEndpoint}/v1/traces`,
          headers: { "x-amp-api-key": config.otelApiKey },
        }),
      ),
    ],
  });
  provider.register();
  // Without this the last spans of a turn die with the pod.
  process.on("SIGTERM", () => {
    void provider.shutdown().finally(() => process.exit(0));
  });
}
