/**
 * Serves the API's OpenAPI 3.1 document at `/api/v1/openapi.json`, as JSON or, for
 * `?format=yaml` or an `Accept` preferring it, YAML. The document is built on the first
 * request and reused, keeping its assembly out of the Worker's global scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { openapiHandler } from "@sdxc/openapi/router";
import { createAction } from "remix/router";

import { buildApiDocument } from "~/app/http/openapi/document";
import routes from "~/routes/web";

/** GET /api/v1/openapi.json — public, cacheable for five minutes, with an ETag. */
export default createAction(
	routes.api.v1.openapi,
	openapiHandler(() => buildApiDocument().build()),
);
