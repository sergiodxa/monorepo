/**
 * Time arithmetic for a video's timeline: readings as a player prints them, WebVTT files
 * written from timed lines, and which entry of a playing-order list a moment falls in. The
 * server render and the island share it, so both mark the same chapter and line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How far, in seconds, a moment may run ahead of a start and still count as reaching it. */
export const SEEK_SLACK = 0.25;

/**
 * Writes seconds as a player prints them: `m:ss` under an hour and `h:mm:ss` from one.
 *
 * @param seconds Whole or fractional seconds; fractions are dropped.
 * @returns The reading, such as `6:58`.
 * @example formatVideoTime(418.9); // "6:58"
 */
export function formatVideoTime(seconds: number): string {
	let total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
	let hours = Math.floor(total / 3600);
	let minutes = Math.floor((total % 3600) / 60);
	let rest = String(total % 60).padStart(2, "0");
	if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`;
	return `${minutes}:${rest}`;
}

/** Seconds as a WebVTT timestamp, `hh:mm:ss.mmm`. */
function vttTime(seconds: number): string {
	let millis = Math.round(Math.max(0, seconds) * 1000);
	let hours = String(Math.floor(millis / 3_600_000)).padStart(2, "0");
	let minutes = String(Math.floor((millis % 3_600_000) / 60_000)).padStart(2, "0");
	let secs = String(Math.floor((millis % 60_000) / 1000)).padStart(2, "0");
	return `${hours}:${minutes}:${secs}.${String(millis % 1000).padStart(3, "0")}`;
}

/**
 * The same moment as an ISO 8601 duration, for a `<time dateTime>` attribute.
 *
 * @param seconds Whole or fractional seconds; fractions are dropped.
 * @returns The duration, such as `PT6M58S`.
 */
export function isoDuration(seconds: number): string {
	let total = Math.max(0, Math.floor(seconds));
	return `PT${Math.floor(total / 60)}M${total % 60}S`;
}

/**
 * Writes timed lines as a WebVTT file in a `data:` URL, each line ending where the next
 * starts and the last at `duration`, so a `<track>` needs no file of its own.
 *
 * @param lines Start times and texts, in playing order.
 * @param duration Length of the video in seconds.
 * @returns A `data:text/vtt` URL.
 * @example <track kind="chapters" src={webVttUrl([{ start: 0, text: "Intro" }], 90)} />
 */
export function webVttUrl(
	lines: readonly { start: number; text: string }[],
	duration: number,
): string {
	let cues = lines.map((line, index) => {
		let end = lines[index + 1]?.start ?? duration;
		let text = line.text.replaceAll("-->", "→").replaceAll(/\n{2,}/g, "\n");
		return `${index + 1}\n${vttTime(line.start)} --> ${vttTime(end)}\n${text}`;
	});
	return `data:text/vtt;charset=utf-8,${encodeURIComponent(`${["WEBVTT", ...cues].join("\n\n")}\n`)}`;
}

/**
 * Index of the last start at or before `time`, or -1 before the first.
 *
 * @param starts Start times in playing order.
 * @param time The moment asked about, in seconds; `undefined` matches nothing.
 * @returns The index of the entry playing at `time`.
 */
export function playingIndex(starts: readonly number[], time: number | undefined): number {
	if (time === undefined) return -1;
	let found = -1;
	for (let [index, start] of starts.entries()) if (start <= time + SEEK_SLACK) found = index;
	return found;
}

/**
 * Share of a chapter played at `time`, from 0 to 1.
 *
 * @param start The chapter's start in seconds.
 * @param end The chapter's end in seconds.
 * @param time The moment asked about, or `undefined` for none.
 * @returns How much of the chapter lies before `time`.
 */
export function playedShare(start: number, end: number, time: number | undefined): number {
	if (time === undefined || end <= start) return 0;
	return Math.min(1, Math.max(0, (time - start) / (end - start)));
}
