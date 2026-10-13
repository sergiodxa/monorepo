/**
 * RFC 8288 `Link` header parse and stringify. Splitting on commas is wrong: a
 * URI-Reference can contain a comma and a parameter value can be quoted, so the
 * scanner tracks angle brackets and quoted strings and drops malformed entries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One `link-value`: its target, relation types, other parameters, and source text.
 *
 * `rels` is the first `rel` parameter, lowercased and space-split. `params` holds
 * every other named parameter, first of each name, with quotes stripped. `raw` is
 * the exact source text so a merge can re-emit links this caller does not own.
 */
export interface Link {
	/** The URI-Reference, with the surrounding angle brackets stripped. */
	target: string;
	/** Lowercased relation types from the first `rel` parameter. */
	rels: string[];
	/** Other parameters, first of each name, unquoted. */
	params: Record<string, string>;
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

/** Quotes a parameter value so a comma or quote inside it cannot split the header. */
function quote(value: string): string {
	return `"${value.replaceAll(/([\\"])/g, "\\$1")}"`;
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
 * Reads every named parameter other than `rel`, keeping the first of each name
 * so a duplicate cannot overwrite the value RFC 8288 says to honour.
 */
function parseParams(parameters: string[]): Record<string, string> {
	let params: Record<string, string> = {};

	for (let parameter of parameters) {
		let separator = parameter.indexOf("=");
		if (separator === -1) continue;

		let name = parameter.slice(0, separator).trim().toLowerCase();
		if (name === "rel" || name in params) continue;

		params[name] = unquote(parameter.slice(separator + 1).trim());
	}

	return params;
}

/**
 * Parses a `Link` header value into its individual links, dropping malformed
 * entries instead of raising because the header being merged into belongs to a
 * response already under construction where one bad link should not fail it.
 *
 * @param header The raw header value, or `null` when the message carries none.
 * @returns The links in source order.
 * @example parse('</a,b.css>; rel="preload"')[0].target // "/a,b.css"
 */
export function parse(header: string | null): Link[] {
	if (header === null) return [];

	let links: Link[] = [];

	for (let candidate of splitOutsideBracketsAndQuotes(header, ",")) {
		let raw = candidate.trim();
		if (raw.length === 0) continue;

		let open = raw.indexOf("<");
		let close = raw.indexOf(">", open + 1);
		if (open !== 0 || close === -1) continue;

		let parameters = splitOutsideBracketsAndQuotes(raw.slice(close + 1), ";")
			.map((parameter) => parameter.trim())
			.filter((parameter) => parameter.length > 0);

		links.push({
			target: raw.slice(open + 1, close),
			rels: parseRels(parameters),
			params: parseParams(parameters),
			raw,
		});
	}

	return links;
}

/**
 * Renders a link-value for a target, a single relation type, and optional extra
 * parameters such as `type` or `as`. Parameter values are quoted so a comma
 * inside one cannot split the header.
 *
 * @param target URI-Reference to advertise, written inside angle brackets.
 * @param rel Relation type, emitted as a quoted string.
 * @param params Extra parameters, each written after `rel`.
 * @returns The link-value text, ready to join into a `Link` header.
 * @example serializeLink("https://api.example.com/x?page=2", "next")
 */
export function serializeLink(
	target: string,
	rel: string,
	params?: Record<string, string>,
): string {
	let parts = [`<${target}>`, `rel=${quote(rel)}`];

	if (params !== undefined) {
		for (let [name, value] of Object.entries(params)) {
			parts.push(`${name}=${quote(value)}`);
		}
	}

	return parts.join("; ");
}

/**
 * Joins link-values back into one header value. String entries are used as-is;
 * parsed {@link Link} entries re-emit `raw` so parameters this caller did not
 * read still round-trip.
 *
 * @param links Link-value texts or parsed links, in the order they should appear.
 * @returns The header value, or `null` when there is nothing to write.
 */
export function stringify(links: readonly Link[] | readonly string[]): string | null {
	if (links.length === 0) return null;

	let parts: string[] = [];
	for (let link of links) {
		parts.push(typeof link === "string" ? link : link.raw);
	}

	return parts.join(", ");
}
