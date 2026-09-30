// The receipt-extraction-agent replies with prose, not JSON (agent.afm.md: "reply
// with exactly these four fields, clearly labelled"). This is a best-effort,
// lenient read of that prose into the four ReviewExpense fields — the employee
// reviews and corrects every one, so a field this cannot parse is left blank
// rather than guessed.

export interface ExtractedFields {
  vendor: string;
  date: string; // ISO yyyy-mm-dd, or "" if unparseable
  amount: string; // decimal string, or "" if unparseable
  category: string;
}

const CATEGORIES = ["Travel", "Meals", "Lodging", "Office Supplies", "Software", "Other"] as const;

function fieldValue(text: string, label: string): string | null {
  const re = new RegExp(`^\\s*[*_-]{0,2}${label}[*_-]{0,2}\\s*[:\\-]\\s*(.+)$`, "im");
  const match = re.exec(text);
  if (!match) return null;
  return match[1].trim().replace(/[*_]+$/g, "").trim();
}

function toIsoDate(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function toAmount(raw: string): string {
  const match = /-?\d[\d,]*\.?\d*/.exec(raw);
  if (!match) return "";
  const cleaned = match[0].replace(/,/g, "");
  return Number.isNaN(Number(cleaned)) ? "" : cleaned;
}

function toCategory(raw: string): string {
  const found = CATEGORIES.find((c) => raw.toLowerCase().includes(c.toLowerCase()));
  return found ?? "";
}

/** Nothing here is guaranteed present — an illegible field is left blank. */
export function parseExtractedFields(text: string): ExtractedFields {
  const vendor = fieldValue(text, "vendor") ?? "";
  const dateRaw = fieldValue(text, "date") ?? "";
  const amountRaw = fieldValue(text, "amount") ?? "";
  const categoryRaw = fieldValue(text, "category") ?? "";

  return {
    vendor: /illegible|missing|unclear|unknown/i.test(vendor) ? "" : vendor,
    date: toIsoDate(dateRaw),
    amount: toAmount(amountRaw),
    category: toCategory(categoryRaw),
  };
}
