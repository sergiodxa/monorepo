/**
 * Parse HTTP Basic Authentication header.
 * @param header The Authorization header value
 * @returns Parsed clientId and clientSecret, or null if invalid
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
