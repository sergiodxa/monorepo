/**
 * The title scene: New Game or Continue.
 *
 * It offers the two classic entry points and constructs the world the rest of the
 * game runs on. New Game builds a fresh world from content and swaps it into the
 * client's engine; Continue loads the save, rebuilds the engine from its
 * persistent world, and resumes at the saved map position. Either way it pushes
 * the overworld once a world exists, so no other scene has to know how a game
 * begins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Engine } from "~/game/engine";

import type { Scene } from "../core/scene";

import { GameClient } from "../core/game-client";
import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { createNewGameWorld } from "../core/new-game";
import { SAMPLE_SPAWN } from "../overworld/map-loader";
import { OverworldScene, type Spawn } from "../overworld/overworld-scene";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

/** The start-menu options in navigation order. */
const OPTIONS = ["New Game", "Continue"] as const;

/** Renders the start menu and boots a world when the player chooses. */
export class TitleScene implements Scene {
	/** Selected menu index. */
	private index = 0;

	/** Whether a save exists, checked on enter. */
	private canContinue = false;

	enter(game: GameClient) {
		this.canContinue = game.save.has();
		this.index = 0;
	}

	exit() {}

	update(game: GameClient) {
		if (game.input.isRepeating(Button.Down)) this.index = (this.index + 1) % OPTIONS.length;
		if (game.input.isRepeating(Button.Up))
			this.index = (this.index - 1 + OPTIONS.length) % OPTIONS.length;

		if (!game.input.isPressed(Button.A)) return;
		if (OPTIONS[this.index] === "New Game") this.startNewGame(game);
		else if (this.canContinue) this.continueGame(game);
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.title;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, "PKMN", SCREEN_WIDTH / 2, 40, { align: "center", color: theme.TEXT.inverse });

		Window.frame(ctx, 84, 90, 72, 44);
		for (let i = 0; i < OPTIONS.length; i++) {
			let disabled = OPTIONS[i] === "Continue" && !this.canContinue;
			if (i === this.index) Window.cursor(ctx, 92, 100 + i * 16);
			drawText(ctx, OPTIONS[i]!, 104, 100 + i * 16, {
				color: disabled ? theme.TEXT.disabled : theme.TEXT.default,
			});
		}
	}

	/** Builds a fresh world, installs it, and enters the overworld. */
	private startNewGame(game: GameClient) {
		game.engine = Engine.create({
			content: game.content,
			world: createNewGameWorld(game.content),
		});
		game.scenes.replace(new OverworldScene(SAMPLE_SPAWN));
	}

	/** Loads the save, rebuilds the engine, and resumes at the saved position. */
	private continueGame(game: GameClient) {
		let file = game.save.load();
		if (!file) return;
		game.engine = Engine.create({ content: game.content, world: file.world });
		let spawn: Spawn = {
			mapId: file.presentation.mapId,
			x: file.presentation.x,
			y: file.presentation.y,
			facing: file.presentation.facing,
		};
		game.scenes.replace(new OverworldScene(spawn));
	}
}
