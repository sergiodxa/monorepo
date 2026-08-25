/**
 * A reusable vertical list menu with a scrolling window.
 *
 * Menus across the game share cursor, scroll, and confirm/cancel behavior;
 * this widget owns only that selection state and its drawing, so each scene
 * supplies the item labels and decides what confirming means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SfxPlayer } from "../battle/battle-sfx";

import { Button, type InputManager } from "../core/input";

import { gridNavigate } from "./grid-nav";
import { drawText } from "./text";
import * as theme from "./theme";
import { Window } from "./window";

/** Tracks selection in a scrolling vertical list. */
export class ListMenu {
	/** Index of the highlighted row. */
	private index = 0;

	/** First visible row when the list is longer than the window. */
	private scroll = 0;

	/**
	 * @param rows - How many rows are visible at once.
	 * @param audio - Optional effect player; when given, cursor moves blip
	 *   `menu-move` and confirm/cancel blip `menu-confirm`/`menu-cancel`. Omitting
	 *   it (the default) keeps the widget silent and its behavior unchanged.
	 * @param columns - Items per row. The default `1` keeps the classic linear
	 *   Up/Down navigation; a value above 1 opts into grid navigation where
	 *   Left/Right step within a row and Up/Down step between rows, matching a
	 *   grid layout the caller draws. Other menus that omit it are unaffected.
	 */
	constructor(
		private readonly rows = 5,
		private audio?: SfxPlayer,
		private readonly columns = 1,
	) {}

	/**
	 * Attaches (or replaces) the effect player after construction, since scenes
	 * build the menu as a field initializer before `enter(game)` supplies the
	 * client, and call this from `enter` once it does.
	 */
	useAudio(audio: SfxPlayer): this {
		this.audio = audio;
		return this;
	}

	/**
	 * Moves the cursor from input, clamped and scrolled to a list of `count`
	 * items. Scroll tracks the visible window in row units, and in grid mode a
	 * row is the index divided by the column count.
	 */
	update(input: InputManager, count: number) {
		if (count === 0) {
			this.index = 0;
			this.scroll = 0;
			return;
		}
		let before = this.index;
		if (this.columns > 1) {
			if (input.isRepeating(Button.Right))
				this.index = gridNavigate(this.index, "right", this.columns, count);
			if (input.isRepeating(Button.Left))
				this.index = gridNavigate(this.index, "left", this.columns, count);
			if (input.isRepeating(Button.Down))
				this.index = gridNavigate(this.index, "down", this.columns, count);
			if (input.isRepeating(Button.Up))
				this.index = gridNavigate(this.index, "up", this.columns, count);
		} else {
			if (input.isRepeating(Button.Down)) this.index = (this.index + 1) % count;
			if (input.isRepeating(Button.Up)) this.index = (this.index - 1 + count) % count;
		}
		if (this.index >= count) this.index = count - 1;
		if (this.index !== before) this.audio?.playSynthSfx("menu-move");

		let cursorRow = Math.floor(this.index / this.columns);
		let totalRows = Math.ceil(count / this.columns);
		if (cursorRow < this.scroll) this.scroll = cursorRow;
		if (cursorRow >= this.scroll + this.rows) this.scroll = cursorRow - this.rows + 1;
		let maxScroll = Math.max(0, totalRows - this.rows);
		if (this.scroll > maxScroll) this.scroll = maxScroll;
	}

	/** True when A was pressed this frame; blips `menu-confirm` on the press. */
	confirmed(input: InputManager): boolean {
		let pressed = input.isPressed(Button.A);
		if (pressed) this.audio?.playSynthSfx("menu-confirm");
		return pressed;
	}

	/** True when B was pressed this frame; blips `menu-cancel` on the press. */
	cancelled(input: InputManager): boolean {
		let pressed = input.isPressed(Button.B);
		if (pressed) this.audio?.playSynthSfx("menu-cancel");
		return pressed;
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
			drawText(ctx, items[row] ?? "", x + 14, drawY, { color: theme.TEXT.default });
		}

		if (this.scroll > 0) drawText(ctx, "▲", x + width - 12, y + 4, { color: theme.TEXT.muted });
		if (end < items.length) {
			drawText(ctx, "▼", x + width - 12, y + height - 12, { color: theme.TEXT.muted });
		}
	}
}
