/**
 * Serves the management API's OpenAPI document at `/openapi.json`, built from the same
 * operation definitions the routes validate against, so the published contract and the
 * served API describe one surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { openapiHandler } from "@sdxc/openapi/router";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { buildManagementDocument } from "~/app/http/openapi/document";
import routes from "~/routes/management";

/** Builds the document under the management API's own origin, its issuer. */
let handler = openapiHandler(() =>
	buildManagementDocument(`https://api.${env.PLATFORM_DOMAIN}`).build(),
);

/**
 * The management API's OpenAPI document.
 *
 * @example
 * router.map(routes.openapi, openapi);
 */
export default createAction(routes.openapi, (ctx) => handler(ctx));
