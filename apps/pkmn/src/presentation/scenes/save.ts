/**
 * The save screen: confirm and write the local save.
 *
 * On confirm it composes the save envelope from the engine snapshot and the
 * presentation snapshot it was opened with, stamps the current time, and writes
 * it to the single local slot. Saving is only reachable from the pause menu,
 * which is only reachable outside battle, matching the engine's rule that battles
 * are ephemeral.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { PresentationSave } from "../core/save";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { drawText } from "../render/text";
import { SceneBackground, Text } from "../render/theme";
import { Window } from "../render/window";

/** Confirms and writes a save. */
export class SaveScene implements Scene {
	/** True once the save has been written. */
	private saved = false;

	/** @param presentation - The presentation state captured when the menu opened. */
	constructor(private readonly presentation: PresentationSave) {}

	enter() {}

	exit() {}

	update(game: GameClient) {
		if (this.saved) {
			if (game.input.isPressed(Button.A) || game.input.isPressed(Button.B)) game.scenes.pop();
			return;
		}
		if (game.input.isPressed(Button.A)) {
			game.save.save(game.engine.snapshot(), this.presentation, new Date().toISOString());
			this.saved = true;
		} else if (game.input.isPressed(Button.B)) {
			game.scenes.pop();
		}
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = SceneBackground.save;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		Window.frame(ctx, 30, 60, 180, 44);
		if (this.saved) {
			drawText(ctx, "Game saved!", 120, 74, { align: "center" });
			drawText(ctx, "Press a button", 120, 90, { align: "center", color: Text.muted });
		} else {
			drawText(ctx, "Save your game?", 120, 74, { align: "center" });
			drawText(ctx, "A: Yes    B: No", 120, 90, { align: "center", color: Text.muted });
		}
	}
}
