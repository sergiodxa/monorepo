/**
 * Converts JSONPlaceholder lowercase titles into display titles.
 *
 * @param value Lowercase source title.
 * @returns A title-cased display string.
 */
export function titleCase(value: string): string {
	return value.replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}
