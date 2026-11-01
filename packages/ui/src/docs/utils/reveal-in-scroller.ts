/**
 * Brings an element into view inside the box that scrolls it, such as a sticky sidebar or
 * an "On this page" rail, leaving the page's own scroll position where the reader put it.
 * `scrollIntoView` scrolls every ancestor, the document included, so it cannot do this.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The closest ancestor that scrolls vertically and has content to scroll, stopping short
 * of the document body; `null` when only the page itself scrolls.
 */
export function scrollingAncestor(node: Element): HTMLElement | null {
	let parent = node.parentElement;
	while (parent && parent !== node.ownerDocument.body) {
		let overflow = getComputedStyle(parent).overflowY;
		let scrolls = overflow === "auto" || overflow === "scroll";
		if (scrolls && parent.scrollHeight > parent.clientHeight) return parent;
		parent = parent.parentElement;
	}
	return null;
}

/**
 * Scrolls `node`'s scrolling ancestor so `node` is fully visible. `nearest` moves it by
 * the least distance plus a 16px margin, for a marker tracking the reader; `center` puts
 * it mid-box, for a sidebar opening on the current page. A visible node stays put.
 */
export function revealInScroller(node: Element, align: "nearest" | "center" = "nearest") {
	let box = scrollingAncestor(node);
	if (!box) return;
	let target = node.getBoundingClientRect();
	let frame = box.getBoundingClientRect();
	if (target.top >= frame.top && target.bottom <= frame.bottom) return;
	if (align === "center") {
		box.scrollTop += target.top - frame.top - (frame.height - target.height) / 2;
		return;
	}
	let delta = target.top < frame.top ? target.top - frame.top : target.bottom - frame.bottom;
	box.scrollTop += delta + Math.sign(delta) * 16;
}
