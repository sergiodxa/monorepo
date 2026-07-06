/**
 * The bag screen: inventory grouped for browsing.
 *
 * Reads the inventory view and lists each item with its category and count.
 * Using items in the field routes through the planned `use-item` command, so for
 * now this screen browses only; cancel returns to the pause menu.
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

/** Lists inventory contents. */
export class BagScene implements Scene {
	/** The list widget for inventory rows. */
	private readonly list = new ListMenu(8);

	enter() {
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let inventory = game.engine.selectInventory();
		this.list.update(game.input, inventory.entries.length);
		if (this.list.cancelled(game.input)) game.scenes.pop();
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = SCENE_BACKGROUND.bag;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, "BAG", 8, 6, { color: TEXT.default });

		let inventory = game.engine.selectInventory();
		if (inventory.entries.length === 0) {
			drawText(ctx, "The bag is empty.", 16, 30, { color: TEXT.muted });
			return;
		}
		let items = inventory.entries.map(
			(entry) => `${entry.name}  x${entry.count}  (${entry.category})`,
		);
		this.list.render(ctx, items, 8, 20, 224);
	}
}
