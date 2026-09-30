# small-team-expense — PRD

## Problem Statement

Small teams handle expense reimbursement with manual data entry: an employee
has to type the vendor, date, amount and category off a paper or photographed
receipt, which is slow and error-prone, and a manager has no simple way to
review and approve or reject what was submitted. Today's workaround is email,
spreadsheets, or a receipt shoebox, none of which gives either side a clear
record of what was submitted or decided.

## Solution

A small-team expense app where an employee submits an expense by photographing
the receipt; an agent reads the photo and fills in the vendor, date, amount
and category so the employee only has to check and confirm them. A manager
sees pending expenses and approves or rejects each one, and the employee can
see the outcome.

## Actors

- **Employee** — submits expenses with a receipt photo, reviews and corrects
the auto-filled details before submitting, and sees the status of their own
submitted expenses.
- **Manager** — sees expenses awaiting their approval and approves or rejects
each one with an optional comment. A manager can also submit their own
expenses as an employee — the two roles overlap on the same person.

## User Stories

1. As an Employee, I want to submit an expense with a photo of the receipt, so
that I don't have to type the details myself.
2. As an Employee, I want the app to automatically fill in the vendor, date,
amount and category from the receipt photo, so that I save time and avoid
transcription mistakes.
3. As an Employee, I want to review and correct the auto-filled fields before
final submission, so that a misread receipt doesn't go through wrong.
4. As an Employee, I want to see the status of each expense I've submitted
(pending, approved, rejected), so that I know where it stands.
5. As an Employee, I want to be notified when one of my expenses is approved
or rejected, so that I know the outcome without checking manually.
6. As a Manager, I want to see a list of expenses awaiting my approval, so
that I can review them.
7. As a Manager, I want to approve or reject an expense, so that spending is
controlled.
8. As a Manager, I want to add an optional comment when I approve or reject
an expense, so that the employee has context for my decision.

## Product Decisions

- Sign-in is SSO through Thunder, the platform IDP (organization default).
- Vendor, date, amount and category are extracted from the receipt photo by
an agent; the employee reviews and can correct any field before submitting.
- Each employee has exactly one manager who reviews their expenses.
- An expense category is chosen from a fixed list (e.g. Travel, Meals,
Lodging, Office Supplies, Software, Other) rather than free text.
- A single currency is used across the app; no multi-currency conversion.
- A manager's comment is always optional, on either an approval or a
rejection.
- Notification of an approval/rejection outcome is in-app only (no email or
push).

## Out of Scope

- Reimbursement or payout tracking once an expense is approved.
- Exporting expenses to accounting or payroll systems.
- Multi-level or delegated approval chains (a second approver, escalation).
- Editing or resubmitting an expense after a manager has decided on it.
- Multi-currency support.

## Open Questions

*(none — all decisions needed to write this PRD were either given or assumed above)*

## Further Notes

*(none)*