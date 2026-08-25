/**
 * The trainer screen: a trainer-card view of the player's identity and money.
 *
 * Opened from the pause menu, it re-reads the player selector each render
 * so the balance stays current, leaving room below it for later badges and
 * playtime. Cancel (B/Escape) returns to the pause menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PlayerView } from "~/game/selectors";

import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { HERO_ID } from "../core/new-game";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

/** One labelled line drawn inside the trainer card. */
export interface TrainerCardRow {
	label: string;
	value: string;
}

/**
 * Builds the trainer-card content rows from a player view.
 *
 * Kept pure so the formatting stays a plain function of the view, and
 * money renders with the same `₽` prefix used elsewhere.
 */
export function trainerCardRows(player: Pick<PlayerView, "name" | "money">): TrainerCardRow[] {
	return [
		{ label: "NAME", value: player.name },
		{ label: "MONEY", value: `₽${player.money}` },
	];
}

/** Shows the player's trainer card (name and money) in a framed window. */
export class TrainerScene implements Scene {
	enter() {}

	exit() {}

	update(game: GameClient) {
		if (game.input.isPressed(Button.B)) game.scenes.pop();
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.summary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, "TRAINER CARD", 8, 6, { color: theme.TEXT.default });

		Window.frame(ctx, 8, 24, 224, 96);
		let rows = trainerCardRows(game.engine.selectPlayer(HERO_ID));
		for (let [index, row] of rows.entries()) {
			let y = 36 + index * 24;
			drawText(ctx, row.label, 20, y, { color: theme.TEXT.muted });
			drawText(ctx, row.value, 20, y + 10, { color: theme.TEXT.default });
		}

		drawText(ctx, "B: close", 8, 150, { color: theme.TEXT.muted });
	}
}
