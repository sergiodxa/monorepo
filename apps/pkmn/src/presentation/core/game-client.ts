/**
 * The composition root of the presentation layer.
 *
 * `GameClient` owns the single canvas, the fixed-timestep loop, and every
 * subsystem (input, assets, audio, scenes, saves), and it holds the engine that
 * scenes drive. It scales the internal 240x160 image to the largest integer
 * multiple that fits its host, keeps drawing in internal pixels with smoothing
 * off, and runs simulation at a constant 60 Hz while rendering once per animation
 * frame. Scenes never touch the engine directly for mutation: they call
 * `dispatch`, which forwards the resulting events to the active scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Command } from "~/game/commands";
import type { GameDataSource } from "~/game/data/game-data";
import type { Engine } from "~/game/engine";
import type { GameEvent } from "~/game/events";

import { MANIFEST } from "../assets/manifest";

import type { Scene } from "./scene";

import { AssetStore } from "./assets";
import { AudioManager } from "./audio";
import { InputManager } from "./input";
import { FIXED_STEP_MS, MAX_FRAME_MS, SCREEN_HEIGHT, SCREEN_WIDTH } from "./loop";
import { SaveStore } from "./save";
import { SceneStack } from "./scene-stack";

/** Owns the canvas, loop, subsystems, and engine for one running game. */
export class GameClient {
	/** The engine the scenes drive; replaced when a new world is created or loaded. */
	engine: Engine;

	/** Static authored content, kept so scenes can rebuild an engine on New Game/Continue. */
	readonly content: GameDataSource;

	/** Merged keyboard/gamepad input. */
	readonly input = new InputManager();

	/** Eagerly-loaded assets addressed by manifest id. */
	readonly assets = new AssetStore(MANIFEST);

	/** Music, effect, and cry playback. */
	readonly audio = new AudioManager(this.assets);

	/** The active scene stack. */
	readonly scenes = new SceneStack(this);

	/** The single local save slot. */
	readonly save = new SaveStore("pkmn-save");

	/** The canvas the game renders into. */
	private readonly canvas: HTMLCanvasElement;

	/** The 2D context, configured for crisp pixel scaling. */
	private readonly ctx: CanvasRenderingContext2D;

	/** Accumulated real time owed to the fixed-step simulation. */
	private accumulator = 0;

	/** Timestamp of the previous animation frame. */
	private lastTime = 0;

	/** Whether the loop is running (guards against double `start`). */
	private running = false;

	/**
	 * @param root - The element the canvas mounts into and scales to fill.
	 * @param engine - The initial engine (a fresh new-game world).
	 * @param content - Authored content used to rebuild the engine later.
	 */
	constructor(root: HTMLElement, engine: Engine, content: GameDataSource) {
		this.engine = engine;
		this.content = content;

		this.canvas = globalThis.document.createElement("canvas");
		this.canvas.width = SCREEN_WIDTH;
		this.canvas.height = SCREEN_HEIGHT;
		this.canvas.style.imageRendering = "pixelated";

		let ctx = this.canvas.getContext("2d");
		if (ctx === null) throw new ReferenceError("2D canvas context is unavailable.");
		this.ctx = ctx;
		this.ctx.imageSmoothingEnabled = false;

		root.append(this.canvas);
		this.fitToWindow(root);
		new globalThis.ResizeObserver(() => this.fitToWindow(root)).observe(root);
	}

	/** Attaches input, enters the initial scene (typically Boot), and starts the loop. */
	start(initial: Scene) {
		if (this.running) return;
		this.running = true;
		this.input.attach(globalThis.window);
		this.scenes.replace(initial);
		this.lastTime = globalThis.performance.now();
		globalThis.requestAnimationFrame(this.frame);
	}

	/** Dispatches one command to the engine and hands the events to the active scene. */
	dispatch(command: Command): GameEvent[] {
		let events = this.engine.dispatch(command);
		this.scenes.handleEngineEvents(events);
		return events;
	}

	/** One animation frame: fixed-step updates to catch up, then a single render. */
	private frame = (now: number) => {
		this.accumulator = Math.min(this.accumulator + (now - this.lastTime), MAX_FRAME_MS);
		this.lastTime = now;

		while (this.accumulator >= FIXED_STEP_MS) {
			this.input.poll();
			this.scenes.update(FIXED_STEP_MS);
			this.accumulator -= FIXED_STEP_MS;
		}

		this.ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
		this.scenes.render(this.ctx);
		globalThis.requestAnimationFrame(this.frame);
	};

	/** Scales the canvas to the largest integer multiple that fits the host. */
	private fitToWindow(root: HTMLElement) {
		let scale = Math.max(
			1,
			Math.floor(Math.min(root.clientWidth / SCREEN_WIDTH, root.clientHeight / SCREEN_HEIGHT)),
		);
		this.canvas.style.width = `${SCREEN_WIDTH * scale}px`;
		this.canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
	}
}
