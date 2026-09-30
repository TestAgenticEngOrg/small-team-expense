// Typed read of window._env_, the platform's runtime config. Declares only the
// keys this app actually has: the `user-auth` OIDC keys (thunder-authentication)
// — CLIENT_ID, ISSUER, SCOPES, RESOURCE, never JWKS_URL, which the browser never
// validates. No sibling API address is a browser key: expense-api and
// receipt-extraction-agent are both reached same-origin, through /api.
type Env = {
  USER_AUTH_CLIENT_ID: string;
  USER_AUTH_ISSUER: string;
  USER_AUTH_SCOPES: string;
  USER_AUTH_RESOURCE: string;
};

declare global {
  interface Window {
    _env_: Env;
  }
}

if (!window._env_) {
  throw new Error(
    "window._env_ not set — /env-config.js failed to load. " +
      "The platform mounts this file; if you see this locally, host " +
      "/env-config.js from your dev server.",
  );
}

export const env: Env = window._env_;
