/**
 * The choice picker: present a list of labelled options over the scene below.
 *
 * Confirming a choice or backing out with B (which picks the last option, the
 * conventional "cancel" choice) reports the index through `onChoose` and pops.
 * The scene stays translucent so the caller's own scene shows through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { ListMenu } from "../render/list-menu";
import { drawText } from "../render/text";
import * as theme from "../render/theme";
import { Window } from "../render/window";

/** Options describing the choices to present and how to resolve the pick. */
export interface ChoiceOptions {
	/** Optional text shown above the choices. */
	prompt?: string;
	/** The choice labels, in order; the chosen index maps back to the branch. */
	labels: string[];
	/** Called with the chosen index when the player confirms (or cancels to the last). */
	onChoose(index: number): void;
}

/** Lets the player pick one of an event's authored choices. */
export class ChoiceScene implements Scene {
	readonly translucent = true;

	/** The list widget sized to show up to four choices at once. */
	private readonly list = new ListMenu(4);

	/** @param options - The prompt, labels, and the resolve callback. */
	constructor(private readonly options: ChoiceOptions) {}

	enter(game: GameClient) {
		this.list.useAudio(game.audio);
		this.list.reset();
	}

	exit() {}

	update(game: GameClient) {
		let count = this.options.labels.length;
		this.list.update(game.input, count);
		if (this.list.cancelled(game.input)) {
			this.options.onChoose(Math.max(0, count - 1));
			game.scenes.pop();
			return;
		}
		if (this.list.confirmed(game.input)) {
			this.options.onChoose(this.list.selected);
			game.scenes.pop();
		}
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		let prompt = this.options.prompt;
		if (prompt) {
			Window.frame(ctx, 4, 112, 232, 44);
			drawText(ctx, prompt, 12, 120, { color: theme.TEXT.default });
		}
		let height = this.options.labels.length * 14 + 8;
		this.list.render(ctx, this.options.labels, 132, 108 - height, 104);
	}
}
