import { useEffect, useState, type ReactElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { expenseApi } from "../api";
import type { components } from "../generated/expense-api";
import { Can } from "../authz/gates";

type Expense = components["schemas"]["Expense"];

export function ExpenseReviewDetailPage(): ReactElement {
  const { expenseId } = useParams<{ expenseId: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // expense-api's contract has no per-item team-expense endpoint — only the
    // list (GET /me/team/expenses). Re-issue that same operation and find the
    // row by id, rather than inventing an endpoint the contract does not
    // declare.
    expenseApi.GET("/me/team/expenses", { params: { query: {} } }).then(({ data }) => {
      if (!live) return;
      setExpense(data?.data.find((e) => e.id === expenseId) ?? null);
    });
    return () => {
      live = false;
    };
  }, [expenseId]);

  async function approve() {
    if (!expenseId) return;
    setDeciding(true);
    setError(null);
    const { error: apiError } = await expenseApi.POST(
      "/me/team/expenses/{expenseId}/approve",
      { params: { path: { expenseId } }, body: comment ? { comment } : {} },
    );
    setDeciding(false);
    if (apiError) {
      setError("Could not record the decision. It may no longer be pending.");
      return;
    }
    navigate("/approvals");
  }

  async function reject() {
    if (!expenseId) return;
    setDeciding(true);
    setError(null);
    const { error: apiError } = await expenseApi.POST(
      "/me/team/expenses/{expenseId}/reject",
      { params: { path: { expenseId } }, body: comment ? { comment } : {} },
    );
    setDeciding(false);
    if (apiError) {
      setError("Could not record the decision. It may no longer be pending.");
      return;
    }
    navigate("/approvals");
  }

  if (expense === undefined) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading…</Typography>
      </Box>
    );
  }
  if (expense === null) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>No such expense is awaiting your decision.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Expense Detail
      </Typography>
      <Typography sx={{ mb: 2 }}>
        {expense.employeeId} | {expense.vendor} | {expense.expenseDate} |{" "}
        {expense.amount.toFixed(2)} | {expense.category}
      </Typography>

      {expense.photoUrl ? (
        <Box
          component="img"
          src={expense.photoUrl}
          alt="Receipt photo"
          sx={{ maxWidth: "100%", maxHeight: 280, borderRadius: 1, mb: 3, display: "block" }}
        />
      ) : null}

      <TextField
        label="Comment (optional)"
        multiline
        minRows={3}
        fullWidth
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        sx={{ mb: 2 }}
      />

      {error ? (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      ) : null}

      <Stack direction="row" justifyContent="flex-end" spacing={2}>
        <Can op="POST /me/team/expenses/{expenseId}/reject">
          <Button
            variant="outlined"
            color="error"
            disabled={deciding}
            onClick={() => void reject()}
          >
            Reject
          </Button>
        </Can>
        <Can op="POST /me/team/expenses/{expenseId}/approve">
          <Button variant="contained" disabled={deciding} onClick={() => void approve()}>
            Approve
          </Button>
        </Can>
      </Stack>
    </Box>
  );
}
