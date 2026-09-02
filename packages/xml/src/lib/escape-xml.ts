/**
 * Escapes the characters that carry meaning as markup when XML text and
 * attribute values are serialized, so the output re-parses into the tree it came
 * from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const TEXT_PATTERN = /[<>&]/g;
const ATTRIBUTE_PATTERN = /[<>&"\t\n\r]/g;

const NAMED_REPLACEMENTS: Record<string, string> = {
	"<": "&lt;",
	">": "&gt;",
	"&": "&amp;",
	'"': "&quot;",
};

/**
 * Escapes a text node. `>` is escaped alongside `<` and `&` so that a literal
 * `]]>` in the content reaches the reader as text.
 *
 * @param value - The text node content
 * @returns The escaped text
 */
export function escapeText(value: string): string {
	return value.replace(TEXT_PATTERN, replaceCharacter);
}

/**
 * Escapes an attribute value. Tabs and line breaks become numeric references so
 * they survive the round trip intact, since a parser reads the literal
 * characters as spaces.
 *
 * @param value - The attribute value
 * @returns The escaped value, safe to place between double quotes
 */
export function escapeAttribute(value: string): string {
	return value.replace(ATTRIBUTE_PATTERN, replaceCharacter);
}

/**
 * Maps one character to its entity, falling back to a decimal numeric reference
 * for the whitespace that attribute values escape.
 */
function replaceCharacter(character: string): string {
	return NAMED_REPLACEMENTS[character] ?? `&#${character.charCodeAt(0)};`;
}
