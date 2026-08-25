/**
 * Validation for TypeID prefixes per the specification.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Maximum TypeID prefix length defined by the specification. */
const MAX_PREFIX_LENGTH = 63;

/** ASCII code for "a". */
const LOWER_CASE_A = 97;

/** ASCII code for "z". */
const LOWER_CASE_Z = 122;

/** ASCII code for "_". */
const UNDERSCORE = 95;

/**
 * Checks whether a string is a valid TypeID prefix.
 *
 * Valid prefixes are up to 63 characters, use only lowercase ASCII letters and
 * underscores, and cannot start or end with an underscore.
 * @param string Prefix candidate.
 * @returns Whether the prefix is valid.
 * @example
 * isValidPrefix("user_profile");
 * // true
 */
export function isValidPrefix(string: string): boolean {
	if (string.length > MAX_PREFIX_LENGTH) return false;

	let lastPosition = string.length - 1;

	for (let index = 0; index < string.length; index += 1) {
		let code = string.charCodeAt(index);
		let isLowerAtoZ = code >= LOWER_CASE_A && code <= LOWER_CASE_Z;
		let isUnderscore = code === UNDERSCORE;
		let isFirst = index === 0;
		let isLast = index === lastPosition;

		if ((isFirst || isLast) && !isLowerAtoZ) return false;
		if (!(isLowerAtoZ || isUnderscore)) return false;
	}

	return true;
}
