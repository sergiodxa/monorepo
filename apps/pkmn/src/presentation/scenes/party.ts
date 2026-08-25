/**
 * The party screen: the player's creatures at a glance.
 *
 * Reads the party view from the engine and lists each creature with level
 * and HP; confirming one opens its summary, cancelling returns to the pause
 * menu. Engine access stays read-only, expressed entirely through selectors.
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

import { SummaryScene } from "./summary";

/** Lists the party and opens a creature's summary. */
export class PartyScene implements Scene {
	private readonly list = new ListMenu(6);

	enter(game: GameClient) {
		this.list.useAudio(game.audio);
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let party = game.engine.selectParty();
		this.list.update(game.input, party.creatures.length);
		if (this.list.cancelled(game.input)) {
			game.scenes.pop();
			return;
		}
		if (this.list.confirmed(game.input)) {
			let creature = party.creatures[this.list.selected];
			if (creature) game.scenes.push(new SummaryScene(creature.id));
		}
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.party;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, "PARTY", 8, 6, { color: theme.TEXT.default });

		let party = game.engine.selectParty();
		let items = party.creatures.map(
			(creature) =>
				`${creature.name}  L${creature.level}  ${creature.currentHP}/${creature.maxHP}${
					creature.status ? `  ${creature.status}` : ""
				}`,
		);
		this.list.render(ctx, items, 8, 20, 224);
	}
}
