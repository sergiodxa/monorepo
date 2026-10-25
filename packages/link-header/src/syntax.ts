/**
 * The RFC 8288 lexical pieces the `Link` header and the `application/linkset` text form
 * share: a split that respects `<uri-ref>` and `"quoted string"` boundaries, and the
 * quoting rules for parameter values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Splits a header value on separators that are not inside brackets or quotes,
 * since the top-level comma split and the per-link semicolon split both need to
 * ignore a separator inside a `<uri-ref>` or a `"quoted string"`.
 */
export function splitOutsideBracketsAndQuotes(value: string, separator: string): string[] {
	let parts: string[] = [];
	let current = "";
	let inAngle = false;
	let inQuotes = false;
	let escaped = false;

	for (let character of value) {
		if (escaped) {
			current += character;
			escaped = false;
			continue;
		}

		if (inQuotes) {
			current += character;
			if (character === "\\") escaped = true;
			else if (character === '"') inQuotes = false;
			continue;
		}

		if (character === '"') {
			current += character;
			inQuotes = true;
			continue;
		}

		if (character === "<") {
			current += character;
			inAngle = true;
			continue;
		}

		if (character === ">") {
			current += character;
			inAngle = false;
			continue;
		}

		if (character === separator && !inAngle) {
			parts.push(current);
			current = "";
			continue;
		}

		current += character;
	}

	parts.push(current);

	return parts;
}

/** Strips the surrounding quotes and unescapes a `quoted-string` parameter value. */
export function unquote(value: string): string {
	if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) return value;
	return value.slice(1, -1).replaceAll(/\\(.)/g, "$1");
}

/** Quotes a parameter value so a comma or quote inside it cannot split the header. */
export function quote(value: string): string {
	return `"${value.replaceAll(/([\\"])/g, "\\$1")}"`;
}
