/**
 * TEXT escaping (RFC 5545 §3.3.11) in one place: the writer escapes, the reader undoes it,
 * and comma lists split only on the commas the escaping left bare.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Escapes a string for a TEXT value: backslash, semicolon and comma get a backslash, and
 * every newline form becomes `\n`, so the value stays on one content line.
 *
 * @param text - The text as a reader should see it
 * @returns The value as it is written
 */
export function escapeText(text: string): string {
	return text
		.replaceAll("\\", "\\\\")
		.replaceAll(";", "\\;")
		.replaceAll(",", "\\,")
		.replaceAll(/\r\n|\r|\n/g, "\\n");
}

/**
 * Undoes TEXT escaping. `\n` and `\N` become a newline and any other escaped character
 * stands for itself, so a producer that also escapes `:` still reads as intended.
 *
 * @param value - The value as written
 * @returns The text it carries
 */
export function unescapeText(value: string): string {
	return value.replaceAll(/\\([\s\S])/g, (_, character: string) =>
		character === "n" || character === "N" ? "\n" : character,
	);
}

/**
 * Splits a multi-valued property on the commas that separate its values, leaving escaped
 * commas inside the items for `unescapeText` to undo.
 *
 * @param value - The value as written
 * @returns The items, still escaped
 */
export function splitList(value: string): string[] {
	let items: string[] = [];
	let current = "";
	for (let index = 0; index < value.length; index++) {
		let character = value[index];
		if (character === "\\" && index + 1 < value.length) {
			current += character + value[index + 1];
			index++;
		} else if (character === ",") {
			items.push(current);
			current = "";
		} else current += character;
	}
	items.push(current);
	return items;
}
