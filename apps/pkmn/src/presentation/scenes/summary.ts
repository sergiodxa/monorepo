/**
 * The summary screen: one creature's stats and moves.
 *
 * Reads a single creature summary from the engine and lays out its name, level,
 * species, HP, status, and moveset with PP. It also shows the creature's nature
 * and a per-stat table of its current stat values (HP/ATK/DEF/SPA/SPD/SPE),
 * matching what the real games surface here. Cancel returns to the party list.
 * Read-only: it dispatches nothing.
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

/** Ordered stats with their short screen labels for the stat value table. */
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
	/** Short display label for the stat. */
	label: string;
	/** Current computed value for the stat. */
	value: number;
}

/**
 * Maps each stat's current value into ordered, labeled rows for display.
 *
 * The ordering is fixed by `STAT_ROWS` so the table reads the same for every
 * creature; this is a pure function of the stat set so it can be unit tested
 * without a canvas. Effort values are intentionally not surfaced here.
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
		// "Nature" is labelled on the left with its value right-aligned to the
		// window's inner edge so neither piece overruns the 112px-wide panel.
		drawText(ctx, "Nature", 130, 82, { color: theme.TEXT.muted });
		drawText(ctx, creature.nature, 228, 82, { align: "right", color: theme.TEXT.secondary });
		// Six rows spaced 9px apart keep the last one (y=139, +7px glyph) inside
		// the window's bottom edge at y=152.
		statValueRows(creature.stats).forEach((row, index) => {
			let y = 94 + index * 9;
			drawText(ctx, row.label, 130, y, { color: theme.TEXT.secondary });
			drawText(ctx, String(row.value), 228, y, { align: "right", color: theme.TEXT.secondary });
		});
	}
}
