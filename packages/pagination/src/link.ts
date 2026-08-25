/**
 * A small RFC 8288 `Link` header parser, just structural enough to merge safely.
 *
 * Splitting a `Link` value on `","` is wrong: a URI reference can contain a comma
 * and a parameter value can be quoted, so this scanner tracks angle brackets and
 * quoted strings instead. Each parsed link keeps its exact source text, so links
 * this package does not own are re-emitted byte for byte.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One `link-value`: its target, the relation types it declares, and its source text. */
export interface LinkValue {
	/** The URI reference, with the angle brackets stripped. */
	target: string;
	/** Lowercased relation types from the `rel` parameter, space-separated as RFC 8288 allows. */
	rels: string[];
	/** The exact source text, re-emitted unchanged so foreign parameters survive. */
	raw: string;
}

/**
 * Splits a header value on separators that are not inside brackets or quotes,
 * since the top-level comma split and the per-link semicolon split both need to
 * ignore a separator inside a `<uri-ref>` or a `"quoted string"`.
 */
function splitOutsideBracketsAndQuotes(value: string, separator: string): string[] {
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
function unquote(value: string): string {
	if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) return value;
	return value.slice(1, -1).replaceAll(/\\(.)/g, "$1");
}

/**
 * Reads the relation types out of one link-value's parameters.
 *
 * Only the first `rel` counts, as RFC 8288 requires, and the value is lowercased
 * because relation types are case-insensitive.
 */
function parseRels(parameters: string[]): string[] {
	for (let parameter of parameters) {
		let separator = parameter.indexOf("=");
		if (separator === -1) continue;

		let name = parameter.slice(0, separator).trim().toLowerCase();
		if (name !== "rel") continue;

		return unquote(parameter.slice(separator + 1).trim())
			.toLowerCase()
			.split(/\s+/)
			.filter((rel) => rel.length > 0);
	}

	return [];
}

/**
 * Parses a `Link` header value into its individual links, dropping malformed
 * entries instead of raising because the header being merged into belongs to a
 * response already under construction where one bad link should not fail it.
 *
 * @param header The raw header value, or `null` when the response carries none.
 * @returns The links in source order.
 * @example
 * parseLinkHeader('</a,b.css>; rel="preload"')[0].target; // "/a,b.css"
 */
export function parseLinkHeader(header: string | null): LinkValue[] {
	if (header === null) return [];

	let links: LinkValue[] = [];

	for (let candidate of splitOutsideBracketsAndQuotes(header, ",")) {
		let raw = candidate.trim();
		if (raw.length === 0) continue;

		let open = raw.indexOf("<");
		let close = raw.indexOf(">", open + 1);
		if (open !== 0 || close === -1) continue;

		let parameters = splitOutsideBracketsAndQuotes(raw.slice(close + 1), ";")
			.map((parameter) => parameter.trim())
			.filter((parameter) => parameter.length > 0);

		links.push({ target: raw.slice(open + 1, close), rels: parseRels(parameters), raw });
	}

	return links;
}

/**
 * Renders a link-value for a target and a single relation type.
 *
 * @param target Absolute URL to advertise.
 * @param rel Relation type, emitted as a quoted string.
 * @returns The link-value text, ready to join into a `Link` header.
 * @example
 * serializeLink("https://api.example.com/monitors?page=2", "next");
 */
export function serializeLink(target: string, rel: string): string {
	return `<${target}>; rel="${rel}"`;
}

/**
 * Joins link-values back into one header value.
 *
 * @param links Link-value texts in the order they should appear.
 * @returns The header value, or `null` when there is nothing to write.
 */
export function serializeLinkHeader(links: readonly string[]): string | null {
	if (links.length === 0) return null;
	return links.join(", ");
}
