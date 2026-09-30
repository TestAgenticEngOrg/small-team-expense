import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Chip,
  ListingTable,
  PageContent,
  PageTitle,
} from "@wso2/oxygen-ui";
import { Plus } from "@wso2/oxygen-ui-icons-react";
import { expenseApi } from "../api";
import type { components } from "../generated/expense-api";
import { Can } from "../authz/gates";

type Expense = components["schemas"]["Expense"];

const STATUS_COLOR: Record<Expense["status"], "warning" | "success" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

function statusLabel(status: Expense["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function MyExpensesPage(): ReactElement {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    expenseApi
      .GET("/me/expenses", { params: { query: {} } })
      .then(({ data, error: apiError }) => {
        if (!live) return;
        if (apiError) {
          setError("Could not load your expenses.");
          return;
        }
        setExpenses(data?.data ?? []);
      })
      .catch(() => live && setError("Could not load your expenses."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>My Expenses</PageTitle.Header>
        <PageTitle.Actions>
          <Can op="POST /me/expenses">
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={() => navigate("/expenses/new")}
            >
              New Expense
            </Button>
          </Can>
        </PageTitle.Actions>
      </PageTitle>

      <ListingTable.Container>
        <ListingTable>
          <ListingTable.Head>
            <ListingTable.Row>
              <ListingTable.Cell>Vendor</ListingTable.Cell>
              <ListingTable.Cell>Date</ListingTable.Cell>
              <ListingTable.Cell>Amount</ListingTable.Cell>
              <ListingTable.Cell>Category</ListingTable.Cell>
              <ListingTable.Cell>Status</ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {error ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={5}>{error}</ListingTable.Cell>
              </ListingTable.Row>
            ) : expenses === null ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={5}>Loading…</ListingTable.Cell>
              </ListingTable.Row>
            ) : expenses.length === 0 ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={5}>
                  <ListingTable.EmptyState
                    title="No expenses yet"
                    description="Submit your first expense with a receipt photo."
                  />
                </ListingTable.Cell>
              </ListingTable.Row>
            ) : (
              expenses.map((expense) => (
                <ListingTable.Row key={expense.id}>
                  <ListingTable.Cell>{expense.vendor}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.expenseDate}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.amount.toFixed(2)}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.category}</ListingTable.Cell>
                  <ListingTable.Cell>
                    <Chip
                      label={statusLabel(expense.status)}
                      color={STATUS_COLOR[expense.status]}
                      size="small"
                    />
                  </ListingTable.Cell>
                </ListingTable.Row>
              ))
            )}
          </ListingTable.Body>
        </ListingTable>
      </ListingTable.Container>
    </PageContent>
  );
}
