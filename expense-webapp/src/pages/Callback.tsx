import { useEffect, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import { handleCallback } from "../authz/session";

/**
 * The one registered redirect URI, serving both the redirect and the silent
 * renew legs (thunder-authentication). `handleCallback()` dispatches; only the
 * redirect leg lands here with something to navigate away from.
 */
export function CallbackPage(): ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    void handleCallback().then(() => {
      if (live) navigate("/", { replace: true });
    });
    return () => {
      live = false;
    };
  }, [navigate]);

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h6">Signing you in…</Typography>
      </Stack>
    </Box>
  );
}
