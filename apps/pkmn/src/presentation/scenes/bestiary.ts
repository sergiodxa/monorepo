/**
 * The bestiary screen: seen and caught progress.
 *
 * Confirming a species the player has seen opens its detail dossier; an entry
 * that is only recorded stays closed, matching the list's seen/caught gating.
 * Cancel returns to the pause menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";

import { SpeciesDetailScene } from "./species-detail";

/** Lists bestiary progress. */
export class BestiaryScene implements Scene {
	/** The list widget for bestiary rows. */
	private readonly list = new ListMenu(8);

	enter(game: GameClient) {
		this.list.useAudio(game.audio);
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let bestiary = game.engine.selectBestiary();
		this.list.update(game.input, bestiary.entries.length);
		if (this.list.cancelled(game.input)) {
			game.scenes.pop();
			return;
		}

		if (this.list.confirmed(game.input)) {
			let entry = bestiary.entries[this.list.selected];
			if (entry?.seen) game.scenes.push(new SpeciesDetailScene(entry.speciesId));
		}
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.bestiary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		let bestiary = game.engine.selectBestiary();
		let caught = bestiary.entries.filter((entry) => entry.caught).length;
		let seen = bestiary.entries.filter((entry) => entry.seen).length;
		drawText(ctx, `BESTIARY  seen ${seen}  caught ${caught}`, 8, 6, { color: theme.TEXT.default });

		if (bestiary.entries.length === 0) {
			drawText(ctx, "No sightings yet.", 16, 30, { color: theme.TEXT.muted });
			return;
		}
		let items = bestiary.entries.map(
			(entry) => `${entry.name}  ${entry.caught ? "◆ caught" : entry.seen ? "○ seen" : "-"}`,
		);
		this.list.render(ctx, items, 8, 20, 224);
	}
}
