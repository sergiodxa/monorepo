/**
 * Grid-locked player movement for the overworld.
 *
 * Movement is RPG Maker style: the player occupies a tile and tweens smoothly to
 * the next over a fixed duration, and input is only sampled once a tile is
 * reached, so motion always lands on the grid. Holding B runs (a shorter tween).
 * The controller exposes interpolated pixel coordinates and a walk-cycle frame
 * for rendering, and reports each tile arrival so the scene can roll encounters
 * or fire triggers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { type Direction, directionDelta } from "../core/direction";
import { Button, type InputManager } from "../core/input";
import { TILE_SIZE } from "../core/loop";

import type { GameMap } from "./map-loader";

/** Milliseconds to cross one tile when walking. */
const WALK_MS = 250;

/** Milliseconds to cross one tile when running. */
const RUN_MS = 130;

/** Drives one grid-locked actor from input against a map. */
export class PlayerController {
	/** Current facing, updated even when a move is blocked. */
	facing: Direction;

	/** Logical tile column. */
	private tileX: number;

	/** Logical tile row. */
	private tileY: number;

	/** Direction of the in-progress step, or null while idle. */
	private stepDir: Direction | null = null;

	/** Pixels travelled into the current step. */
	private offset = 0;

	/** Pixels per millisecond for the current step. */
	private speed = 0;

	/** Total pixels walked, used to phase the walk-cycle animation. */
	private walkedPx = 0;

	/**
	 * @param x - Starting tile column.
	 * @param y - Starting tile row.
	 * @param facing - Starting facing.
	 */
	constructor(x: number, y: number, facing: Direction) {
		this.tileX = x;
		this.tileY = y;
		this.facing = facing;
	}

	/** Advances movement by `dt`; returns whether a tile was reached this step. */
	update(input: InputManager, map: GameMap, dt: number): { arrived: boolean } {
		if (this.stepDir) {
			this.offset += this.speed * dt;
			this.walkedPx += this.speed * dt;
			if (this.offset < TILE_SIZE) return { arrived: false };

			let delta = directionDelta(this.stepDir);
			this.tileX += delta.dx;
			this.tileY += delta.dy;
			this.offset = 0;
			this.stepDir = null;
			return { arrived: true };
		}

		let direction = this.readDirection(input);
		if (!direction) return { arrived: false };

		this.facing = direction;
		let delta = directionDelta(direction);
		if (map.isBlocked(this.tileX + delta.dx, this.tileY + delta.dy)) return { arrived: false };

		this.stepDir = direction;
		this.speed = TILE_SIZE / (input.isHeld(Button.B) ? RUN_MS : WALK_MS);
		return { arrived: false };
	}

	/** The tile the player currently occupies (its target while mid-step). */
	get tile(): { x: number; y: number } {
		return { x: this.tileX, y: this.tileY };
	}

	/** Interpolated x position in world pixels. */
	get pixelX(): number {
		let base = this.tileX * TILE_SIZE;
		return this.stepDir ? base + directionDelta(this.stepDir).dx * this.offset : base;
	}

	/** Interpolated y position in world pixels. */
	get pixelY(): number {
		let base = this.tileY * TILE_SIZE;
		return this.stepDir ? base + directionDelta(this.stepDir).dy * this.offset : base;
	}

	/** True while a step is in progress. */
	get moving(): boolean {
		return this.stepDir !== null;
	}

	/** The 4-frame walk-cycle index (stand, step, stand, step). */
	get walkFrame(): number {
		if (!this.stepDir) return 0;
		return Math.floor(this.walkedPx / (TILE_SIZE / 2)) % 4;
	}

	/** Reads the first held movement direction from input. */
	private readDirection(input: InputManager): Direction | null {
		if (input.isHeld(Button.Up)) return "up";
		if (input.isHeld(Button.Down)) return "down";
		if (input.isHeld(Button.Left)) return "left";
		if (input.isHeld(Button.Right)) return "right";
		return null;
	}
}
