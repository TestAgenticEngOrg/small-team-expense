# Submit an expense

An Employee photographs a receipt, the agent reads it, and the employee
reviews and confirms the extracted details before the expense is submitted
for their manager's decision.

```mermaid
sequenceDiagram
    actor Employee
    participant expense-webapp
    participant receipt-extraction-agent
    participant expense-api

    Employee->>expense-webapp: upload receipt photo
    expense-webapp->>receipt-extraction-agent: extract fields from photo
    receipt-extraction-agent-->>expense-webapp: vendor, date, amount, category
    Employee->>expense-webapp: review and correct fields
    expense-webapp->>expense-api: submit expense
    alt required field missing
        expense-api-->>expense-webapp: refused
    else
        expense-api-->>expense-webapp: created (pending)
    end
```

