// The keys the platform actually emits for this component — src/env.ts's
// `Env` type, and only those. No sibling API address: expense-api and
// receipt-extraction-agent are both reached same-origin, through /api.
export const mockEnv = {
  USER_AUTH_CLIENT_ID: "mock-client",
  USER_AUTH_ISSUER: "https://mock-idp.test",
  // The OIDC scopes are `group` and `ou`, singular, plus every handle the
  // project's catalog declares — exactly as the platform requests them.
  USER_AUTH_SCOPES:
    "openid profile email group ou expenses:read expenses:submit expenses:review-team expenses:approve expenses:reject",
  USER_AUTH_RESOURCE: "https://mock-idp.test/resources/mock-project",
};
