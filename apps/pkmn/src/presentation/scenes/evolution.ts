/**
 * The evolution scene: confirm or cancel a creature's evolution.
 *
 * Confirming dispatches `evolve-creature` to swap the species; cancelling
 * leaves it unchanged. It carries the creature and target species itself, so
 * any surface offering an evolution only has to push it.
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

/** Presents and applies one evolution. */
export class EvolutionScene implements Scene {
	/** True once the evolution has been dispatched. */
	private evolved = false;

	/**
	 * @param creatureId - The creature that may evolve.
	 * @param speciesId - The species it would evolve into.
	 * @param fromName - The current display name, for the prompt.
	 */
	constructor(
		private readonly creatureId: CreatureId,
		private readonly speciesId: string,
		private readonly fromName: string,
	) {}

	enter() {}

	exit() {}

	update(game: GameClient) {
		if (this.evolved) {
			if (game.input.isPressed(Button.A) || game.input.isPressed(Button.B)) game.scenes.pop();
			return;
		}
		if (game.input.isPressed(Button.A)) {
			game.dispatch({
				type: "evolve-creature",
				creatureId: this.creatureId,
				speciesId: this.speciesId,
			});
			this.evolved = true;
		} else if (game.input.isPressed(Button.B)) {
			game.scenes.pop();
		}
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.evolution;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		Window.frame(ctx, 20, 56, 200, 48);
		if (this.evolved) {
			drawText(ctx, `${this.fromName} evolved into ${this.speciesId}!`, 120, 72, {
				align: "center",
			});
			drawText(ctx, "Press a button", 120, 90, { align: "center", color: theme.TEXT.muted });
		} else {
			drawText(ctx, `${this.fromName} is evolving into ${this.speciesId}!`, 120, 68, {
				align: "center",
			});
			drawText(ctx, "A: Evolve    B: Cancel", 120, 90, {
				align: "center",
				color: theme.TEXT.muted,
			});
		}
	}
}
