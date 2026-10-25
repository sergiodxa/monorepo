/**
 * The `name=value; name=value` syntax DKIM defined (RFC 6376 §3.2) and DMARC, MTA-STS and
 * TLS-RPT reuse: split on semicolons, whitespace trimmed around names and values, and an
 * empty trailing segment allowed. Each protocol validates names and values itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One `name=value` pair as written, in record order. */
export interface Tag {
	name: string;
	value: string;
}

/**
 * Splits a tag list into its pairs. Blank segments are skipped, so `a=1;;b=2` and a
 * trailing `;` read as two tags; a segment without `=` makes the whole list unreadable.
 *
 * @param text - The record text.
 * @returns The pairs in order, or `null` when a segment is not `name=value`.
 * @example splitTags("v=DKIM1; k=rsa; p=MIGf") // [{ name: "v", value: "DKIM1" }, …]
 */
export function splitTags(text: string): Tag[] | null {
	let tags: Tag[] = [];
	for (let segment of text.split(";")) {
		if (segment.trim() === "") continue;
		let equals = segment.indexOf("=");
		if (equals === -1) return null;
		tags.push({
			name: segment.slice(0, equals).trim(),
			value: segment.slice(equals + 1).trim(),
		});
	}
	return tags;
}

/**
 * Splits a comma-separated URI list the way DMARC's `rua`/`ruf` and TLS-RPT's `rua` write
 * it, trimming whitespace around each entry and dropping empty ones.
 */
export function splitUriList(value: string): string[] {
	return value
		.split(",")
		.map((uri) => uri.trim())
		.filter((uri) => uri !== "");
}

/**
 * Whether `uri` is an absolute URI a reporter could send to. DMARC and TLS-RPT only define
 * delivery over `mailto:` and `https:`, but any parseable absolute URI counts as written.
 */
export function isAbsoluteUri(uri: string): boolean {
	return URL.canParse(uri);
}
