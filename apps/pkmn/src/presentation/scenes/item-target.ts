/**
 * The item-target picker: choose a party creature to use a held item on.
 *
 * The bag pushes this over itself when an item acts on one creature — an
 * evolution stone or a recovery medicine. Confirming hands the creature id to
 * `onSelect`; cancelling calls `onCancel`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CreatureSummaryView, PartyView } from "~/game/selectors";
import type { CreatureId } from "~/game/world/ids";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";

/** Formats one party member as a single picker row: name, level, HP, and status. */
export function itemTargetRow(creature: CreatureSummaryView): string {
	return `${creature.name}  L${creature.level}  ${creature.currentHP}/${creature.maxHP}${
		creature.status ? `  ${creature.status}` : ""
	}`;
}

/** Derives the ordered picker rows from a party view. */
export function itemTargetRows(party: PartyView): string[] {
	return party.creatures.map(itemTargetRow);
}

/** Options describing which item is being used and how to resolve the choice. */
export interface ItemTargetOptions {
	/** Display label of the item being used, shown in the picker header. */
	itemName: string;
	/** Called with the chosen creature id when the player confirms a member. */
	onSelect(creatureId: CreatureId): void;
	/** Called when the player backs out without choosing a member. */
	onCancel?(): void;
}

/** Lets the player pick a party creature to use an item on. */
export class ItemTargetScene implements Scene {
	/** The list widget for party members, sized like the party screen. */
	private readonly list = new ListMenu(6);

	/** @param options - The item label and the confirm/cancel callbacks. */
	constructor(private readonly options: ItemTargetOptions) {}

	enter(game: GameClient) {
		this.list.useAudio(game.audio);
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let party = game.engine.selectParty();
		this.list.update(game.input, party.creatures.length);
		if (this.list.cancelled(game.input)) {
			this.options.onCancel?.();
			game.scenes.pop();
			return;
		}
		if (this.list.confirmed(game.input)) {
			let creature = party.creatures[this.list.selected];
			if (creature) this.options.onSelect(creature.id);
		}
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.party;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, `Use ${this.options.itemName} on`, 8, 6, { color: theme.TEXT.default });

		let party = game.engine.selectParty();
		this.list.render(ctx, itemTargetRows(party), 8, 20, 224);
	}
}
