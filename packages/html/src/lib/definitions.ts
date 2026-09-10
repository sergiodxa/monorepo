/**
 * Pairs a term with the definition that follows it, walking past the other terms of
 * a shared group so a term with siblings still finds its own definition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Finds the definition a term is paired with, absent when the term carries none.
 *
 * @param term - The element exposed as a term
 */
export function definitionFor(term: Element): Element | undefined {
	for (let node = term.nextElementSibling; node; node = node.nextElementSibling) {
		let tag = node.localName.toLowerCase();
		if (tag === "dd") return node;
		if (tag !== "dt") return undefined;
	}

	return undefined;
}
