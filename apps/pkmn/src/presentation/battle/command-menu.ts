/**
 * The in-battle command menu.
 *
 * Presents the classic root choice (Fight, Bag, Creatures, Run) and a Fight
 * submenu listing the active creature's four moves with PP, disabling those out
 * of PP. It owns only selection state and input handling, returning a decision to
 * the battle scene when the player confirms; the scene decides what each decision
 * dispatches. Drawing uses the shared window and cursor so it matches every other
 * menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Button, type InputManager } from "../core/input";
import { SCREEN_WIDTH } from "../core/loop";
import { gridNavigate } from "../render/grid-nav";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

import { columnWidthFor } from "./status-layout";

/** Columns in the move menu's grid; moves fill two per row (matches `renderMoves`). */
const MOVE_COLUMNS = 2;

/** Pixels reserved left of each root label for the selection cursor. */
const ROOT_CURSOR_GAP = 10;

/** Extra pixels between one root column's label and the next column's cursor. */
const ROOT_COLUMN_GAP = 4;

/** Pixels from the box's left edge to the first column's label. */
const ROOT_LABEL_INSET = 8;

/** Right padding inside the root box after the widest second-column label. */
const ROOT_RIGHT_PAD = 6;

/** One selectable move in the Fight submenu. */
export interface MoveOption {
	id: string | null;
	pp: number;
}

/** A confirmed battle-menu decision handed back to the scene. */
export type BattleMenuResult =
	| { kind: "fight"; move: 0 | 1 | 2 | 3 }
	| { kind: "bag" }
	| { kind: "switch" }
	| { kind: "run" };

/** Root menu labels in navigation order (a 2x2 grid). */
const ROOT_LABELS = ["Fight", "Bag", "Creatures", "Run"] as const;

/** The pixel geometry of the root action menu's two-column grid. */
export interface RootMenuLayout {
	/** Horizontal distance from one column's label to the next column's label. */
	stride: number;
	/** Total width of the framed box. */
	boxWidth: number;
}

/**
 * Sizes the root action menu's columns so labels never collide.
 *
 * The column stride is the widest label ("Creatures") plus room for the next
 * column's cursor and a gap, and the box is wide enough to hold both columns: the
 * label inset, one stride, the widest second-column label, and right padding. This
 * is the pure width math behind `renderRoot`, kept testable so the "CreaturesRun"
 * overrun cannot regress.
 */
export function rootMenuLayout(): RootMenuLayout {
	let stride = columnWidthFor(ROOT_LABELS, ROOT_CURSOR_GAP + ROOT_COLUMN_GAP);
	let widest = columnWidthFor(ROOT_LABELS, 0);
	let boxWidth = ROOT_LABEL_INSET + stride + widest + ROOT_RIGHT_PAD;
	return { stride, boxWidth };
}

/** Handles battle-menu navigation and rendering. */
export class BattleCommandMenu {
	/** Whether the root grid or the move list is showing. */
	private mode: "root" | "moves" = "root";

	/** Selected index in the 2x2 root grid. */
	private rootIndex = 0;

	/** Selected index in the move list. */
	private moveIndex = 0;

	/** Returns the menu to its root state. */
	reset() {
		this.mode = "root";
		this.rootIndex = 0;
		this.moveIndex = 0;
	}

	/** Advances the menu from input, returning a decision when one is confirmed. */
	update(input: InputManager, moves: MoveOption[]): BattleMenuResult | null {
		if (this.mode === "moves") return this.updateMoves(input, moves);
		return this.updateRoot(input);
	}

	/** Draws the active menu panel at the bottom of the screen. */
	render(ctx: CanvasRenderingContext2D, moves: MoveOption[]) {
		if (this.mode === "moves") this.renderMoves(ctx, moves);
		else this.renderRoot(ctx);
	}

