/**
 * Shortens a reference summary to the line a page carries above its example.
 *
 * A module comment opens with what the thing is and then keeps going: the host it is built
 * on, the attributes it reads, the parts it composes from. That continuation is what a
 * maintainer needs and what buries a demo, so a page shows the opening clause and leaves
 * the rest to the reference below it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How long a headline may run before a boundary is looked for. */
const LIMIT = 120;

/** How far into the sentence a boundary may sit and still be worth cutting at. */
const REACH = 200;

/**
 * The marks that introduce the detail after a definition. The first of any of them ends
 * the definition, because what follows them is elaboration rather than the thing itself.
 */
const INTRODUCERS = [": ", " — ", "; "];

/**
 * Words that open a clause hanging off the sentence before it. A comma followed by one of
 * these can be cut at and leave a sentence that still stands; a comma in a list — "every
 * size, weight, spacing" — cannot, which is why the mark alone is not enough to cut on.
 */
const TRAILING_CLAUSE =
	/^(and|or|so|plus|with|which|while|where|each|then|leaving|keeping|making|giving|for|but|after|before|until|because)\b/;

/** How much sentence has to precede a comma before cutting there says anything. */
const MINIMUM = 40;

/**
 * Reads the opening clause of a summary.
 *
 * @param summary - The summary as the source comment wrote it.
 * @returns One clause, ending in a full stop.
 *
 * @example toHeadline("A modal surface built on the native element: opened declaratively.")
 * @example "A modal surface built on the native element."
 */
export function toHeadline(summary: string): string {
	let sentence = summary.trim();
	if (sentence.length <= LIMIT) return sentence;

	for (let mark of INTRODUCERS) {
		let cut = sentence.indexOf(mark);
		if (cut > 0 && cut <= REACH) return `${sentence.slice(0, cut)}.`;
	}

	for (let cut = sentence.indexOf(", "); cut > 0; cut = sentence.indexOf(", ", cut + 1)) {
		if (cut < MINIMUM) continue;
		if (TRAILING_CLAUSE.test(sentence.slice(cut + 2))) return `${sentence.slice(0, cut)}.`;
	}

	return sentence;
}
