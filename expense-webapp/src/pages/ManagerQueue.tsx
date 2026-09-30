import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { ListingTable, PageContent, PageTitle } from "@wso2/oxygen-ui";
import { expenseApi } from "../api";
import type { components } from "../generated/expense-api";

type Expense = components["schemas"]["Expense"];

export function ManagerQueuePage(): ReactElement {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    expenseApi
      .GET("/me/team/expenses", { params: { query: { status: "pending" } } })
      .then(({ data, error: apiError }) => {
        if (!live) return;
        if (apiError) {
          setError("Could not load your team's expenses.");
          return;
        }
        setExpenses(data?.data ?? []);
      })
      .catch(() => live && setError("Could not load your team's expenses."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Approvals</PageTitle.Header>
      </PageTitle>

      <ListingTable.Container>
        <ListingTable>
          <ListingTable.Head>
            <ListingTable.Row>
              {/* expense-api's Expense schema carries only employeeId, no
                  display name — no directory endpoint exists in its contract
                  to resolve one, so the id is the visible label. Design gap:
                  see the run report. */}
              <ListingTable.Cell>Employee</ListingTable.Cell>
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
                <ListingTable.Cell colSpan={6}>{error}</ListingTable.Cell>
              </ListingTable.Row>
            ) : expenses === null ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={6}>Loading…</ListingTable.Cell>
              </ListingTable.Row>
            ) : expenses.length === 0 ? (
              <ListingTable.Row>
                <ListingTable.Cell colSpan={6}>
                  <ListingTable.EmptyState
                    title="Nothing awaiting your decision"
                    description="Your reports' pending expenses will show up here."
                  />
                </ListingTable.Cell>
              </ListingTable.Row>
            ) : (
              expenses.map((expense) => (
                <ListingTable.Row
                  key={expense.id}
                  clickable
                  onClick={() => navigate(`/approvals/${expense.id}`)}
                >
                  <ListingTable.Cell>{expense.employeeId}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.vendor}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.expenseDate}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.amount.toFixed(2)}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.category}</ListingTable.Cell>
                  <ListingTable.Cell>{expense.status}</ListingTable.Cell>
                </ListingTable.Row>
              ))
            )}
          </ListingTable.Body>
        </ListingTable>
      </ListingTable.Container>
    </PageContent>
  );
}
