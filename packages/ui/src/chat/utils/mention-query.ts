/**
 * Reads a mention out of a composer's text: whether the caret sits in an `@handle` being
 * typed, and which people it names. Pure text in, matches out, so the menu's rules are
 * testable without a field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Someone a mention can name. Plain data, since the list crosses into the browser with
 * the menu's island.
 */
export type MentionPerson = {
	/** Stable across renders; the option's `id` is built from it. */
	id: string;
	/** Written after the trigger when picked, such as `ana` for `@ana`. */
	handle: string;
	name: string;
	/** A short muted line beside the handle, such as a role or a status. */
	detail?: string;
	/** One or two letters shown in the tile before the name. */
	initials: string;
	/** Any CSS color the tile fills with; a neutral tint when omitted. */
	color?: string;
};

/** Where a mention being typed starts, and what has been typed after its trigger. */
export interface MentionQuery {
	/** The index of the trigger character. */
	start: number;
	/** The text between the trigger and the caret, empty right after the trigger. */
	query: string;
}

/** A character a handle may hold: letters and digits in any script, `_`, `.` and `-`. */
const HANDLE_CHARACTER = /[\p{L}\p{N}_.-]/u;

/**
 * The mention the caret is in, when it sits right after a trigger and handle characters and
 * that trigger starts a word, so an email address or a trigger mid-word opens nothing.
 *
 * @param text The field's text.
 * @param caret The caret's index in it.
 * @param trigger The character that starts a mention.
 * @returns Where the mention starts and its query, or `null` when the caret is in none.
 * @example mentionQuery("ping @an", 8) // { start: 5, query: "an" }
 * @example mentionQuery("me@host", 7) // null
 */
export function mentionQuery(text: string, caret: number, trigger = "@"): MentionQuery | null {
	let index = Math.min(caret, text.length);
	while (index > 0 && HANDLE_CHARACTER.test(text[index - 1] ?? "")) index -= 1;
	let start = index - trigger.length;
	if (start < 0 || text.slice(start, index) !== trigger) return null;
	let before = text[start - 1];
	if (before !== undefined && !/\s/.test(before)) return null;
	return { start, query: text.slice(index, caret) };
}

/**
 * The people a query names, at most `limit` of them: first those whose handle or a word of
 * whose name starts with it, then those holding it anywhere, each group in the list's order
 * and ignoring case. An empty query lists the first `limit` people.
 *
 * @param people Everyone who can be mentioned.
 * @param query What has been typed after the trigger.
 * @param limit How many matches to return.
 * @returns The matches, best first.
 */
export function mentionMatches(
	people: readonly MentionPerson[],
	query: string,
	limit: number,
): MentionPerson[] {
	let needle = query.toLowerCase();
	let prefixed: MentionPerson[] = [];
	let contained: MentionPerson[] = [];
	for (let person of people) {
		let handle = person.handle.toLowerCase();
		let name = person.name.toLowerCase();
		let words = name.split(/\s+/);
		if (handle.startsWith(needle) || words.some((word) => word.startsWith(needle))) {
			prefixed.push(person);
		} else if (handle.includes(needle) || name.includes(needle)) {
			contained.push(person);
		}
	}
	return [...prefixed, ...contained].slice(0, Math.max(0, limit));
}
