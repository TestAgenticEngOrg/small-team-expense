// GENERATED from specs/design/components/receipt-extraction-agent/agent.afm.md
// `x-aep.tools.openapi` (front matter key `tools.openapi`) is `[]` — this
// agent has no component dependency and no allow-listed operation, so there
// is nothing to generate a tool from. It reads the caller's photo and its own
// conversation history only; it calls no other service.
//
// The allow-list is the security boundary: never add a tool here because it
// "would be useful" — an empty allow-list means an empty tool set, full stop.

import type { ToolSet } from "ai";

export const tools: ToolSet = {};
