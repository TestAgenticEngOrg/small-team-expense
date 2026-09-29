screen MyExpenses "An employee's own submitted expenses and their status"
  navbar "Expense App"
  sidebar "My Expenses -> MyExpenses | Submit Expense -> SubmitExpense"
  row
    heading "My Expenses"
    right
    button "New Expense" primary -> SubmitExpense
  table "Vendor | Date | Amount | Category | Status"
    row "Acme Hardware | 2026-09-12 | 84.50 | Office Supplies | Pending"
    row "Riverside Kitchen | 2026-09-10 | 32.00 | Meals | Approved"
    row "Cloudline Rail | 2026-09-02 | 210.00 | Travel | Rejected"

screen SubmitExpense "Upload a photo of a receipt to start a new expense"
  navbar "Expense App"
  sidebar "My Expenses -> MyExpenses | Submit Expense -> SubmitExpense"
  heading "Submit Expense"
  card "Receipt Photo"
    image "Tap to upload a photo"
  button "Extract Details" primary -> ReviewExpense

screen ReviewExpense "Review and correct the fields the agent read off the receipt"
  navbar "Expense App"
  sidebar "My Expenses -> MyExpenses | Submit Expense -> SubmitExpense"
  heading "Review Expense"
  image "Receipt photo"
  input "Vendor"
  input "Date"
  input "Amount"
  select "Category"
  row
    right
    button "Cancel" -> MyExpenses
    button "Submit Expense" primary -> MyExpenses

screen ManagerQueue "Expenses awaiting this manager's decision"
  navbar "Expense App"
  sidebar "Approvals -> ManagerQueue | My Expenses -> MyExpenses"
  heading "Approvals"
  table "Employee | Vendor | Date | Amount | Category | Status" -> ExpenseReviewDetail
    row "Dana Reyes | Acme Hardware | 2026-09-12 | 84.50 | Office Supplies | Pending"
    row "Tom Ellis | Riverside Kitchen | 2026-09-11 | 46.00 | Meals | Pending"

screen ExpenseReviewDetail "One report's submitted expense, ready for a decision"
  navbar "Expense App"
  sidebar "Approvals -> ManagerQueue | My Expenses -> MyExpenses"
  heading "Expense Detail"
  text "Dana Reyes | Acme Hardware | 2026-09-12 | 84.50 | Office Supplies"
  image "Receipt photo"
  textarea "Comment (optional)"
  row
    right
    button "Reject" danger -> ManagerQueue
    button "Approve" primary -> ManagerQueue

flow "Submit an expense"
  role "Employee"
  description "An employee submits a receipt-photo expense and tracks its status"
  MyExpenses
  SubmitExpense
  ReviewExpense

flow "Review team expenses"
  role "Manager"
  description "A manager reviews and decides the expenses awaiting their approval"
  ManagerQueue
  ExpenseReviewDetail
