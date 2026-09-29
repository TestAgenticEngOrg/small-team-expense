import { useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Card, CardContent, CardHeader, Stack, Typography } from "@wso2/oxygen-ui";
import { Upload } from "@wso2/oxygen-ui-icons-react";
import {
  RECEIPT_ATTACHMENT_TYPES,
  RECEIPT_MAX_FILE_SIZE_MB,
  extractReceiptFields,
} from "../agentApi";
import { parseExtractedFields } from "../receiptFields";

export function SubmitExpensePage(): ReactElement {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  function onPick(files: FileList | null) {
    setFileError(null);
    const file = files?.[0];
    if (!file) return;
    if (!RECEIPT_ATTACHMENT_TYPES.includes(file.type as (typeof RECEIPT_ATTACHMENT_TYPES)[number])) {
      setFileError(`"${file.name}" is not a photo (JPEG or PNG).`);
      return;
    }
    if (file.size > RECEIPT_MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`"${file.name}" is larger than ${RECEIPT_MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onExtract() {
    if (!photo) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const response = await extractReceiptFields(photo);
      const extracted = parseExtractedFields(response.text);
      navigate("/expenses/new/review", {
        state: { photo, previewUrl, extracted },
      });
    } catch {
      setExtractError(
        "Could not read the receipt. Keep the photo and try again, or enter the details yourself.",
      );
    } finally {
      setExtracting(false);
    }
  }

  function proceedWithoutExtraction() {
    if (!photo) return;
    navigate("/expenses/new/review", {
      state: { photo, previewUrl, extracted: null },
    });
  }

  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Submit Expense
      </Typography>

      <Card>
        <CardHeader title="Receipt Photo" />
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept={RECEIPT_ATTACHMENT_TYPES.join(",")}
            hidden
            onChange={(e) => onPick(e.target.files)}
          />
          <Box
            onClick={() => inputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 1,
              p: 4,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: "background.default",
            }}
          >
            {previewUrl ? (
              <Box
                component="img"
                src={previewUrl}
                alt="Receipt preview"
                sx={{ maxWidth: "100%", maxHeight: 320, borderRadius: 1 }}
              />
            ) : (
              <Stack spacing={1} alignItems="center">
                <Upload size={32} />
                <Typography color="text.secondary">Tap to upload a photo</Typography>
              </Stack>
            )}
          </Box>
          {fileError ? (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {fileError}
            </Typography>
          ) : null}
          {extractError ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography color="error" variant="body2">
                {extractError}
              </Typography>
              <Button variant="outlined" onClick={proceedWithoutExtraction}>
                Enter details myself
              </Button>
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button
          variant="contained"
          disabled={!photo || extracting}
          onClick={() => void onExtract()}
        >
          {extracting ? "Extracting…" : "Extract Details"}
        </Button>
      </Stack>
    </Box>
  );
}
