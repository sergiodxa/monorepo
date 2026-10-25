/**
 * The API's OpenAPI document, served as JSON or, for `?format=yaml`, YAML. It is built from
 * the operations in `routes/api.ts`, so it describes exactly what the handlers parse.
 */

import { openapiHandler } from "@sdxc/openapi/router";
import { createAction } from "remix/router";

import api from "~/app/http/middleware/api";
import { createApiDocument } from "~/app/initializers/openapi";
import routes from "~/routes/api";

/**
 * Builds the document on the first request and serves that build, with its `ETag`, to every
 * later one for the life of the Worker.
 */
const serveDocument = openapiHandler(() => createApiDocument().build());

export default createAction(routes.api.openapi, {
	middleware: api,
	/** GET /api/openapi.json, as JSON or YAML by `Accept` or `?format=`. */
	handler: (ctx) => serveDocument(ctx),
});
