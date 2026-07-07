/**
 * The bag screen: browse the inventory and use a creature-targeting item.
 *
 * Reads the inventory view and lists each item with its category and count.
 * Confirming an item that acts on a single creature — an evolution stone, a
 * recovery medicine, or a move-teaching machine — opens the party picker; choosing
 * a member resolves the item against that creature. Stones dispatch
 * `use-item-on-creature` and medicines `use-medicine`, each reporting whether it
 * took effect. A machine teaches its move: a creature that already knows it is a
 * no-op, a creature with a free slot learns it directly, and a full moveset opens
 * the replace-or-skip prompt. Any other item, or backing out of the picker,
 * changes nothing. Cancel returns to the pause menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Item } from "~/game/data/item";
import type { CreatureSummaryView } from "~/game/selectors";
import type { MoveSet } from "~/game/world/creature";
import type { CreatureId } from "~/game/world/ids";

import { ItemAttribute } from "~/game/data/item";
import { hasFreeMoveSlot } from "~/game/systems/learn-system";
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
import { LearnMoveScene } from "./learn-move";

/** How a confirmed bag item is used against a single creature, if at all. */
export type BagItemAction = "evolution" | "medicine" | "teach" | null;

/**
 * Classifies how one item is used on a creature from the bag.
 *
 * Evolution items open the stone flow, medicine items whose effect recovers HP or
 * status open the medicine flow, machines that teach a move open the teach flow,
 * and everything else (held items, capture balls, PP/EV items, unknown records)
 * returns null so the bag leaves them browse-only.
 */
export function bagItemAction(item: Item | undefined): BagItemAction {
	if (!item) return null;
	if (item.category === "evolution") return "evolution";
	if ("teachesMoveId" in item) return "teach";
	if ("effect" in item && isMedicineEffect(item.effect)) return "medicine";
	return null;
}

/**
 * Rebuilds the fixed four-slot moveset from a creature summary view.
 *
 * The summary exposes moves as an ordered list of `{ id, pp }` rows; the learn
 * flow needs the raw `MoveSet` tuple (slot 0 always holds a move, slots 1-3 may be
 * null). Missing trailing rows are padded with null so a partially filled party
 * member still yields four slots.
 */
export function movesetFromSummary(creature: CreatureSummaryView): MoveSet {
	return [
		creature.moves[0]?.id ?? null,
		creature.moves[1]?.id ?? null,
		creature.moves[2]?.id ?? null,
		creature.moves[3]?.id ?? null,
	] as MoveSet;
}

/**
 * Decides whether teaching a machine's move should consume one copy of it.
 *
 * A single-use machine (marked `Consumable`, like a TM) is spent after a
 * successful teach; a reusable machine (an HM, which omits the flag) is not. No
 * machine in the current content carries `Consumable`, so today nothing is
 * consumed — the check is data-driven so authoring a consumable machine later
 * spends it without any code change.
 */
export function machineConsumedOnTeach(item: Item): boolean {
	return item.attributes.includes(ItemAttribute.Consumable);
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
		let item = game.content.items[entry.id];
		let action = bagItemAction(item);
		if (action === null || !item) return;

		game.scenes.push(
			new ItemTargetScene({
				itemName: entry.name,
				onSelect: (creatureId) =>
					action === "teach"
						? this.teachTo(game, item, entry.id, entry.name, creatureId)
						: this.useOn(game, action, entry.id, entry.name, creatureId),
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
		action: "evolution" | "medicine",
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

	/**
	 * Teaches a machine's move to one creature, choosing the append/replace path.
	 *
	 * A creature that already knows the move is a no-op with a message; one with a
	 * free slot learns the move directly (a `learn-move` dispatch with no replace
	 * index appends it); a full moveset instead opens {@link LearnMoveScene} so the
	 * player picks a slot to overwrite or skips. A single-use machine is consumed
	 * only once a move is actually learned — the free-slot path checks the dispatch
	 * emitted a `learned-move`, and the replace path consumes from the prompt's
	 * `onResolve` when it reports a chosen (non-negative) slot. The picker is popped
	 * back to the bag before any message window or replace prompt is shown.
	 */
	private teachTo(
		game: GameClient,
		item: Item,
		itemId: string,
		itemName: string,
		creatureId: CreatureId,
	) {
		if (!("teachesMoveId" in item)) return;
		let moveId = item.teachesMoveId;
		let creature = game.engine.selectCreatureSummary(creatureId);

		if (creature.moves.some((move) => move.id === moveId)) {
			game.scenes.pop();
			game.scenes.push(new DialogueScene([`${creature.name} already knows ${moveId}.`]));
			return;
		}

		let moveset = movesetFromSummary(creature);
		if (hasFreeMoveSlot(moveset)) {
			let events = game.dispatch({ type: "learn-move", creatureId, moveId });
			if (events.some((event) => event.type === "learned-move")) {
				this.consumeMachine(game, item, itemId);
			}
			game.scenes.pop();
			game.scenes.push(new DialogueScene([`${creature.name} learned ${moveId}!`]));
			return;
		}

		game.scenes.pop();
		game.scenes.push(
			new LearnMoveScene(creatureId, moveId, moveset, creature.name, (slotIndex) => {
				if (slotIndex >= 0) this.consumeMachine(game, item, itemId);
			}),
		);
	}

	/** Spends one copy of a single-use machine; reusable machines are left alone. */
	private consumeMachine(game: GameClient, item: Item, itemId: string) {
		if (!machineConsumedOnTeach(item)) return;
		game.dispatch({ type: "remove-inventory-item", playerId: HERO_ID, itemId, count: 1 });
	}
}
