/**
 * Serves the API's RFC 9728 protected resource metadata, the document every `401` and
 * `403` challenge from `/api/v1/*` points at. It is public: a client reads it before it
 * holds a key, to learn the scopes and where the reference is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { protectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";
import { respond } from "@sdxc/well-known/response";
import { createAction } from "remix/router";

import { apiMetadata } from "~/app/services/api-metadata";
import routes from "~/routes/web";

/** GET /.well-known/oauth-protected-resource/api/v1 — cacheable for an hour, with an ETag. */
export default createAction(routes.api.metadata, (ctx) =>
	respond(protectedResourceMetadata, apiMetadata(ctx.url.origin), { request: ctx.request }),
);
