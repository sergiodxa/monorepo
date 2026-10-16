/**
 * The API's OpenAPI document, served as JSON or, for `?format=yaml`, YAML. It is built from
 * the operations in `routes/api.ts`, so it describes exactly what the handlers parse.
 */

import { openapiHandler } from "@sdxc/openapi/router";
import { createAction } from "remix/router";

import api from "~/app/http/middleware/api";
import { createApiDocument } from "~/app/initializers/openapi";
import routes from "~/routes/api";

export default createAction(routes.api.openapi, {
	middleware: api,
	/** GET /api/openapi.json, naming the origin the request reached as the API's server. */
	handler: (ctx) => openapiHandler(() => createApiDocument(ctx.url.origin).build())(ctx),
});
