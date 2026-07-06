/**
 * Tests for the overworld camera clamping.
 *
 * Covers `Camera.centerOn`: it centers the viewport on a target in the middle of
 * a large map, and clamps to `[0, mapPx - screen]` at both the near and far
 * edges so the view never scrolls past the map. Also covers maps smaller than
 * the screen, where the clamp collapses to a fixed `0` offset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";

import { Camera } from "./camera";

let MAP_WIDTH_PX = 1000;
let MAP_HEIGHT_PX = 800;

test("centerOn centers the view on a target in the middle of the map", () => {
	let camera = new Camera();
	camera.centerOn(500, 400, MAP_WIDTH_PX, MAP_HEIGHT_PX);
	expect(camera.x).toBe(500 - SCREEN_WIDTH / 2);
	expect(camera.y).toBe(400 - SCREEN_HEIGHT / 2);
});

test("centerOn clamps to 0 at the near (top-left) edge", () => {
	let camera = new Camera();
	camera.centerOn(0, 0, MAP_WIDTH_PX, MAP_HEIGHT_PX);
	expect(camera.x).toBe(0);
	expect(camera.y).toBe(0);
});

test("centerOn clamps to mapPx - screen at the far (bottom-right) edge", () => {
	let camera = new Camera();
	camera.centerOn(MAP_WIDTH_PX, MAP_HEIGHT_PX, MAP_WIDTH_PX, MAP_HEIGHT_PX);
	expect(camera.x).toBe(MAP_WIDTH_PX - SCREEN_WIDTH);
	expect(camera.y).toBe(MAP_HEIGHT_PX - SCREEN_HEIGHT);
});

test("centerOn pins to 0 when the map is smaller than the screen", () => {
	let camera = new Camera();
	camera.centerOn(50, 40, SCREEN_WIDTH - 20, SCREEN_HEIGHT - 20);
	expect(camera.x).toBe(0);
	expect(camera.y).toBe(0);
});
