/**
 * How a chosen file's size reads in an upload list. Thresholds are the binary ones a file
 * manager uses, so a number here matches what the operating system showed a moment ago.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const UNITS = ["B", "KB", "MB", "GB"] as const;

const STEP = 1024;

/**
 * A byte count as an upload row writes it.
 *
 * @param bytes - The file's size in bytes.
 * @returns The size with the largest unit it fills, e.g. `"2.4 MB"`.
 * @example formatFileSize(2_517_000) // "2.4 MB"
 */
export function formatFileSize(bytes: number): string {
	let unit = 0;
	let size = Math.max(0, bytes);

	while (size >= STEP && unit < UNITS.length - 1) {
		size /= STEP;
		unit += 1;
	}

	let digits = unit === 0 || size >= 10 ? 0 : 1;
	return `${size.toFixed(digits)} ${UNITS[unit]}`;
}
