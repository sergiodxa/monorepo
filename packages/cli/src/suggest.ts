/**
 * Closest-name suggestions for a mistyped command or flag, so a usage error can say what the
 * user most likely meant instead of only what was wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The candidate nearest to `input` by edit distance, counting a swap of two neighbouring
 * characters as one edit. A candidate qualifies within a third of the input's length (at least
 * one edit, at most three), so a short unrelated name suggests nothing.
 *
 * @example closest("instal", ["install", "init"]) // "install"
 */
export function closest(input: string, candidates: Iterable<string>): string | undefined {
	let limit = Math.min(3, Math.max(1, Math.floor(input.length / 3)));
	let best: string | undefined;
	let bestDistance = Infinity;
	for (let candidate of candidates) {
		let distance = editDistance(input, candidate);
		if (distance <= limit && distance < bestDistance) {
			best = candidate;
			bestDistance = distance;
		}
	}
	return best;
}

/** Optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps. */
function editDistance(a: string, b: string): number {
	let rows: number[][] = [];
	for (let i = 0; i <= a.length; i++) {
		let row: number[] = [i];
		for (let j = 1; j <= b.length; j++) row.push(i === 0 ? j : 0);
		rows.push(row);
	}
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			let cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let above = rows[i - 1] as number[];
			let row = rows[i] as number[];
			let value = Math.min(
				(above[j] as number) + 1,
				(row[j - 1] as number) + 1,
				(above[j - 1] as number) + cost,
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				value = Math.min(value, ((rows[i - 2] as number[])[j - 2] as number) + 1);
			}
			row[j] = value;
		}
	}
	return (rows[a.length] as number[])[b.length] as number;
}
