// THIS IS THE ONLY FILE THAT KNOWS ABOUT SCREENS (thunder-authentication).
// Each row names the ONE expense-api operation the screen exists to perform —
// never a scope handle typed here. Rail order = wireframes.dsl screen order.
//
// SubmitExpense and ReviewExpense do not themselves list anything: the receipt
// upload/extraction on SubmitExpense calls the receipt-extraction-agent, not
// expense-api, and ReviewExpense is where the corrected fields are actually
// POSTed. Both are gated on the one expense-api operation their flow writes to
// — POST /me/expenses (expenses:submit) — so an Employee who lacks that scope
// never reaches either half of the upload flow.
//
// ExpenseReviewDetail has no per-item team-expense endpoint in expense-api's
// contract (only GET /me/team/expenses, a list) — it re-issues that same list
// call and finds the row by id, so it is gated on the same operation as
// ManagerQueue: GET /me/team/expenses (expenses:review-team). Its Approve and
// Reject buttons are each separately wrapped in <Can op="POST …/approve">
// resp. <Can op="POST …/reject">.

import { canCall } from "./core";
import { OPERATIONS, isOperationKey, type OperationKey } from "./operations.gen";

export interface ScreenRoute {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly loads: OperationKey | null;
  readonly public?: boolean;
}

export const SCREEN_ROUTES: readonly ScreenRoute[] = [
  { key: "myexpenses", label: "My Expenses", path: "/expenses", loads: "GET /me/expenses" },
  { key: "submitexpense", label: "Submit Expense", path: "/expenses/new", loads: "POST /me/expenses" },
  {
    key: "reviewexpense",
    label: "Review Expense",
    path: "/expenses/new/review",
    loads: "POST /me/expenses",
  },
  { key: "managerqueue", label: "Approvals", path: "/approvals", loads: "GET /me/team/expenses" },
  {
    key: "expensereviewdetail",
    label: "Expense Detail",
    path: "/approvals/:expenseId",
    loads: "GET /me/team/expenses",
  },
];

// FAIL LOUDLY at module load — a stale table type-checks green against a
// contract nobody regenerated from.
for (const screen of SCREEN_ROUTES) {
  if (screen.loads !== null && !isOperationKey(screen.loads)) {
    throw new Error(
      `src/authz/screens.ts: screen "${screen.label}" loads "${screen.loads}", which ` +
        `no contract declares. Re-run \`npm run gen\`, or name the operation the ` +
        `way openapi.yaml spells it.`,
    );
  }
}

export function reachableScreens(
  scopes: ReadonlySet<string>,
  signedIn: boolean,
): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((screen) => {
    if (screen.public) return true;
    if (screen.loads === null) return signedIn;
    return canCall(OPERATIONS[screen.loads], scopes, signedIn);
  });
}

export function hasScopedReach(scopes: ReadonlySet<string>, signedIn: boolean): boolean {
  return reachableScreens(scopes, signedIn).some(
    (screen) => !screen.public && screen.loads !== null,
  );
}
