/**
 * What a label is allowed to be, and the folded form two spellings of one label meet in.
 *
 * Both the path that makes a label and the path that renames one read a name through here,
 * so a name accepted on one is accepted on the other and uniqueness is taken over the same
 * form whichever wrote the row. Nothing here reaches a database or a clock: a name is
 * decidable from its own characters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TAG_NAME_LENGTH } from "~/database/schema";

/** Runs of whitespace, which collapse to the single space a chip is read with. */
const WHITESPACE = /\s+/gu;

/** The characters a label may not carry, which are the ones no chip could draw. */
const CONTROL = /\p{Cc}|\p{Cf}/u;

/** A label as it is stored: the name the reader gets back, and the form it is matched by. */
export interface TagName {
	/** What the reader typed, trimmed and with its internal whitespace collapsed. */
	name: string;
	/** The case-folded form uniqueness and matching are taken over. */
	slug: string;
}

/**
 * Reads what somebody typed as a label, or answers `null` for text that is not one.
 *
 * The name is what is left after trimming, collapsing internal whitespace to one space and
 * normalizing to NFKC, and it has to be between one and {@link TAG_NAME_LENGTH} UTF-16
 * units. The slug is that name case-folded, so `Rust` and `rust` resolve to one label while
 * the name shown is the one first typed.
 *
 * @param input - The text as it arrived from a form.
 * @example let folded = foldTagName(" Rust  Lang "); // { name: "Rust Lang", slug: "rust lang" }
 */
export function foldTagName(input: string): TagName | null {
	let normalized = input.normalize("NFKC").replaceAll(WHITESPACE, " ").trim();

	if (normalized.length === 0 || normalized.length > TAG_NAME_LENGTH) return null;
	if (CONTROL.test(normalized)) return null;

	return { name: normalized, slug: normalized.toLowerCase() };
}
