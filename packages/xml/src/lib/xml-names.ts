/**
 * Implements the XML `Name` production, which both reading and writing depend on:
 * the parser uses it to find where a tag or attribute name ends, and the
 * serializer uses it to confirm a name can be written back out as valid XML.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The `:` belongs to the production itself, so a namespace-prefixed name such as
 * `content:encoded` is one name here and the prefix is resolved separately.
 */
const NAME_START =
	"A-Za-z_:\\u00C0-\\u02FF\\u0370-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
const NAME_REST = `${NAME_START}0-9.\\-\\u00B7\\u0300-\\u036F\\u203F-\\u2040`;

const SCANNING_PATTERN = new RegExp(`[${NAME_START}][${NAME_REST}]*`, "y");
const EXACT_PATTERN = new RegExp(`^[${NAME_START}][${NAME_REST}]*$`);

/**
 * Reads the name starting at `index`, anchored there so the parser advances
 * through the source one name at a time.
 *
 * @param source - The full XML text being parsed
 * @param index - Offset the name is expected to start at
 * @returns The name, or `undefined` when no name starts there
 */
export function matchName(source: string, index: number): string | undefined {
	SCANNING_PATTERN.lastIndex = index;
	return SCANNING_PATTERN.exec(source)?.[0];
}

/**
 * Reports whether a name can be written into a tag or attribute as-is, so the
 * serializer emits output that parses back into the tree it was given.
 *
 * @param value - The element or attribute name to check
 * @returns Whether the whole value is one XML name
 */
export function isValidName(value: string): boolean {
	return EXACT_PATTERN.test(value);
}
