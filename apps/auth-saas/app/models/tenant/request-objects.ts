/**
 * JWT-Secured Authorization Requests (RFC 9101): verifies a client's signed request
 * object against the keys it registered and turns its claims into the authorization
 * parameters `/authorize` and the PAR endpoint validate, ignoring everything outside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { JWK, JWT } from "@sdxc/jwt";
import * as s from "remix/data-schema";

import type { ClientJwks } from "~/app/models/tenant/clients";

import { clients } from "~/app/models/tenant/clients";

/** The JWS algorithms a request object may be signed with, as discovery advertises them. */
export const REQUEST_OBJECT_SIGNING_ALGORITHMS = [
	JWK.Algorithm.ES256,
	JWK.Algorithm.RS256,
	JWK.Algorithm.Ed25519,
];

/** How long a client's `jwks_uri` has to answer before the request object is refused. */
const JWKS_URI_TIMEOUT_MS = 5000;

/**
 * The JWT registered claims RFC 9101 §9.1 reserves inside a request object; they
 * describe the object itself and never become authorization parameters.
 */
const JWT_CLAIMS = new Set(["iss", "aud", "exp", "nbf", "iat", "jti", "sub"]);

/** A request object: explicitly typed (RFC 9101 §4), so a token minted for anything else never verifies as one. */
class RequestObject extends JWT {
	static override type = "oauth-authz-req+jwt";
}

export interface VerifyRequestObjectInput {
	/** The compact JWS the `request` parameter carried. */
	token: string;
	/** The `client_id` the request named outside the object; the object's own claim must equal it. */
	clientId: string;
	/** The tenant's issuer, the audience the object must name. */
	issuer: string;
	now: number;
}

/** The verified authorization parameters, or the `invalid_request_object` description to answer with. */
export type VerifyRequestObjectResult =
	| { ok: true; parameters: Record<string, string> }
	| { ok: false; description: string };

let VerifyRequestObjectSchema = s.object({
	token: s.string(),
	clientId: s.string(),
	issuer: s.string(),
	now: s.number(),
});

/**
 * Verifies a request object with the keys its client registered, inline or by URL, and
 * answers its claims as authorization parameters: strings as given, numbers and
 * booleans in their decimal or `true`/`false` form, objects and arrays as JSON text.
 *
 * @param db - The tenant's database.
 * @param input - The object, the `client_id` it was sent under, the tenant's issuer, and the clock to check `exp` against.
 * @returns The parameters the object carries, `client_id` among them, or why it was refused.
 */
export async function verifyRequestObject(
	db: Database,
	input: VerifyRequestObjectInput,
): Promise<VerifyRequestObjectResult> {
	let parsed = s.parse(VerifyRequestObjectSchema, input);

	let client = await db.find(clients, { id: parsed.clientId });
	if (!client) {
		return { ok: false, description: "This application has no keys registered to sign with." };
	}

	let keys = await clientKeys(client.jwks as ClientJwks | null, client.jwks_uri);
	if (!keys) {
		return { ok: false, description: "This application has no keys registered to sign with." };
	}

	let verified: RequestObject;
	try {
		verified = await RequestObject.verify(parsed.token, keys, {
			issuer: parsed.clientId,
			audience: parsed.issuer,
			algorithms: REQUEST_OBJECT_SIGNING_ALGORITHMS,
			requiredClaims: ["exp"],
			currentDate: new Date(parsed.now),
		});
	} catch {
		return {
			ok: false,
			description: "The request object did not verify: check its signature, typ, iss, aud and exp.",
		};
	}

	let claims = verified.payload as Record<string, unknown>;

	if (claims.client_id !== parsed.clientId) {
		return { ok: false, description: "The request object's client_id does not match." };
	}

	if ("request" in claims || "request_uri" in claims) {
		return { ok: false, description: "A request object may not carry request or request_uri." };
	}

	let parameters: Record<string, string> = {};
	for (let [name, value] of Object.entries(claims)) {
		if (JWT_CLAIMS.has(name) || value === null || value === undefined) continue;
		parameters[name] = typeof value === "string" ? value : stringifyClaim(value);
	}

	return { ok: true, parameters };
}

/** A claim that is not a string, written the way it would read as a query parameter. */
function stringifyClaim(value: unknown): string {
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return JSON.stringify(value);
}

/**
 * The resolver over whichever key set the client registered, `null` when it has none.
 * A `jwks_uri` is fetched on each verification, so a client's key rotation applies
 * from its next request object.
 */
async function clientKeys(
	jwks: ClientJwks | null,
	jwksUri: string | null,
): Promise<JWK.KeyResolver | null> {
	if (jwks) return JWK.importLocal(jwks as Parameters<typeof JWK.importLocal>[0]);
	if (jwksUri) {
		return JWK.importRemote(new URL(jwksUri), { timeoutDuration: JWKS_URI_TIMEOUT_MS });
	}
	return null;
}