	/** Handles the root 2x2 grid (column 0/1 = left/right, row 0/1 = top/bottom). */
	private updateRoot(input: InputManager): BattleMenuResult | null {
		let column = this.rootIndex % 2;
		let row = this.rootIndex < 2 ? 0 : 1;
		if (input.isRepeating(Button.Left)) column = 0;
		if (input.isRepeating(Button.Right)) column = 1;
		if (input.isRepeating(Button.Up)) row = 0;
		if (input.isRepeating(Button.Down)) row = 1;
		this.rootIndex = row * 2 + column;

		if (input.isPressed(Button.A)) {
			switch (ROOT_LABELS[this.rootIndex]) {
				case "Fight":
					this.mode = "moves";
					this.moveIndex = 0;
					return null;
				case "Bag":
					return { kind: "bag" };
				case "Creatures":
					return { kind: "switch" };
				case "Run":
					return { kind: "run" };
			}
		}
		return null;
	}

	/** Handles the move list. */
	private updateMoves(input: InputManager, moves: MoveOption[]): BattleMenuResult | null {
		let usable = moves.filter((move) => move.id !== null);
		if (usable.length === 0) return null;

		// Moves render as a 2-column grid, so navigation follows the grid the player
		// sees: Left/Right step columns, Up/Down step rows.
		if (input.isRepeating(Button.Right))
			this.moveIndex = gridNavigate(this.moveIndex, "right", MOVE_COLUMNS, usable.length);
		if (input.isRepeating(Button.Left))
			this.moveIndex = gridNavigate(this.moveIndex, "left", MOVE_COLUMNS, usable.length);
		if (input.isRepeating(Button.Down))
			this.moveIndex = gridNavigate(this.moveIndex, "down", MOVE_COLUMNS, usable.length);
		if (input.isRepeating(Button.Up))
			this.moveIndex = gridNavigate(this.moveIndex, "up", MOVE_COLUMNS, usable.length);
		if (input.isPressed(Button.B)) {
			this.mode = "root";
			return null;
		}
		if (input.isPressed(Button.A)) {
			let move = usable[this.moveIndex];
			if (move && move.pp > 0) return { kind: "fight", move: this.moveIndex as 0 | 1 | 2 | 3 };
		}
		return null;
	}

	/**
	 * Draws the 2x2 root grid.
	 *
	 * Column stride is sized from the widest label ("Creatures") plus room for the
	 * cursor and a gap, so no label ever overruns the next column ("CreaturesRun").
	 * The box is anchored to the screen's right edge and widened left to hold both
	 * columns.
	 */
	private renderRoot(ctx: CanvasRenderingContext2D) {
		let layout = rootMenuLayout();
		let boxX = SCREEN_WIDTH - layout.boxWidth;
		Window.frame(ctx, boxX, 112, layout.boxWidth, 48);
		for (let index = 0; index < ROOT_LABELS.length; index++) {
			let x = boxX + ROOT_LABEL_INSET + (index % 2) * layout.stride;
			let y = 122 + Math.floor(index / 2) * 18;
			if (index === this.rootIndex) Window.cursor(ctx, x - ROOT_CURSOR_GAP, y);
			drawText(ctx, ROOT_LABELS[index]!, x, y);
		}
	}

	/** Draws the move list with PP. */
	private renderMoves(ctx: CanvasRenderingContext2D, moves: MoveOption[]) {
		let usable = moves.filter((move) => move.id !== null);
		Window.frame(ctx, 4, 112, 236, 48);
		for (let index = 0; index < usable.length; index++) {
			let move = usable[index]!;
			let x = 18 + (index % 2) * 116;
			let y = 122 + Math.floor(index / 2) * 18;
			if (index === this.moveIndex) Window.cursor(ctx, x - 10, y);
			drawText(ctx, move.id ?? "-", x, y, {
				color: move.pp > 0 ? theme.TEXT.default : theme.TEXT.disabled,
			});
			drawText(ctx, `PP ${move.pp}`, x + 78, y, { color: theme.TEXT.muted });
		}
	}
}
