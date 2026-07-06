import type { Scene } from "../core/scene";

/**
 * The boot scene: load assets, then hand off to the title.
 *
 * It kicks off the eager asset load on enter, drawing a progress bar while files
 * settle. Once loading finishes it waits for the first button press — which both
 * satisfies the browser's audio-autoplay gesture requirement (so `audio.unlock`
 * can resume the context) and gives the player a clear "press to start" — then
 * replaces itself with the title scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { GameClient } from "../core/game-client";
import { Button } from "../core/input";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";
import { drawText } from "../render/text";
import { BootProgress, SceneBackground, Text } from "../render/theme";

import { TitleScene } from "./title";

/** Loads assets and shows a progress/press-to-start screen. */
export class BootScene implements Scene {
	/** Assets settled so far. */
	private loaded = 0;

	/** Total assets to load. */
	private total = 0;

	/** True once the asset load promise resolves. */
	private ready = false;

	enter(game: GameClient) {
		void game.assets
			.loadAll((loaded, total) => {
				this.loaded = loaded;
				this.total = total;
			}, game.audio.context)
			.then(() => {
				this.ready = true;
			});
	}

	exit() {}

	update(game: GameClient) {
		if (this.ready && game.input.isPressed(Button.A)) {
			game.audio.unlock();
			game.scenes.replace(new TitleScene());
		}
	}

	render(_game: GameClient, ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = SceneBackground.boot;
		ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		drawText(ctx, "PKMN", SCREEN_WIDTH / 2, 60, { align: "center", color: Text.inverse });

		if (!this.ready) {
			let ratio = this.total > 0 ? this.loaded / this.total : 1;
			ctx.fillStyle = BootProgress.track;
			ctx.fillRect(70, 96, 100, 6);
			ctx.fillStyle = BootProgress.fill;
			ctx.fillRect(70, 96, Math.round(100 * ratio), 6);
			drawText(ctx, "Loading...", SCREEN_WIDTH / 2, 110, {
				align: "center",
				color: Text.bootLoading,
			});
			return;
		}

		drawText(ctx, "Press Z / Enter to start", SCREEN_WIDTH / 2, 104, {
			align: "center",
			color: Text.inverse,
		});
	}
}
