/**
 * The bag screen: browse the inventory and use a creature-targeting item.
 *
 * Reads the inventory view and lists each item with its category and count.
 * Confirming an item that acts on a single creature — an evolution stone or a
 * recovery medicine — opens the party picker; choosing a member dispatches the
 * matching command (`use-item-on-creature` for a stone, `use-medicine` for a
 * medicine) and reports whether it took effect. Any other item, or backing out
 * of the picker, changes nothing. Cancel returns to the pause menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Item } from "~/game/data/item";
import type { CreatureId } from "~/game/world/ids";

import { isMedicineEffect } from "~/game/systems/medicine-system";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { HERO_ID } from "../core/new-game";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";

import { DialogueScene } from "./dialogue";
import { ItemTargetScene } from "./item-target";

/** How a confirmed bag item is used against a single creature, if at all. */
export type BagItemAction = "evolution" | "medicine" | null;

/**
 * Classifies how one item is used on a creature from the bag.
 *
 * Evolution items open the stone flow, medicine items whose effect recovers HP or
 * status open the medicine flow, and everything else (held items, capture balls,
 * PP/EV items, unknown records) returns null so the bag leaves them browse-only.
 */
export function bagItemAction(item: Item | undefined): BagItemAction {
	if (!item) return null;
	if (item.category === "evolution") return "evolution";
	if ("effect" in item && isMedicineEffect(item.effect)) return "medicine";
	return null;
}

/** Lists inventory contents and drives the use-on-creature flow. */
export class BagScene implements Scene {
	/** The list widget for inventory rows. */
	private readonly list = new ListMenu(8);

	enter(game: GameClient) {
		this.list.useAudio(game.audio);
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let inventory = game.engine.selectInventory(HERO_ID);
		this.list.update(game.input, inventory.entries.length);
		if (this.list.cancelled(game.input)) {
			game.scenes.pop();
			return;
		}
		if (!this.list.confirmed(game.input) || inventory.entries.length === 0) return;

		let entry = inventory.entries[this.list.selected];
		if (!entry) return;
		let action = bagItemAction(game.content.items[entry.id]);
		if (action === null) return;

		game.scenes.push(
			new ItemTargetScene({
				itemName: entry.name,
				onSelect: (creatureId) => this.useOn(game, action, entry.id, entry.name, creatureId),
			}),
		);
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.bag;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, "BAG", 8, 6, { color: theme.TEXT.default });

		let inventory = game.engine.selectInventory(HERO_ID);
		if (inventory.entries.length === 0) {
			drawText(ctx, "The bag is empty.", 16, 30, { color: theme.TEXT.muted });
			return;
		}
		let items = inventory.entries.map(
			(entry) => `${entry.name}  x${entry.count}  (${entry.category})`,
		);
		this.list.render(ctx, items, 8, 20, 224);
	}

	/**
	 * Dispatches the chosen item onto one creature and reports the outcome.
	 *
	 * Both the evolution-stone and medicine handlers are no-ops that emit nothing
	 * when the item cannot take effect (a mismatched stone, a heal at full HP), so an
	 * empty event list means "it won't have any effect" and nothing was consumed. The
	 * picker is popped back to the bag first, then a message window is shown over it.
	 */
	private useOn(
		game: GameClient,
		action: Exclude<BagItemAction, null>,
		itemId: string,
		itemName: string,
		creatureId: CreatureId,
	) {
		let events =
			action === "evolution"
				? game.dispatch({
						type: "use-item-on-creature",
						playerId: HERO_ID,
						creatureId,
						itemId,
					})
				: game.dispatch({ type: "use-medicine", playerId: HERO_ID, creatureId, itemId });

		let creature = game.engine.selectCreatureSummary(creatureId);
		let message =
			events.length === 0
				? `It won't have any effect.`
				: action === "evolution"
					? `${creature.name} evolved!`
					: `Used ${itemName} on ${creature.name}.`;

		game.scenes.pop();
		game.scenes.push(new DialogueScene([message]));
	}
}
