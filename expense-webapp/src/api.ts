import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/expense-api";
import { authorizationHeader, classifyResponse, ForbiddenError } from "./authz/client";

// Same-origin: nginx (or MSW in mock mode) proxies /api to expense-api, the
// primary component-kind dependency. OpenAPI paths stay exactly as designed
// (/me/expenses, /categories) — the proxy strips /api before forwarding.
export const expenseApi = createClient<paths>({ baseUrl: "/api" });

// Authorization is entirely thunder-authentication's: attach the bearer, and
// apply the 401 rule. No scope check, no WWW-Authenticate read, added here.
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const header = await authorizationHeader();
    if (header) request.headers.set("Authorization", header);
    return request;
  },
  async onResponse({ response }) {
    if ((await classifyResponse(response.status)) === "forbidden") {
      throw new ForbiddenError(response.status);
    }
    return response;
  },
};

expenseApi.use(authMiddleware);
