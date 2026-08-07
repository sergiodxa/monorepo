/**
 * Reading a confidential client's credentials off a token-endpoint request. RFC 6749
 * §2.3.1 allows both HTTP Basic and `client_id`/`client_secret` in the form body, and
 * this server has to accept both: the OIDC client library every relying party here
 * uses defaults to body credentials, and refusing them fails every sign-in at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A client id and the secret presented with it, however it was transported. */
export interface ClientCredentials {
	clientId: string;
	clientSecret: string;
}

/**
 * Reads credentials from an `Authorization: Basic` header.
 *
 * Decoded as standard base64 (RFC 4648 §4), which is what RFC 7617 specifies —
 * base64url would mangle any secret whose encoding contains `+` or `/`.
 *
 * @returns The credentials, or `null` when the header is absent or unreadable.
 */
export function credentialsFromHeader(headers: Headers): ClientCredentials | null {
	let authorization = headers.get("Authorization");
	if (!authorization) return null;

	let [scheme, token] = authorization.split(" ");
	if (scheme !== "Basic" || !token) return null;

	let decoded: string;
	try {
		decoded = atob(token);
	} catch {
		return null;
	}

	// Split on the first colon only: a secret may legitimately contain one, a client
	// id never does.
	let separator = decoded.indexOf(":");
	if (separator < 0) return null;

	let clientId = decoded.slice(0, separator);
	let clientSecret = decoded.slice(separator + 1);
	if (!clientId || !clientSecret) return null;

	return { clientId, clientSecret };
}

/**
 * Reads credentials from the parsed request body.
 *
 * @returns The credentials, or `null` when either field is missing.
 */
export function credentialsFromBody(body: {
	client_id?: string;
	client_secret?: string;
}): ClientCredentials | null {
	if (!body.client_id || !body.client_secret) return null;
	return { clientId: body.client_id, clientSecret: body.client_secret };
}

/**
 * The credentials a request presents, preferring the header over the body.
 *
 * The header wins when both are present because it is the form RFC 6749 recommends,
 * and a request carrying two different identities is answering for the header's.
 */
export function readClientCredentials(
	headers: Headers,
	body: { client_id?: string; client_secret?: string },
): ClientCredentials | null {
	return credentialsFromHeader(headers) ?? credentialsFromBody(body);
}
