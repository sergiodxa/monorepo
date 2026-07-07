/**
 * The learn-move scene: replace a move or skip when a full moveset can learn one.
 *
 * Shown after the engine reports a `can-learn-move` event (a creature reached a
 * level whose move it could learn, but its four slots are full). It lists the four
 * current moves plus the new move, lets the player pick a slot to overwrite or
 * cancel to skip, and dispatches `learn-move` with the chosen slot (a cancel maps
 * to an out-of-range slot the engine treats as declined). The scene is
 * self-contained — it takes the creature, the offered move, and the current
 * moveset — so whatever surface offers the move only has to push it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MoveSet } from "~/game/world/creature";
import type { CreatureId } from "~/game/world/ids";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

/** A slot index the engine reads as "declined", used when the player skips. */
const DECLINE_SLOT = -1;

/** Presents the replace-or-skip choice for one learnable move on a full moveset. */
export class LearnMoveScene implements Scene {
	/** The five-row selection: the four current slots plus a trailing "skip" row. */
	private readonly menu = new ListMenu(5);

	/** True once a choice has been dispatched; the scene then waits for a dismiss. */
	private resolved = false;

	/** The narration shown after the choice resolves. */
	private outcome: string | null = null;

	/**
	 * @param creatureId - The creature that can learn the move.
	 * @param moveId - The move offered (shown by its content id).
	 * @param currentMoveset - The creature's four move slots at offer time.
	 * @param creatureName - The creature's display name, for the prompt.
	 */
	constructor(
		private readonly creatureId: CreatureId,
		private readonly moveId: string,
		private readonly currentMoveset: MoveSet,
		private readonly creatureName: string,
	) {}

	enter(game: GameClient) {
		this.menu.useAudio(game.audio);
	}

	exit() {}

	update(game: GameClient) {
		if (this.resolved) {
			if (game.input.isPressed(Button.A) || game.input.isPressed(Button.B)) game.scenes.pop();
			return;
		}

		// Rows 0-3 replace a slot; the last row (index 4) skips.
		let rowCount = this.currentMoveset.length + 1;
		this.menu.update(game.input, rowCount);

		if (this.menu.cancelled(game.input)) {
			this.dispatch(game, DECLINE_SLOT);
			return;
		}
		if (this.menu.confirmed(game.input)) {
			let slot = this.menu.selected;
			this.dispatch(game, slot < this.currentMoveset.length ? slot : DECLINE_SLOT);
		}
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.summary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		if (this.resolved) {
			Window.frame(ctx, 20, 64, 200, 40);
			drawText(ctx, this.outcome ?? "", 120, 78, { align: "center" });
			drawText(ctx, "Press a button", 120, 92, { align: "center", color: theme.TEXT.muted });
			return;
		}

		drawText(ctx, `${this.creatureName} wants to learn ${this.moveId}.`, 120, 12, {
			align: "center",
		});
		drawText(ctx, "But its moves are full. Replace one?", 120, 26, {
			align: "center",
			color: theme.TEXT.muted,
		});

		this.menu.render(ctx, this.rows(), 40, 44, 160);
		drawText(ctx, "A: Choose    B: Skip", 120, SCREEN_HEIGHT - 12, {
			align: "center",
			color: theme.TEXT.muted,
		});
	}

	/** The selectable rows: each current move, then a skip row. */
	private rows(): string[] {
		let moves = this.currentMoveset.map((slot, index) => `${index + 1}. ${slot ?? "-"}`);
		return [...moves, `Skip (keep current moves)`];
	}

	/** Dispatches the learn-move command and records the resulting narration. */
	private dispatch(game: GameClient, replaceSlotIndex: number) {
		game.dispatch({
			type: "learn-move",
			creatureId: this.creatureId,
			moveId: this.moveId,
			replaceSlotIndex,
		});
		this.resolved = true;
		this.outcome =
			replaceSlotIndex < 0 || replaceSlotIndex >= this.currentMoveset.length
				? `${this.creatureName} did not learn ${this.moveId}.`
				: `${this.creatureName} learned ${this.moveId}!`;
	}
}
