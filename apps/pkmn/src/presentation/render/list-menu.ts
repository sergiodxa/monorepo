/**
 * A reusable vertical list menu with a scrolling window.
 *
 * Menus across the game (pause root, party, bag, bestiary, storage) share the
 * same behavior: move a cursor with the D-pad (wrapping, with key-repeat), keep
 * the selection inside a fixed number of visible rows, and confirm or cancel with
 * A/B. This widget owns only that selection state and its drawing, so each scene
 * supplies the item labels and decides what confirming means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Button, type InputManager } from "../core/input";

import { drawText } from "./text";
import { TEXT } from "./theme";
import { Window } from "./window";

/** Tracks selection in a scrolling vertical list. */
export class ListMenu {
	/** Index of the highlighted row. */
	private index = 0;

	/** First visible row when the list is longer than the window. */
	private scroll = 0;

	/** @param rows - How many rows are visible at once. */
	constructor(private readonly rows = 5) {}

	/** Moves the cursor from input, clamped and scrolled to a list of `count` items. */
	update(input: InputManager, count: number) {
		if (count === 0) {
			this.index = 0;
			this.scroll = 0;
			return;
		}
		if (input.isRepeating(Button.Down)) this.index = (this.index + 1) % count;
		if (input.isRepeating(Button.Up)) this.index = (this.index - 1 + count) % count;
		if (this.index >= count) this.index = count - 1;

		if (this.index < this.scroll) this.scroll = this.index;
		if (this.index >= this.scroll + this.rows) this.scroll = this.index - this.rows + 1;
		let maxScroll = Math.max(0, count - this.rows);
		if (this.scroll > maxScroll) this.scroll = maxScroll;
	}

	/** True when A was pressed this frame. */
	confirmed(input: InputManager): boolean {
		return input.isPressed(Button.A);
	}

	/** True when B was pressed this frame. */
	cancelled(input: InputManager): boolean {
		return input.isPressed(Button.B);
	}

	/** The highlighted index. */
	get selected(): number {
		return this.index;
	}

	/** Resets selection and scroll to the top. */
	reset() {
		this.index = 0;
		this.scroll = 0;
	}

	/** Draws a framed list panel of the visible rows with a cursor and scroll arrows. */
	render(ctx: CanvasRenderingContext2D, items: string[], x: number, y: number, width: number) {
		let height = this.rows * 14 + 8;
		Window.frame(ctx, x, y, width, height);

		let end = Math.min(items.length, this.scroll + this.rows);
		for (let row = this.scroll; row < end; row++) {
			let drawY = y + 6 + (row - this.scroll) * 14;
			if (row === this.index) Window.cursor(ctx, x + 4, drawY + 1);
			drawText(ctx, items[row] ?? "", x + 14, drawY, { color: TEXT.default });
		}

		if (this.scroll > 0) drawText(ctx, "▲", x + width - 12, y + 4, { color: TEXT.muted });
		if (end < items.length) {
			drawText(ctx, "▼", x + width - 12, y + height - 12, { color: TEXT.muted });
		}
	}
}
