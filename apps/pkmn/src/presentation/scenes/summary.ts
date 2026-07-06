/**
 * The summary screen: one creature's stats and moves.
 *
 * Reads a single creature summary from the engine and lays out its name, level,
 * species, HP, status, and moveset with PP. It also shows the creature's nature
 * and a per-stat table of individual values (IV) and effort values (EV) carried
 * through from the engine. Cancel returns to the party list. Read-only: it
 * dispatches nothing.
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

/** Ordered stats with their short screen labels for the IV/EV table. */
const STAT_ROWS: ReadonlyArray<{ stat: Stat; label: string }> = [
	{ stat: Stat.HP, label: "HP" },
	{ stat: Stat.Attack, label: "ATK" },
	{ stat: Stat.Defense, label: "DEF" },
	{ stat: Stat.SpecialAttack, label: "SPA" },
	{ stat: Stat.SpecialDefense, label: "SPD" },
	{ stat: Stat.Speed, label: "SPE" },
];

/** One row of the IV/EV table: a stat label paired with its IV and EV values. */
export interface StatTrainingRow {
	/** Short display label for the stat. */
	label: string;
	/** Individual value for the stat. */
	iv: number;
	/** Effort value for the stat. */
	ev: number;
}

/**
 * Pairs each stat's IV and EV into ordered, labeled rows for display.
 *
 * The ordering is fixed by `STAT_ROWS` so the table reads the same for every
 * creature; this is a pure function of the two stat sets so it can be unit
 * tested without a canvas.
 */
export function statTrainingRows(ivs: StatSet, evs: StatSet): StatTrainingRow[] {
	return STAT_ROWS.map(({ stat, label }) => ({ label, iv: ivs[stat], ev: evs[stat] }));
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
		drawText(ctx, `Nature: ${creature.nature}`, 130, 82, { color: theme.TEXT.secondary });
		drawText(ctx, "IV", 200, 82, { align: "right", color: theme.TEXT.muted });
		drawText(ctx, "EV", 228, 82, { align: "right", color: theme.TEXT.muted });
		statTrainingRows(creature.ivs, creature.evs).forEach((row, index) => {
			let y = 96 + index * 10;
			drawText(ctx, row.label, 130, y, { color: theme.TEXT.secondary });
			drawText(ctx, String(row.iv), 200, y, { align: "right", color: theme.TEXT.secondary });
			drawText(ctx, String(row.ev), 228, y, { align: "right", color: theme.TEXT.secondary });
		});
	}
}
