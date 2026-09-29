Feature: Expense submission

  @story-1
  Rule: An expense is submitted with a photo of the receipt

    Scenario: Dana submits an expense from a receipt photo
      Given Dana the employee has a photo of a receipt from "Acme Hardware"
      When Dana submits an expense using that photo
      Then the expense appears in Dana's expenses with status "pending"

  @story-2
  Rule: The vendor, date, amount and category are filled in automatically from the photo

    Scenario: The receipt's details are pre-filled
      Given Dana the employee has uploaded a photo of a receipt from "Acme Hardware" dated "2026-09-12" for "84.50"
      When Dana reaches the review step for that receipt
      Then the vendor, date, amount and category fields already show "Acme Hardware", "2026-09-12", "84.50" and a category

  @story-3
  Rule: The employee can review and correct the auto-filled fields before final submission

    Scenario: Dana corrects a misread amount before submitting
      Given Dana the employee is reviewing an expense with an auto-filled amount of "84.50"
      When Dana changes the amount to "48.50" and submits the expense
      Then the expense is recorded with an amount of "48.50"

    @negative
    Scenario: A required field left empty is not submitted
      Given Dana the employee is reviewing an expense with the vendor field cleared
      When Dana tries to submit the expense
      Then no new expense is added to Dana's expenses
