/**
 * The scene contract for the presentation layer.
 *
 * A scene owns one screen of the game and is driven by `SceneStack`, which
 * renders it, steps it on the fixed timestep, and may layer it beneath other
 * scenes. It receives the `GameClient` as context to reach engine and input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameEvent } from "~/game/events";

import type { GameClient } from "./game-client";

/** One screen of the game, managed by `SceneStack`. */
export interface Scene {
	/** Called once when the scene is added to the stack. */
	enter(game: GameClient): void;

	/** Called once when the scene is removed from the stack. */
	exit(game: GameClient): void;

	/** Called when another scene is pushed on top of this one. */
	suspend?(): void;

	/** Called when the scene on top of this one is popped, making it active again. */
	resume?(): void;

	/** Advances the scene by one fixed timestep (`dt` milliseconds). */
	update(game: GameClient, dt: number): void;

	/** Draws the scene into the internal-resolution canvas context. */
	render(game: GameClient, ctx: CanvasRenderingContext2D): void;

	/** When true, scenes below this one still render (e.g. a menu over the map). */
	readonly translucent?: boolean;

	/** Receives the events produced by dispatches while this scene is active. */
	onEngineEvents?(events: GameEvent[]): void;
}
