/**
 * The dialogue scene: a message window over another scene.
 *
 * Reveals messages one character at a time, advancing or skipping on A and
 * popping after the last message. It stays translucent so the scene beneath
 * remains visible; callers change game state around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "../core/game-client";
import type { Scene } from "../core/scene";

import { Button } from "../core/input";
import { drawText, Typewriter, wrapText } from "../render/text";
import { Window } from "../render/window";

/** Displays a queue of messages over the scene below. */
export class DialogueScene implements Scene {
	readonly translucent = true;

	/** The current message's typewriter. */
	private writer: Typewriter;

	/** Index of the message being shown. */
	private index = 0;

	/** @param messages - The messages to show in order. */
	constructor(private readonly messages: string[]) {
		this.writer = new Typewriter(messages[0] ?? "", 40);
	}

	enter() {}

	exit() {}

	update(game: GameClient, dt: number) {
		this.writer.update(dt);
		if (!game.input.isPressed(Button.A)) return;

		if (!this.writer.done) {
			this.writer.skip();
			return;
		}
		this.index++;
		if (this.index >= this.messages.length) {
			game.scenes.pop();
			return;
		}
		this.writer = new Typewriter(this.messages[this.index] ?? "", 40);
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		Window.frame(ctx, 4, 112, 232, 44);
		let lines = wrapText(ctx, this.writer.visibleText, 220);
		lines.slice(0, 3).forEach((line, row) => drawText(ctx, line, 12, 120 + row * 12));
	}
}
