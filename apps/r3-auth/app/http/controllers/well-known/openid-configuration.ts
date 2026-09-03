/**
 * The OpenID Connect Discovery 1.0 endpoint. Publishes the server's metadata document
 * — endpoints, scopes, response types, signing algorithms — so a relying party can
 * configure itself from a single URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { WELL_KNOWN } from "~/app/config";
import routes from "~/routes/web";

/** GET /.well-known/openid-configuration — the discovery document. */
export default createAction(routes.wellKnown.openidConfiguration, () => ok(WELL_KNOWN));
