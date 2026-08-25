/**
 * The species-detail screen: one recorded species' dossier.
 *
 * Opened from the bestiary for an already-seen species. Habitat is resolved
 * by scanning the caller's maps for encounter tables; a species with no
 * matching zone shows "Unknown" in the "Where to catch" section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpeciesDetailView } from "~/game/selectors";

import { Stat } from "~/game/data/stat";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";
import type { TileMap } from "../render/tilemap";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { createSampleMap, habitatZones } from "../overworld/map-loader";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

/** The stat rows shown in the detail panel, in a fixed, readable order. */
const STAT_ROWS: Array<{ key: Stat; label: string }> = [
	{ key: Stat.HP, label: "HP" },
	{ key: Stat.Attack, label: "ATK" },
	{ key: Stat.Defense, label: "DEF" },
	{ key: Stat.SpecialAttack, label: "SP.ATK" },
	{ key: Stat.SpecialDefense, label: "SP.DEF" },
	{ key: Stat.Speed, label: "SPD" },
];

/** The label shown for the habitat section when no zone is known. */
const UNKNOWN_HABITAT = "Unknown";

/** One label/value line drawn inside the detail window. */
export interface DetailRow {
	label: string;
	value: string;
}

/**
 * Builds the detail screen's content rows from a species view.
 *
 * Kept pure so the formatting is asserted without the canvas; an empty
 * habitat collapses to a single {@link UNKNOWN_HABITAT} row.
 */
export function speciesDetailRows(species: SpeciesDetailView): DetailRow[] {
	let status = species.caught ? "Caught" : species.seen ? "Seen" : "-";
	let rows: DetailRow[] = [
		{ label: "NO", value: `#${String(species.number).padStart(3, "0")}` },
		{ label: "TYPE", value: species.types.join(" / ") },
		{ label: "STATUS", value: status },
	];

	for (let stat of STAT_ROWS) {
		rows.push({ label: stat.label, value: String(species.baseStats[stat.key]) });
	}

	if (species.habitat.length === 0) {
		rows.push({ label: "WHERE", value: UNKNOWN_HABITAT });
	} else {
		for (let [index, zone] of species.habitat.entries()) {
			rows.push({ label: index === 0 ? "WHERE" : "", value: zone });
		}
	}

	return rows;
}

/** Shows one recorded species' dossier, including where it can be caught. */
export class SpeciesDetailScene implements Scene {
	/** The resolved view, filled on `enter` once the client is available. */
	private view: SpeciesDetailView | null = null;

	/**
	 * @param speciesId - The species to detail; must be one the player has seen.
	 * @param maps - The maps whose encounter tables are scanned for habitat. Defaults
	 *   to the built-in sample map so the screen works before authored maps ship;
	 *   callers with loaded maps pass them to populate the "Where to catch" list.
	 */
	constructor(
		private readonly speciesId: string,
		private readonly maps: readonly TileMap[] = [createSampleMap()],
	) {}

	enter(game: GameClient) {
		let habitat = habitatZones(this.maps, this.speciesId);
		this.view = game.engine.select({
			type: "species-detail",
			speciesId: this.speciesId,
			habitat,
		}) as SpeciesDetailView;
	}

	exit() {}

	update(game: GameClient) {
		if (game.input.isPressed(Button.B)) game.scenes.pop();
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.bestiary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		let view = this.view;
		if (!view) return;

		drawText(ctx, view.name, 8, 6, { color: theme.TEXT.default });

		Window.frame(ctx, 8, 20, 224, 124);
		let rows = speciesDetailRows(view);
		for (let [index, row] of rows.entries()) {
			let y = 28 + index * 12;
			if (row.label) drawText(ctx, row.label, 16, y, { color: theme.TEXT.muted });
			drawText(ctx, row.value, 96, y, { color: theme.TEXT.default });
		}

		drawText(ctx, "B: back", 8, 150, { color: theme.TEXT.muted });
	}
}
