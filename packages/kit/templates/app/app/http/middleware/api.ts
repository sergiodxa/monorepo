/**
 * The middleware every API endpoint declares: CORS, so a browser on another origin can call
 * it, and the caller's access. An endpoint reads its own body, as JSON or a form, so it is left
 * unparsed here.
 */

import { access } from "@sdxc/authz/middleware/router";
import { cors } from "remix/middleware/cors";
import { createMiddleware } from "remix/router";

import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";

/**
 * Answers CORS preflights, adds the CORS headers to every endpoint's response, and binds every
 * caller, an MCP client included, as a guest with every ability loaded. Once the API
 * authenticates its callers, pass their roles and `actor` to `access` here.
 */
export default createMiddleware(cors(), access(policy, { load: [abilities] }));
