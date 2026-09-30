import { useEffect, useState, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { expenseApi } from "../api";
import type { components } from "../generated/expense-api";
import type { ExtractedFields } from "../receiptFields";

type Category = components["schemas"]["Category"];

interface ReviewLocationState {
  photo: File;
  previewUrl: string;
  extracted: ExtractedFields | null;
}

export function ReviewExpensePage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ReviewLocationState | null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendor, setVendor] = useState(state?.extracted?.vendor ?? "");
  const [date, setDate] = useState(state?.extracted?.date ?? "");
  const [amount, setAmount] = useState(state?.extracted?.amount ?? "");
  const [category, setCategory] = useState<Category | "">(
    (state?.extracted?.category as Category) || "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Public — GET /categories declares `security: []`. No auth header is
    // required, though the shared client attaches one when a session exists.
    expenseApi.GET("/categories").then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  // No receipt in memory (a direct/refreshed visit to this route) — there is
  // nothing to review, so send the employee back to start the upload again.
  useEffect(() => {
    if (!state) navigate("/expenses/new", { replace: true });
  }, [state, navigate]);

  if (!state) return <></>;

  const isValid =
    vendor.trim() !== "" &&
    date.trim() !== "" &&
    amount.toString().trim() !== "" &&
    !Number.isNaN(Number(amount)) &&
    category !== "";

  async function onSubmit() {
    if (!isValid) {
      setSubmitError("Fill in every field before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await expenseApi.POST("/me/expenses", {
      body: {
        vendor,
        expenseDate: date,
        amount: Number(amount),
        category: category as Category,
      },
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message || "Could not submit the expense.");
      return;
    }
    navigate("/expenses");
  }

  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Review Expense
      </Typography>

      <Box
        component="img"
        src={state.previewUrl}
        alt="Receipt photo"
        sx={{ maxWidth: "100%", maxHeight: 280, borderRadius: 1, mb: 3, display: "block" }}
      />

      <Stack spacing={2}>
        <TextField
          label="Vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          required
        />
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          required
        />
        <TextField
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <TextField
          select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          required
        >
          {category !== "" && !categories.includes(category) ? (
            <MenuItem value={category}>{category}</MenuItem>
          ) : null}
          {categories.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>

        {submitError ? (
          <Typography color="error" variant="body2">
            {submitError}
          </Typography>
        ) : null}

        <Stack direction="row" justifyContent="flex-end" spacing={2}>
          <Button variant="outlined" onClick={() => navigate("/expenses")}>
            Cancel
          </Button>
          <Button variant="contained" disabled={submitting} onClick={() => void onSubmit()}>
            {submitting ? "Submitting…" : "Submit Expense"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
