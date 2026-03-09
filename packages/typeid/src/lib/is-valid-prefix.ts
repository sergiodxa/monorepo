const MAX_PREFIX_LENGTH = 63;
const LOWER_CASE_A = 97;
const LOWER_CASE_Z = 122;
const UNDERSCORE = 95;

export function isValidPrefix(string: string): boolean {
	if (string.length > MAX_PREFIX_LENGTH) return false;

	let lastPosition = string.length - 1;

	for (let index = 0; index < string.length; index += 1) {
		let code = string.charCodeAt(index);
		let isLowerAtoZ = code >= LOWER_CASE_A && code <= LOWER_CASE_Z;
		let isUnderscore = code === UNDERSCORE;
		let isFirst = index === 0;
		let isLast = index === lastPosition;

		// first and last char of prefix can only be [a-z]
		if ((isFirst || isLast) && !isLowerAtoZ) return false;
		if (!(isLowerAtoZ || isUnderscore)) return false;
	}

	return true;
}
