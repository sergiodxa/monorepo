/**
 * The pause-menu root, opened with Start from the overworld.
 *
 * It lists the sub-screens (Party, Bag, Bestiary, Storage, Save) and pushes the
 * chosen one, or closes back to the map. It is translucent so the overworld stays
 * visible behind its side panel, and it carries the presentation-save snapshot
 * captured when it opened so the Save screen can persist the exact position the
 * player paused at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { PresentationSave } from "../core/save";
import type { Scene } from "../core/scene";

import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import { TEXT } from "../render/theme";

import { BagScene } from "./bag";
import { BestiaryScene } from "./bestiary";
import { PartyScene } from "./party";
import { SaveScene } from "./save";
import { StorageScene } from "./storage";

/** Root pause-menu entries in order. */
const ENTRIES = ["Party", "Bag", "Bestiary", "Storage", "Save", "Close"] as const;

/** The pause-menu root that routes to each sub-screen. */
export class MenuScene implements Scene {
	readonly translucent = true;

	/** The list widget for the entries. */
	private readonly list = new ListMenu(ENTRIES.length);

	/** @param presentation - The save snapshot to persist if the player saves. */
	constructor(private readonly presentation: PresentationSave) {}

	enter() {
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		this.list.update(game.input, ENTRIES.length);
		if (this.list.cancelled(game.input)) {
			game.scenes.pop();
			return;
		}
		if (!this.list.confirmed(game.input)) return;

		switch (ENTRIES[this.list.selected]) {
			case "Party":
				game.scenes.push(new PartyScene());
				break;
			case "Bag":
				game.scenes.push(new BagScene());
				break;
			case "Bestiary":
				game.scenes.push(new BestiaryScene());
				break;
			case "Storage":
				game.scenes.push(new StorageScene());
				break;
			case "Save":
				game.scenes.push(new SaveScene(this.presentation));
				break;
			case "Close":
				game.scenes.pop();
				break;
		}
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		this.list.render(ctx, [...ENTRIES], 158, 6, 76);
		drawText(ctx, "MENU", 168, 150, { color: TEXT.inverseWhite });
	}
}
