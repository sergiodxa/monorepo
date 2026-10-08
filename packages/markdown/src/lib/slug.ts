/**
 * Heading slugs the way GitHub writes them, so a `#fragment` copied from a README
 * on GitHub resolves to the same heading here. One slugger per document keeps a
 * repeated heading addressable by numbering the ones after the first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Everything GitHub drops from a slug: any character that is not a letter, mark, digit, connector, space or hyphen. */
const DROPPED = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;

/**
 * The slug a heading's text reads as, before any de-duplication: lower-cased,
 * punctuation dropped, and each space a hyphen.
 *
 * @param text - The heading's plain text
 * @returns The slug, which is empty when the text held only punctuation
 * @example slug("Hello, World!") // "hello-world"
 */
export function slug(text: string): string {
	return text.toLowerCase().replace(DROPPED, "").replaceAll(" ", "-");
}

/**
 * Hands out unique slugs across one document. A slug already taken — by an earlier
 * heading or by an id the caller reserved — takes the first free `-1`, `-2` suffix.
 */
export class Slugger {
	#taken = new Set<string>();

	/**
	 * Marks an id as used without producing one, for an id an author wrote by hand.
	 *
	 * @param id - The id to keep other headings from taking
	 */
	reserve(id: string): void {
		this.#taken.add(id);
	}

	/**
	 * @param text - The heading's plain text
	 * @returns A slug no earlier call or reservation on this slugger produced
	 * @example new Slugger().next("Props") // "props", then "props-1"
	 */
	next(text: string): string {
		return this.claim(slug(text));
	}

	/**
	 * Takes an id already in its final spelling, numbered past every taken one, for a
	 * caller whose slugs come from its own function rather than GitHub's.
	 *
	 * @param base - The id to take, or to number from when it is taken
	 * @returns `base`, or the first free `base-1`, `base-2`
	 */
	claim(base: string): string {
		let candidate = base;
		let count = 0;

		while (this.#taken.has(candidate)) {
			count += 1;
			candidate = `${base}-${count}`;
		}

		this.#taken.add(candidate);
		return candidate;
	}
}
