/**
 * The summary screen: one creature's stats and moves.
 *
 * Reads a single creature summary from the engine and lays out its name,
 * level, species, HP, status, moveset, nature, and stat values, then
 * returns to the party list on cancel; it only reads engine state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StatSet } from "~/game/data/stat";
import type { CreatureId } from "~/game/world/ids";

import { Stat } from "~/game/data/stat";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

const STAT_ROWS: ReadonlyArray<{ stat: Stat; label: string }> = [
	{ stat: Stat.HP, label: "HP" },
	{ stat: Stat.Attack, label: "ATK" },
	{ stat: Stat.Defense, label: "DEF" },
	{ stat: Stat.SpecialAttack, label: "SPA" },
	{ stat: Stat.SpecialDefense, label: "SPD" },
	{ stat: Stat.Speed, label: "SPE" },
];

/** One row of the stats table: a stat label paired with its current value. */
export interface StatValueRow {
	label: string;
	value: number;
}

/**
 * Maps each stat's current value into ordered, labeled rows for display.
 * The order is fixed by `STAT_ROWS` so every creature's table reads the
 * same, and the mapping is pure so it can be unit tested without a canvas.
 */
export function statValueRows(stats: StatSet): StatValueRow[] {
	return STAT_ROWS.map(({ stat, label }) => ({ label, value: stats[stat] }));
}

/** Shows one creature's details. */
export class SummaryScene implements Scene {
	/** @param creatureId - The creature to summarize. */
	constructor(private readonly creatureId: CreatureId) {}

	enter() {}

	exit() {}

	update(game: GameClient) {
		if (game.input.isPressed(Button.B)) game.scenes.pop();
	}

	/**
	 * Draws the summary screen. Each stat value right-aligns to the panel's
	 * inner edge, and the six rows sit 9px apart so the last stays inside
	 * the window's bottom edge.
	 */
	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.summary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

		let creature = game.engine.selectCreatureSummary(this.creatureId);
		Window.frame(ctx, 6, 6, 228, 52);
		drawText(ctx, creature.name, 14, 12);
		drawText(ctx, `L${creature.level}`, 226, 12, { align: "right" });
		drawText(ctx, `Species: ${creature.speciesId}`, 14, 26, { color: theme.TEXT.secondary });
		drawText(ctx, `HP ${creature.currentHP}/${creature.maxHP}`, 14, 40, {
			color: theme.TEXT.secondary,
		});
		drawText(ctx, `Status: ${creature.status ?? "OK"}`, 140, 40, { color: theme.TEXT.secondary });

		Window.frame(ctx, 6, 64, 112, 88);
		drawText(ctx, "MOVES", 14, 70, { color: theme.TEXT.default });
		creature.moves.forEach((move, index) => {
			let y = 86 + index * 15;
			drawText(ctx, move.id ?? "-", 20, y);
			drawText(ctx, `PP ${move.pp}`, 110, y, { align: "right", color: theme.TEXT.muted });
		});

		Window.frame(ctx, 122, 64, 112, 88);
		drawText(ctx, "STATS", 130, 70, { color: theme.TEXT.default });
		drawText(ctx, "Nature", 130, 82, { color: theme.TEXT.muted });
		drawText(ctx, creature.nature, 228, 82, { align: "right", color: theme.TEXT.secondary });
		statValueRows(creature.stats).forEach((row, index) => {
			let y = 94 + index * 9;
			drawText(ctx, row.label, 130, y, { color: theme.TEXT.secondary });
			drawText(ctx, String(row.value), 228, y, { align: "right", color: theme.TEXT.secondary });
		});
	}
}
