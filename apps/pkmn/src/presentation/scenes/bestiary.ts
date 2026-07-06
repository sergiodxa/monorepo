/**
 * The bestiary screen: seen and caught progress.
 *
 * Reads the bestiary view and lists every recorded species with its seen/caught
 * state, scrolling through the roster. Cancel returns to the pause menu. It only
 * reads selectors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import { SCENE_BACKGROUND, TEXT } from "../render/theme";

/** Lists bestiary progress. */
export class BestiaryScene implements Scene {
	/** The list widget for bestiary rows. */
	private readonly list = new ListMenu(8);

	enter() {
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let bestiary = game.engine.selectBestiary();
		this.list.update(game.input, bestiary.entries.length);
		if (this.list.cancelled(game.input)) game.scenes.pop();
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = SCENE_BACKGROUND.bestiary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		let bestiary = game.engine.selectBestiary();
		let caught = bestiary.entries.filter((entry) => entry.caught).length;
		let seen = bestiary.entries.filter((entry) => entry.seen).length;
		drawText(ctx, `BESTIARY  seen ${seen}  caught ${caught}`, 8, 6, { color: TEXT.default });

		if (bestiary.entries.length === 0) {
			drawText(ctx, "No sightings yet.", 16, 30, { color: TEXT.muted });
			return;
		}
		let items = bestiary.entries.map(
			(entry) => `${entry.name}  ${entry.caught ? "◆ caught" : entry.seen ? "○ seen" : "-"}`,
		);
		this.list.render(ctx, items, 8, 20, 224);
	}
}
