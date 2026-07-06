/**
 * The storage screen: withdraw creatures from the first box.
 *
 * Reads the storage view and lists the first box's creatures; confirming one
 * dispatches `withdraw-creature` to move it into the party, and cancel returns to
 * the pause menu. A fuller box-to-box interface is future work; this covers the
 * common "pull a reserve into the party" flow through the shipped commands.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import { SceneBackground, Text } from "../render/theme";

/** Lists the first storage box and withdraws to the party. */
export class StorageScene implements Scene {
	/** The list widget for box contents. */
	private readonly list = new ListMenu(6);

	enter() {
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let box = game.engine.selectStorage().boxes[0];
		this.list.update(game.input, box?.creatures.length ?? 0);
		if (this.list.cancelled(game.input)) {
			game.scenes.pop();
			return;
		}
		if (this.list.confirmed(game.input) && box) {
			let creature = box.creatures[this.list.selected];
			if (creature) {
				game.dispatch({
					type: "withdraw-creature",
					playerId: game.engine.selectPlayer().id,
					creatureId: creature.id,
					boxId: box.id,
				});
			}
		}
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = SceneBackground.storage;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		let storage = game.engine.selectStorage();
		let box = storage.boxes[0];
		let party = game.engine.selectParty();
		drawText(ctx, `STORAGE  ${box?.name ?? "-"}  (A: withdraw)`, 8, 6, { color: Text.default });
		drawText(ctx, `Party: ${party.creatures.length}/6`, 226, 6, {
			align: "right",
			color: Text.secondary,
		});

		let creatures = box?.creatures ?? [];
		if (creatures.length === 0) {
			drawText(ctx, "This box is empty.", 16, 30, { color: Text.muted });
			return;
		}
		let items = creatures.map((creature) => `${creature.name}  L${creature.level}`);
		this.list.render(ctx, items, 8, 20, 224);
	}
}
