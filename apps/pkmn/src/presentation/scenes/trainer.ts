/**
 * The trainer screen: a trainer-card view of the player's identity and money.
 *
 * Opened from the pause menu's "Trainer" entry. It draws a framed card showing
 * the player's name and current balance, always re-read from the player selector
 * so the balance reflects the engine's truth. The card leaves vertical room for
 * later additions (badges, playtime) below the money line. Cancel (B / Escape)
 * closes back to the pause menu; it only reads selectors and never dispatches.
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
 * Kept pure so the name and money formatting stay a plain function of the player
 * view and can be asserted without the canvas: money is rendered with the same
 * `₽` prefix the rest of the presentation uses.
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
		// B (and Escape, which maps to B) closes the card back to the pause menu.
		if (game.input.isPressed(Button.B)) game.scenes.pop();
	}

	render(game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = theme.SCENE_BACKGROUND.summary;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, "TRAINER CARD", 8, 6, { color: theme.TEXT.default });

		// The card leaves the lower portion free for later badges/playtime rows.
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
