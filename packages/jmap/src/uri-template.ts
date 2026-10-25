/**
 * RFC 6570 level 1 URI Template expansion, the form a JMAP session's download, upload
 * and event-source URLs take: each `{name}` replaced by its value with every character
 * outside the unreserved set percent-encoded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A level 1 expression. */
const EXPRESSION = /\{([A-Za-z0-9_.%]+)\}/gu;

/** Characters `encodeURIComponent` leaves alone that RFC 6570 simple expansion encodes. */
const SUB_DELIMS = /[!'()*]/gu;

/**
 * Expands `template` with `variables`. A variable the template names and `variables` lacks
 * expands to the empty string, as RFC 6570 defines for an undefined variable.
 *
 * @param template - The URI Template.
 * @param variables - The values by name.
 * @example expand("/download/{accountId}/{blobId}?accept={type}", { accountId: "a", blobId: "b", type: "text/plain" });
 */
export function expand(template: string, variables: Record<string, string>): string {
	return template.replaceAll(EXPRESSION, (_, name: string) => encode(variables[name] ?? ""));
}

/**
 * `value` percent-encoded down to RFC 3986 unreserved characters.
 *
 * @param value - A variable's value.
 */
function encode(value: string): string {
	return encodeURIComponent(value).replaceAll(
		SUB_DELIMS,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}
