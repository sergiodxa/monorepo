/**
 * Tests for grid-locked player movement.
 *
 * Covers facing a held direction, tweening one tile over the walk duration,
 * refusing to step into a blocked or occupied tile while still turning to
 * face it, and the shorter run tween while B is held.
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

function idleInput(): InputManager {
	return heldInput();
}

let MAP = new GameMap(createSampleMap());

test("update faces a held direction even before a step begins", () => {
	let player = new PlayerController(5, 5, "down");
	player.update(heldInput(Button.Left), MAP, 16);
	expect(player.facing).toBe("left");
	expect(player.moving).toBe(true);
});

test("update steps one whole tile over the walk duration and reports arrival once", () => {
	let player = new PlayerController(5, 5, "down");
	expect(player.update(heldInput(Button.Down), MAP, 16).arrived).toBe(false);
	expect(player.tile).toEqual({ x: 5, y: 5 });

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
	player.update(heldInput(Button.Down), MAP, 16);
	player.update(idleInput(), MAP, 125);
	expect(player.pixelY).toBeGreaterThan(5 * TILE_SIZE);
	expect(player.pixelY).toBeLessThan(6 * TILE_SIZE);
	expect(player.pixelX).toBe(5 * TILE_SIZE);
});

test("update turns toward a blocked map tile but never steps onto it", () => {
	let player = new PlayerController(1, 1, "down");
	let result = player.update(heldInput(Button.Up), MAP, 16);
	expect(player.facing).toBe("up");
	expect(result.arrived).toBe(false);
	expect(player.moving).toBe(false);
	expect(player.tile).toEqual({ x: 1, y: 1 });
});

test("update refuses to step onto an occupied tile reported by the predicate", () => {
	let player = new PlayerController(5, 5, "down");
	let occupied = (x: number, y: number) => x === 5 && y === 6;
	let result = player.update(heldInput(Button.Down), MAP, 16, occupied);
	expect(player.facing).toBe("down");
	expect(result.arrived).toBe(false);
	expect(player.moving).toBe(false);
	expect(player.tile).toEqual({ x: 5, y: 5 });
});

test("holding B runs, crossing a tile faster than walking", () => {
	let walker = new PlayerController(5, 5, "down");
	walker.update(heldInput(Button.Down), MAP, 16);
	let runner = new PlayerController(5, 5, "down");
	runner.update(heldInput(Button.Down, Button.B), MAP, 16);

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
