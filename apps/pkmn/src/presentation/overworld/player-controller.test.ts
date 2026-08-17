/**
 * Tests for grid-locked player movement.
 *
 * Covers `PlayerController` facing a held direction, tweening one tile over the
 * walk duration and reporting `arrived` exactly on arrival, refusing to step into
 * a blocked map tile or an occupied tile (while still turning to face it), and
 * the running (held B) shorter tween. A scripted fake `InputManager` drives the
 * held/pressed reads and a real sample `GameMap` supplies collision.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { Button, type InputManager } from "../core/input";
import { TILE_SIZE } from "../core/loop";

import { createSampleMap, GameMap } from "./map-loader";
import { PlayerController } from "./player-controller";

/** Builds a fake input holding the given buttons for every `isHeld` query. */
function heldInput(...buttons: Button[]): InputManager {
	let held = new Set(buttons);
	return {
		isHeld: (button: Button) => held.has(button),
		isPressed: () => false,
		isRepeating: () => false,
	} as unknown as InputManager;
}

/** A fake input with nothing held. */
function idleInput(): InputManager {
	return heldInput();
}

let MAP = new GameMap(createSampleMap());

test("update faces a held direction even before a step begins", () => {
	// Spawn at (5,5); hold Left. The tile to the left (4,5) is walkable.
	let player = new PlayerController(5, 5, "down");
	player.update(heldInput(Button.Left), MAP, 16);
	expect(player.facing).toBe("left");
	expect(player.moving).toBe(true);
});

test("update steps one whole tile over the walk duration and reports arrival once", () => {
	let player = new PlayerController(5, 5, "down");
	// Frame 1: begins the step toward (5,6), still on the origin tile.
	expect(player.update(heldInput(Button.Down), MAP, 16).arrived).toBe(false);
	expect(player.tile).toEqual({ x: 5, y: 5 });

	// Walk speed crosses 16px in 250ms. Advance in ~16ms slices until arrival.
	let arrivedFrames = 0;
	for (let step = 0; step < 20; step++) {
		if (player.update(idleInput(), MAP, 16).arrived) arrivedFrames++;
	}
	expect(arrivedFrames).toBe(1);
	expect(player.tile).toEqual({ x: 5, y: 6 });
	expect(player.moving).toBe(false);
});

test("pixel position interpolates partway through a downward step", () => {
	let player = new PlayerController(5, 5, "down");
	player.update(heldInput(Button.Down), MAP, 16); // start step
	player.update(idleInput(), MAP, 125); // ~half of the 250ms walk
	expect(player.pixelY).toBeGreaterThan(5 * TILE_SIZE);
	expect(player.pixelY).toBeLessThan(6 * TILE_SIZE);
	expect(player.pixelX).toBe(5 * TILE_SIZE); // no horizontal drift
});

test("update turns toward a blocked map tile but never steps onto it", () => {
	// Move the player next to the top wall: tile (1,1) is interior, (1,0) is solid.
	let player = new PlayerController(1, 1, "down");
	let result = player.update(heldInput(Button.Up), MAP, 16);
	expect(player.facing).toBe("up"); // faced the wall
	expect(result.arrived).toBe(false);
	expect(player.moving).toBe(false); // no step begun
	expect(player.tile).toEqual({ x: 1, y: 1 });
});

test("update refuses to step onto an occupied tile reported by the predicate", () => {
	let player = new PlayerController(5, 5, "down");
	let occupied = (x: number, y: number) => x === 5 && y === 6;
	let result = player.update(heldInput(Button.Down), MAP, 16, occupied);
	expect(player.facing).toBe("down"); // still turns to face it
	expect(result.arrived).toBe(false);
	expect(player.moving).toBe(false);
	expect(player.tile).toEqual({ x: 5, y: 5 });
});

test("holding B runs, crossing a tile faster than walking", () => {
	let walker = new PlayerController(5, 5, "down");
	walker.update(heldInput(Button.Down), MAP, 16); // walk step
	let runner = new PlayerController(5, 5, "down");
	runner.update(heldInput(Button.Down, Button.B), MAP, 16); // run step

	// After the same 130ms, the runner (130ms/tile) has arrived; the walker (250ms) has not.
	let runnerArrived = runner.update(idleInput(), MAP, 130).arrived;
	let walkerArrived = walker.update(idleInput(), MAP, 130).arrived;
	expect(runnerArrived).toBe(true);
	expect(walkerArrived).toBe(false);
});

test("an idle controller with no input does not move", () => {
	let player = new PlayerController(5, 5, "down");
	let result = player.update(idleInput(), MAP, 16);
	expect(result.arrived).toBe(false);
	expect(player.moving).toBe(false);
	expect(player.walkFrame).toBe(0);
});
