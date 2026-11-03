/**
 * The gallery's filter rule, shared by the server rendering a narrowed grid and the controls
 * island narrowing it as the reader types, so both keep exactly the same icons.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The words a query holds, lowercased; a blank query holds none and matches every icon. */
export function queryWords(query: string): string[] {
	return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/**
 * Everything an icon is found by, as one lowercase string: its name, the name with spaces
 * for a reader who types `circle alert`, and every tag. A tile carries it as `data-search`.
 */
export function iconSearchText(name: string, tags: readonly string[]): string {
	return [name, name.replaceAll("-", " "), ...tags].join(" ").toLowerCase();
}

/** Whether every word appears in `text`, so a second word narrows rather than widens. */
export function matchesWords(text: string, words: readonly string[]): boolean {
	return words.every((word) => text.includes(word));
}

/** The line above the grid: how many icons it holds, and of how many. */
export function iconCountLabel(
	shown: number,
	total: number,
	query: string,
	version: string,
): string {
	let format = new Intl.NumberFormat("en-US");
	if (query.trim() === "") return `${format.format(total)} icons from Lucide ${version}.`;
	return `${format.format(shown)} of ${format.format(total)} icons match “${query.trim()}”.`;
}
