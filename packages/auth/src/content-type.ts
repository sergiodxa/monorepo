/**
 * Reads the media type an answer declares, so one header read tells a body worth
 * parsing as JSON from one the server described as something else, and names that
 * media type in the failure it reports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The media type an answer declares when it describes something other than JSON,
 * and `null` when the body is worth parsing: a `json` subtype, the `+json` suffix
 * RFC 6839 defines, and a header left off or written unreadably all reach a parse.
 *
 * @param response - The answer, with its body still unread.
 * @returns The declared media type, lowercased and stripped of its parameters, for
 *   an operator reading it in a failure message.
 * @example if (nonJsonMediaType(response) !== null) return failure(error);
 */
export function nonJsonMediaType(response: Response): string | null {
	let header = response.headers.get("content-type");
	if (header === null) return null;

	let [declared = ""] = header.split(";");
	let mediaType = declared.trim().toLowerCase();
	if (mediaType.length === 0) return null;

	let [, subtype] = mediaType.split("/");
	if (subtype === undefined) return null;
	if (subtype === "json" || subtype.endsWith("+json")) return null;

	return mediaType;
}
