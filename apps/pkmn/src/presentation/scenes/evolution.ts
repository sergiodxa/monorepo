/**
 * The evolution scene: confirm or cancel a creature's evolution.
 *
 * Shown after the engine reports a creature can evolve (a planned
 * `creature-can-evolve` event); it presents the choice and, on confirm,
 * dispatches `evolve-creature` to swap the species, or cancels back. The scene is
 * self-contained — it takes the creature and target species — so whatever surface
 * offers the evolution only has to push it.
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
		ctx.fillStyle = "#101828";
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		Window.frame(ctx, 20, 56, 200, 48);
		if (this.evolved) {
			drawText(ctx, `${this.fromName} evolved into ${this.speciesId}!`, 120, 72, {
				align: "center",
			});
			drawText(ctx, "Press a button", 120, 90, { align: "center", color: "#606060" });
		} else {
			drawText(ctx, `${this.fromName} is evolving into ${this.speciesId}!`, 120, 68, {
				align: "center",
			});
			drawText(ctx, "A: Evolve    B: Cancel", 120, 90, { align: "center", color: "#606060" });
		}
	}
}
