/**
 * Why JS: a detail sheet whose open record lives in the URL answers Esc and ↑/↓ (k/j) by
 * following its own Close and previous/next links, and moves focus into itself on open;
 * HTML wires neither a keystroke to a link nor focus to a server-opened region.
 * No-JS baseline: every link stays a link, reachable by Tab and the pointer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { isClaimedKeystroke } from "../../mixins/keymap.js";
import { matchesKeyCombo } from "../../utils/key-combo.js";

/** Attribute naming which of the sheet's links a control is, read by {@link detailSheetKeys}. */
export const DETAIL_SHEET_LINK_ATTRIBUTE = "data-detail-sheet-link";

/** Selector of the region the sheet scrolls, where ↑/↓ keep scrolling it. */
const SCROLL_REGION_SELECTOR = '[data-slot="detail-sheet-body"]';

/** The sheet's host, found from the controls the mixin sits on. */
const SHEET_SELECTOR = '[data-slot="detail-sheet"]';

/** Which link each keystroke follows; the arrows defer to the sheet's body while it has focus. */
const KEY_LINKS: readonly [combo: string, link: string, arrow: boolean][] = [
	["Escape", "close", false],
	["k", "previous", false],
	["j", "next", false],
	["ArrowUp", "previous", true],
	["ArrowDown", "next", true],
];

/**
 * Follows the `link` control inside `controls` by clicking it, so a router or frame that
 * intercepts link clicks takes the navigation exactly as it would a pointer press.
 *
 * @returns Whether a link with an `href` was there to follow.
 */
function follow(controls: Element, link: string): boolean {
	let anchor = controls.querySelector<HTMLAnchorElement>(
		`a[${DETAIL_SHEET_LINK_ATTRIBUTE}="${link}"][href]`,
	);
	if (anchor === null) return false;
	anchor.click();
	return true;
}

/**
 * Moves focus to the sheet when nothing else holds it, which is the state a page loads
 * in; a reader already working in the list keeps their place.
 */
function focusSheet(controls: Element): void {
	let sheet = controls.closest<HTMLElement>(SHEET_SELECTOR);
	let active = controls.ownerDocument.activeElement;
	if (sheet === null || (active !== null && active !== controls.ownerDocument.body)) return;
	sheet.focus({ preventScroll: true });
}

/**
 * Binds the sheet's keys to the document for as long as the controls stay mounted: Esc
 * follows Close unless a popover is open (the popover takes it), k/j and ↑/↓ follow
 * previous/next. Keys typed in a field, or claimed nearer their target, pass through.
 *
 * @returns A mixin descriptor for the sheet's controls.
 * @example <div mix={[detailSheetKeys()]}>{links}</div>
 */
export const detailSheetKeys: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	handle.addEventListener("insert", (event) => {
		let controls = event.node;
		let document = controls.ownerDocument;
		focusSheet(controls);

		document.addEventListener(
			"keydown",
			(keystroke) => {
				if (isClaimedKeystroke(keystroke)) return;
				let match = KEY_LINKS.find(([combo]) => matchesKeyCombo(keystroke, combo));
				if (match === undefined) return;

				let [, link, arrow] = match;
				if (link === "close" && document.querySelector(":popover-open") !== null) return;
				let target = keystroke.target instanceof Element ? keystroke.target : null;
				if (arrow && target?.closest(SCROLL_REGION_SELECTOR)) return;

				if (follow(controls, link)) keystroke.preventDefault();
			},
			{ signal: handle.signal },
		);
	});

	return () => undefined;
});
