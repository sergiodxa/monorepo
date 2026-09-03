/**
 * The OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414). Serves the very
 * same document as OpenID Connect discovery, at the path plain OAuth clients look for,
 * so a client that speaks only OAuth finds the server without knowing it is also an
 * OpenID provider.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { WELL_KNOWN } from "~/app/config";
import routes from "~/routes/web";

/** GET /.well-known/oauth-authorization-server — the same metadata under RFC 8414's path. */
export default createAction(routes.wellKnown.oauthAuthorizationServer, () => ok(WELL_KNOWN));
