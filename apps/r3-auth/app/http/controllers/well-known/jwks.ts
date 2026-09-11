/**
 * The JSON Web Key Set endpoint. Publishes the public half of the ES256 key pair this
 * server signs ID tokens, access tokens and logout tokens with, so relying parties and
 * resource servers can verify a signature without holding a shared secret.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { createOidcProvider } from "~/app/auth/repository";
import routes from "~/routes/web";

/**
 * GET /.well-known/jwks.json — the public keys. Only public key material is serialized
 * here; the private half stays in the key store the provider reads from.
 */
export default createAction(routes.wellKnown.jwks, async (ctx) =>
	ok(await createOidcProvider(ctx.db).jwks),
);
