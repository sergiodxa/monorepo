/**
 * Scalar resolution by the YAML 1.2 core schema, shared by both halves of the
 * package: the parser reads a plain scalar through it, and the serializer asks it
 * whether a string can be written plain without coming back as another type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Resolves a plain scalar to the type the YAML 1.2 core schema gives it.
 *
 * Anything the schema leaves unrecognized stays a string, which is why a date
 * arrives as text and `1_000` keeps its underscore.
 *
 * @param text - The scalar's text
 * @returns The resolved value
 * @example
 * resolvePlain("2026-08-02"); // "2026-08-02"
 */
export function resolvePlain(text: string): unknown {
	if (text === "" || text === "~" || /^(?:null|Null|NULL)$/.test(text)) return null;
	if (/^(?:true|True|TRUE)$/.test(text)) return true;
	if (/^(?:false|False|FALSE)$/.test(text)) return false;
	if (/^[-+]?\d+$/.test(text)) return Number.parseInt(text, 10);
	if (/^0x[\dA-Fa-f]+$/.test(text)) return Number.parseInt(text.slice(2), 16);
	if (/^0o[0-7]+$/.test(text)) return Number.parseInt(text.slice(2), 8);
	if (/^[-+]?(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][-+]?\d+)?$/.test(text)) return Number.parseFloat(text);

	if (/^[-+]?\.(?:inf|Inf|INF)$/.test(text)) {
		return text.startsWith("-") ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
	}

	if (/^\.(?:nan|NaN|NAN)$/.test(text)) return Number.NaN;

	return text;
}
