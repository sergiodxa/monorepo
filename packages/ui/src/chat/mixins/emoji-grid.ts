/**
 * Wires an emoji picker's popover: each opening starts with an empty, focused filter, the
 * arrow keys walk the grid, Enter in the filter picks the first match, and an insert-mode pick
 * lands at the composer's caret. Why JS: filtering and keys need script. No-JS baseline: the
 * popover opens natively and submit-mode emoji post their form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { findComposerInput, replaceText } from "../utils/composer-text.js";

/** The attribute every emoji button carries with its emoji, in grid order. */
export const EMOJI_ATTRIBUTE = "data-emoji";

/** The attribute the picker's filter field carries. */
export const EMOJI_SEARCH_ATTRIBUTE = "data-emoji-search";

/** Options for {@link emojiGrid}. */
export interface EmojiGridOptions {
	/** Whether each emoji submits its form, rather than being written into a field. */
	submit: boolean;
	/** The `id` of the `<textarea>` a pick is written into; the host form's `Composer.Input` when omitted. */
	target?: string;
	/** Told when the filter changes. */
	onQuery: (query: string) => void;
	/** Told which emoji now holds the grid's one tab stop. */
	onCurrent: (char: string | undefined) => void;
	/** Told when the popover opens, and resolves once the host rendered an empty filter. */
	onOpen: () => Promise<unknown>;
}

/**
 * The button the arrow keys reach from `from`: the nearest one on the next row up or down,
 * in whichever group it sits, closest to `from` horizontally.
 *
 * @returns The button, or `undefined` when `from` is on the first or last row.
 */
function verticalNeighbor(
	buttons: readonly HTMLElement[],
	from: HTMLElement,
	direction: 1 | -1,
): HTMLElement | undefined {
	let origin = from.getBoundingClientRect();
	let center = origin.left + origin.width / 2;
	let rows = buttons
		.map((button) => ({ button, box: button.getBoundingClientRect() }))
		.filter(({ box }) =>
			direction === 1 ? box.top > origin.bottom - 1 : box.bottom < origin.top + 1,
		);
	if (rows.length === 0) return undefined;
	let edges = rows.map(({ box }) => box.top);
	let row = direction === 1 ? Math.min(...edges) : Math.max(...edges);
	let best: { button: HTMLElement; distance: number } | undefined;
	for (let { button, box } of rows) {
		if (Math.abs(box.top - row) > 1) continue;
		let distance = Math.abs(box.left + box.width / 2 - center);
		if (best === undefined || distance < best.distance) best = { button, distance };
	}
	return best?.button;
}

/**
 * Put on the picker's `popover` element, which holds a `[data-emoji-search]` field and
 * `[data-emoji]` buttons. A pick closes the popover; in insert mode it also returns focus to
 * the field with the emoji written at its caret.
 *
 * @example <Popover id="emoji" mix={[emojiGrid({ submit: false, onQuery, onCurrent, onOpen })]}>…</Popover>
 */
export const emojiGrid: MixinFactory<HTMLElement, [options: EmojiGridOptions]> = createMixin<
	HTMLElement,
	[options: EmojiGridOptions]
>((handle) => {
	let options: EmojiGridOptions | undefined;
	let panel: HTMLElement | undefined;

	/** Every emoji button the filter leaves, in grid order. */
	function buttons(): HTMLElement[] {
		return panel === undefined
			? []
			: Array.from(panel.querySelectorAll<HTMLElement>(`[${EMOJI_ATTRIBUTE}]`));
	}

	/** The filter field. */
	function search(): HTMLInputElement | null {
		return panel?.querySelector<HTMLInputElement>(`[${EMOJI_SEARCH_ATTRIBUTE}]`) ?? null;
	}

	/** Moves focus, and the grid's tab stop, to `button`. */
	function focus(button: HTMLElement | undefined) {
		if (button === undefined) return;
		for (let other of buttons()) other.tabIndex = other === button ? 0 : -1;
		options?.onCurrent(button.getAttribute(EMOJI_ATTRIBUTE) ?? undefined);
		button.focus();
	}

	/** Steers the grid with the arrow keys, Home and End. */
	function onGridKeydown(event: KeyboardEvent, button: HTMLElement) {
		let list = buttons();
		let index = list.indexOf(button);
		let next: HTMLElement | undefined;
		if (event.key === "ArrowRight") next = list[index + 1];
		else if (event.key === "ArrowLeft") next = list[index - 1];
		else if (event.key === "ArrowDown") next = verticalNeighbor(list, button, 1);
		else if (event.key === "ArrowUp") next = verticalNeighbor(list, button, -1);
		else if (event.key === "Home") next = list[0];
		else if (event.key === "End") next = list.at(-1);
		else return;
		event.preventDefault();
		if (next === undefined && event.key === "ArrowUp") return search()?.focus();
		focus(next);
	}

	/**
	 * Reports the filter's text. It listens during capture, ahead of the field's own listeners,
	 * since the host renders the filter as a controlled `value` that is restored after them.
	 */
	function onInput(event: Event) {
		let field = search();
		if (event.target === field && field !== null) options?.onQuery(field.value);
	}

	/** Sends the filter's ArrowDown into the grid, and makes its Enter pick the first match. */
	function onSearchKeydown(event: KeyboardEvent) {
		let first = buttons()[0];
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focus(first);
		} else if (event.key === "Enter" && !event.isComposing) {
			event.preventDefault();
			first?.click();
		}
	}

	/** Closes the grid, and in insert mode writes the emoji at the field's caret. */
	function pick(char: string) {
		panel?.hidePopover();
		if (panel === undefined || options === undefined || options.submit) return;
		let field = findComposerInput(panel, options.target);
		if (field === null) return;
		replaceText(field, field.selectionStart, field.selectionEnd, char);
	}

	handle.addEventListener("insert", ({ node }) => {
		let signal = handle.signal;
		panel = node;
		node.addEventListener(
			"toggle",
			async (event) => {
				if (event.newState !== "open" || options === undefined) return;
				await options.onOpen();
				search()?.focus();
			},
			{ signal },
		);
		node.addEventListener("input", onInput, { capture: true, signal });
		node.addEventListener(
			"keydown",
			(event) => {
				if (!(event.target instanceof HTMLElement)) return;
				if (event.target === search()) return onSearchKeydown(event);
				if (event.target.hasAttribute(EMOJI_ATTRIBUTE)) onGridKeydown(event, event.target);
			},
			{ signal },
		);
		node.addEventListener(
			"click",
			(event) => {
				if (!(event.target instanceof Element)) return;
				let char = event.target.closest(`[${EMOJI_ATTRIBUTE}]`)?.getAttribute(EMOJI_ATTRIBUTE);
				if (char) pick(char);
			},
			{ signal },
		);
	});

	return (next) => {
		options = next;
		return handle.element;
	};
});
