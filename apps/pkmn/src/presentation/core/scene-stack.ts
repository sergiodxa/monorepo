/**
 * The scene stack that sequences and layers the presentation's screens.
 *
 * Only the top scene updates, but rendering walks up from the deepest opaque
 * scene so a translucent overlay can draw over the scene it suspended.
 * Pushing suspends the current scene; popping resumes the one beneath it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameClient } from "./game-client";
import type { Scene } from "./scene";

/** Manages the ordered stack of scenes and their lifecycle transitions. */
export class SceneStack {
	/** Scenes from bottom to top; the last entry is active. */
	private readonly scenes: Scene[] = [];

	/** @param game - The client passed to every scene lifecycle and frame callback. */
	constructor(private readonly game: GameClient) {}

	/** Suspends the current top scene and enters `scene` on top of it. */
	push(scene: Scene) {
		this.current?.suspend?.();
		this.scenes.push(scene);
		scene.enter(this.game);
	}

	/** Exits the top scene and resumes the one beneath it. */
	pop() {
		let leaving = this.scenes.pop();
		leaving?.exit(this.game);
		this.current?.resume?.();
	}

	/** Exits the top scene and enters `scene` in its place. */
	replace(scene: Scene) {
		let leaving = this.scenes.pop();
		leaving?.exit(this.game);
		this.scenes.push(scene);
		scene.enter(this.game);
	}

	/** Advances only the top scene. */
	update(dt: number) {
		this.current?.update(this.game, dt);
	}

	/** Renders from the deepest opaque scene up through every translucent overlay. */
	render(ctx: CanvasRenderingContext2D) {
		let start = 0;
		for (let index = this.scenes.length - 1; index >= 0; index--) {
			start = index;
			if (!this.scenes[index]!.translucent) break;
		}
		for (let index = start; index < this.scenes.length; index++) {
			this.scenes[index]!.render(this.game, ctx);
		}
	}

	/** Forwards engine events to the active scene. */
	handleEngineEvents(events: import("~/game/events").GameEvent[]) {
		this.current?.onEngineEvents?.(events);
	}

	/** The active (top) scene, or null when the stack is empty. */
	get current(): Scene | null {
		return this.scenes[this.scenes.length - 1] ?? null;
	}
}
