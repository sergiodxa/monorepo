/**
 * The summary screen: one creature's stats and moves.
 *
 * Reads a single creature summary from the engine and lays out its name, level,
 * species, HP, status, and moveset with PP. Cancel returns to the party list.
 * Read-only: it dispatches nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CreatureId } from "~/game/world/ids";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

/** Shows one creature's details. */
export class SummaryScene implements Scene {
	/** @param creatureId - The creature to summarize. */
	constructor(private readonly creatureId: CreatureId) {}

	enter() {}

	exit() {}

	update(game: GameClient) {
		if (game.input.isPressed(Button.B)) game.scenes.pop();
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.summary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		let creature = game.engine.selectCreatureSummary(this.creatureId);
		Window.frame(ctx, 6, 6, 228, 52);
		drawText(ctx, creature.name, 14, 12);
		drawText(ctx, `L${creature.level}`, 226, 12, { align: "right" });
		drawText(ctx, `Species: ${creature.speciesId}`, 14, 26, { color: theme.TEXT.secondary });
		drawText(ctx, `HP ${creature.currentHP}/${creature.maxHP}`, 14, 40, {
			color: theme.TEXT.secondary,
		});
		drawText(ctx, `Status: ${creature.status ?? "OK"}`, 140, 40, { color: theme.TEXT.secondary });

		Window.frame(ctx, 6, 64, 228, 88);
		drawText(ctx, "MOVES", 14, 70, { color: theme.TEXT.default });
		creature.moves.forEach((move, index) => {
			let y = 86 + index * 15;
			drawText(ctx, move.id ?? "-", 20, y);
			drawText(ctx, `PP ${move.pp}`, 220, y, { align: "right", color: theme.TEXT.muted });
		});
	}
}
