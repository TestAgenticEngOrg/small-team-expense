import { http, HttpResponse } from "msw";
import type { components } from "../src/generated/expense-api";

type Expense = components["schemas"]["Expense"];
type ExpenseCreate = components["schemas"]["ExpenseCreate"];
type ExpenseDecision = components["schemas"]["ExpenseDecision"];
type Category = components["schemas"]["Category"];

const CATEGORIES: Category[] = ["Travel", "Meals", "Lodging", "Office Supplies", "Software", "Other"];

// The caller this mock speaks for. A hardcoded id, not derived from the
// role-switcher's mock session: `mock/authz/gateway.ts` already answers "may
// this caller call this operation at all" from the token, so this file only
// has to answer "which rows are theirs" — the /me/ reach — exactly as the
// real service's path does. Seeding rows owned by somebody else (the two
// "reports") is what makes /me/ and every-row look different.
export const mockCaller = { userId: "mock-employee", username: "test-employee" };

// Two of the manager's reports, seeded with human-readable ids: expense-api's
// Expense schema carries only `employeeId`, no display name, and there is no
// directory endpoint in its contract to resolve one — so the id IS the label
// ManagerQueue shows (see the run report's design-gap note). Held in module
// scope: a create/decide persists across in-app navigation and resets on any
// full page load, same as any other mock (mock-verification).
let expenses: Expense[] = [
  {
    id: "exp-1",
    employeeId: mockCaller.userId,
    vendor: "Acme Hardware",
    expenseDate: "2026-09-12",
    amount: 84.5,
    category: "Office Supplies",
    status: "pending",
    createdAt: "2026-09-12T09:00:00Z",
  },
  {
    id: "exp-2",
    employeeId: mockCaller.userId,
    vendor: "Riverside Kitchen",
    expenseDate: "2026-09-10",
    amount: 32.0,
    category: "Meals",
    status: "approved",
    decidedBy: "mock-manager",
    decidedAt: "2026-09-11T10:00:00Z",
    createdAt: "2026-09-10T09:00:00Z",
  },
  {
    id: "exp-3",
    employeeId: mockCaller.userId,
    vendor: "Cloudline Rail",
    expenseDate: "2026-09-02",
    amount: 210.0,
    category: "Travel",
    status: "rejected",
    managerComment: "Missing an itemized receipt.",
    decidedBy: "mock-manager",
    decidedAt: "2026-09-03T09:00:00Z",
    createdAt: "2026-09-02T09:00:00Z",
  },
  {
    id: "exp-4",
    employeeId: "Dana Reyes",
    vendor: "Acme Hardware",
    expenseDate: "2026-09-12",
    amount: 84.5,
    category: "Office Supplies",
    status: "pending",
    createdAt: "2026-09-12T09:05:00Z",
  },
  {
    id: "exp-5",
    employeeId: "Tom Ellis",
    vendor: "Riverside Kitchen",
    expenseDate: "2026-09-11",
    amount: 46.0,
    category: "Meals",
    status: "pending",
    createdAt: "2026-09-11T09:05:00Z",
  },
];

let nextId = 6;

function isMine(expense: Expense): boolean {
  return expense.employeeId === mockCaller.userId;
}

function missingRequired(body: Partial<ExpenseCreate>): string | null {
  if (!body.vendor) return "vendor";
  if (!body.expenseDate) return "expenseDate";
  if (body.amount === undefined || body.amount === null) return "amount";
  if (!body.category) return "category";
  return null;
}

export const handlers = [
  // Public — no gateway row, no identity read.
  http.get("/api/categories", () => HttpResponse.json(CATEGORIES)),

  // The caller's own expenses. No `expenses:read` check here: a caller who
  // does not hold it was refused by mock/authz/gateway.ts and never reached
  // this handler.
  http.get("/api/me/expenses", ({ request }) => {
    const status = new URL(request.url).searchParams.get("status");
    const rows = expenses.filter(isMine).filter((e) => !status || e.status === status);
    return HttpResponse.json({ count: rows.length, next: null, previous: null, data: rows });
  }),

  http.post("/api/me/expenses", async ({ request }) => {
    const body = (await request.json()) as Partial<ExpenseCreate>;
    const missing = missingRequired(body);
    if (missing) {
      return HttpResponse.json(
        { code: 400, message: "A required field is missing or invalid", description: `\`${missing}\` is required` },
        { status: 400 },
      );
    }
    const created: Expense = {
      id: `exp-${nextId++}`,
      employeeId: mockCaller.userId,
      vendor: body.vendor!,
      expenseDate: body.expenseDate!,
      amount: body.amount!,
      category: body.category!,
      photoUrl: body.photoUrl,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    expenses = [...expenses, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  // Most specific first: the parameterised single-expense route must not
  // swallow a literal one — there is none here to collide with, but the rule
  // still orders every `:id` route after its literal siblings.
  http.get("/api/me/expenses/:expenseId", ({ params }) => {
    const found = expenses.find((e) => e.id === params.expenseId && isMine(e));
    if (!found) {
      return HttpResponse.json({ code: 404, message: "No such expense of the caller's" }, { status: 404 });
    }
    return HttpResponse.json(found);
  }),

  // Every row NOT the caller's own — the mock's stand-in for "the caller's
  // reports" (expense-api's contract has no directory to resolve a real
  // hierarchy against, and neither does this mock).
  http.get("/api/me/team/expenses", ({ request }) => {
    const status = new URL(request.url).searchParams.get("status");
    const rows = expenses.filter((e) => !isMine(e)).filter((e) => !status || e.status === status);
    return HttpResponse.json({ count: rows.length, next: null, previous: null, data: rows });
  }),

  http.post("/api/me/team/expenses/:expenseId/approve", async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as ExpenseDecision | null;
    return decide(params.expenseId as string, "approved", body ?? {});
  }),

  http.post("/api/me/team/expenses/:expenseId/reject", async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as ExpenseDecision | null;
    return decide(params.expenseId as string, "rejected", body ?? {});
  }),

  // receipt-extraction-agent has no openapi.yaml — a fixed chat contract
  // instead (agent.afm.md) — so it carries no row in mock/authz/gateway.ts's
  // table and nothing here re-checks a scope for it, matching how the mock
  // gateway itself has no policy for a sibling with no OpenAPI security
  // scheme. One canned extraction, labelled exactly as the agent's system
  // prompt requires, so ReviewExpense's auto-fill has something to show.
  http.post("/api/receipt-extraction-agent/chat", () =>
    HttpResponse.json({
      conversationId: "mock-conversation-1",
      text: "Vendor: Acme Hardware\nDate: 2026-09-12\nAmount: 84.50\nCategory: Office Supplies",
      toolCalls: [],
    }),
  ),
];

function decide(
  expenseId: string,
  outcome: "approved" | "rejected",
  body: ExpenseDecision,
): HttpResponse<Expense | { code: number; message: string }> {
  const index = expenses.findIndex((e) => e.id === expenseId && !isMine(e));
  if (index === -1) {
    return HttpResponse.json(
      { code: 404, message: "No such pending expense of a report's" },
      { status: 404 },
    );
  }
  const target = expenses[index];
  if (target.status !== "pending") {
    return HttpResponse.json({ code: 400, message: "The expense is not pending" }, { status: 400 });
  }
  const decided: Expense = {
    ...target,
    status: outcome,
    managerComment: body?.comment ?? null,
    decidedBy: "mock-manager",
    decidedAt: new Date().toISOString(),
  };
  expenses = [...expenses.slice(0, index), decided, ...expenses.slice(index + 1)];
  return HttpResponse.json(decided);
}
