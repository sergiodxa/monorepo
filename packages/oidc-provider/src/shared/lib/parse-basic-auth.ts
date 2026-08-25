/**
 * Parser for HTTP Basic `Authorization` headers.
 *
 * OAuth clients may authenticate at the token endpoint via `client_secret_basic`,
 * which encodes the client id and secret in a Basic auth header; this module
 * decodes and URL-unescapes those credentials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Parse an HTTP Basic Authentication header into client credentials.
 *
 * Returns `null` (never throws) for a missing, non-`Basic`, malformed, or
 * incomplete header; both fields are percent-decoded per `client_secret_basic`.
 * @param header - The `Authorization` header value, or null when absent.
 * @returns Parsed `clientId`/`clientSecret`, or null if the header is invalid.
 * @example
 * let creds = parseBasicAuth(request.headers.get("authorization"));
 * if (creds) authenticateClient(creds.clientId, creds.clientSecret);
 */
export default function parseBasicAuth(
	header: string | null,
): { clientId: string; clientSecret: string } | null {
	if (!header || !header.startsWith("Basic ")) return null;

	try {
		let encoded = header.slice(6);
		let decoded = atob(encoded);
		let [clientId, clientSecret] = decoded.split(":");
		if (!clientId || !clientSecret) return null;
		return {
			clientId: decodeURIComponent(clientId),
			clientSecret: decodeURIComponent(clientSecret),
		};
	} catch {
		return null;
	}
}
