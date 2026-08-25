/**
 * Verifies autonomous movement for spawned event entities.
 *
 * Covers `random` steps respecting collision, `route` steps looping in
 * phase even when blocked, and the tick's cadence and `directionFix`/
 * `through` page options.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { AutonomousMovement, PageOptions } from "../render/map-schema";

import {
	createMovementState,
	type MovableActor,
	nextRandomStep,
	nextRouteStep,
	STEP_INTERVAL_MS,
	stepIntervalFor,
	tickEventMovement,
} from "./event-movement";

/** Builds one autonomous-movement config, defaulting the tuning fields. */
function movement(overrides: Partial<AutonomousMovement> & Pick<AutonomousMovement, "type">) {
	return {
		speed: undefined,
		freq: undefined,
		route: undefined,
		...overrides,
	} as AutonomousMovement;
}

/** Builds a page-options record, defaulting every toggle to unset. */
function options(overrides: Partial<PageOptions> = {}): PageOptions {
	return {
		moveAnimation: undefined,
		stopAnimation: undefined,
		directionFix: undefined,
		through: undefined,
		alwaysOnTop: undefined,
		...overrides,
	};
}

/** No page options set (the common case for these movement tests). */
const NO_OPTIONS: PageOptions = options();

/** Builds a minimal movable actor at the given tile facing down. */
function actor(x = 2, y = 2): MovableActor {
	return { x, y, facing: "down" };
}

/** A predicate that blocks no tile. */
const OPEN = () => false;

test("nextRandomStep never returns a direction into a blocked tile", () => {
	let isBlocked = (x: number, y: number) => !(x === 2 && y === 1);
	for (let roll = 0; roll < 4; roll++) {
		let direction = nextRandomStep(2, 2, isBlocked, () => roll / 4);
		expect(direction).toBe("up");
	}
});

test("nextRandomStep returns null when every neighbor is blocked", () => {
	expect(
		nextRandomStep(
			2,
			2,
			() => true,
			() => 0,
		),
	).toBeNull();
});

test("nextRouteStep loops the authored steps and wraps at the end", () => {
	let steps = ["left", "right"] as const;
	expect(nextRouteStep(steps, 0)).toBe("left");
	expect(nextRouteStep(steps, 1)).toBe("right");
	expect(nextRouteStep(steps, 2)).toBe("left");
	expect(nextRouteStep([], 0)).toBeNull();
});

test("stepIntervalFor yields the baseline at default speed/freq and shortens as they rise", () => {
	expect(stepIntervalFor(movement({ type: "random" }))).toBe(STEP_INTERVAL_MS);
	expect(stepIntervalFor(movement({ type: "random", speed: 6, freq: 6 }))).toBeLessThan(
		STEP_INTERVAL_MS,
	);
	expect(stepIntervalFor(movement({ type: "random", speed: 99, freq: 99 }))).toBe(120);
});

test("tickEventMovement leaves a fixed entity in place", () => {
	let a = actor();
	let state = createMovementState();
	tickEventMovement(
		a,
		state,
		movement({ type: "fixed" }),
		NO_OPTIONS,
		STEP_INTERVAL_MS * 5,
		OPEN,
		() => 0,
	);
	expect(a).toMatchObject({ x: 2, y: 2 });
});

test("tickEventMovement only steps once the cadence elapses", () => {
	let a = actor();
	let state = createMovementState();
	let route = movement({ type: "route", route: ["right"] });

	tickEventMovement(a, state, route, NO_OPTIONS, STEP_INTERVAL_MS - 1, OPEN, () => 0);
	expect(a.x).toBe(2);

	tickEventMovement(a, state, route, NO_OPTIONS, 1, OPEN, () => 0);
	expect(a.x).toBe(3);
});

test("tickEventMovement walks a route in order and loops it", () => {
	let a = actor(2, 2);
	let state = createMovementState();
	let route = movement({ type: "route", route: ["right", "down"] });
	let step = () => tickEventMovement(a, state, route, NO_OPTIONS, STEP_INTERVAL_MS, OPEN, () => 0);

	step();
	expect(a).toMatchObject({ x: 3, y: 2, facing: "right" });
	step();
	expect(a).toMatchObject({ x: 3, y: 3, facing: "down" });
	step();
	expect(a).toMatchObject({ x: 4, y: 3, facing: "right" });
});

test("tickEventMovement keeps the route cursor in phase when a step is blocked", () => {
	let a = actor(2, 2);
	let state = createMovementState();
	let route = movement({ type: "route", route: ["right", "down"] });
	let isBlocked = (x: number, y: number) => x === 3 && y === 2;

	tickEventMovement(a, state, route, NO_OPTIONS, STEP_INTERVAL_MS, isBlocked, () => 0);
	expect(a).toMatchObject({ x: 2, y: 2, facing: "right" });

	tickEventMovement(a, state, route, NO_OPTIONS, STEP_INTERVAL_MS, isBlocked, () => 0);
	expect(a).toMatchObject({ x: 2, y: 3, facing: "down" });
});

test("tickEventMovement blocks a random step against collision but still turns", () => {
	let a = actor(2, 2);
	let state = createMovementState();
	let isBlocked = (x: number, y: number) => !(x === 2 && y === 1);

	tickEventMovement(
		a,
		state,
		movement({ type: "random" }),
		NO_OPTIONS,
		STEP_INTERVAL_MS,
		isBlocked,
		() => 0,
	);
	expect(a).toMatchObject({ x: 2, y: 1, facing: "up" });
});

test("tickEventMovement leaves a boxed-in random entity put but does not crash", () => {
	let a = actor(2, 2);
	let state = createMovementState();
	tickEventMovement(
		a,
		state,
		movement({ type: "random" }),
		NO_OPTIONS,
		STEP_INTERVAL_MS,
		() => true,
		() => 0,
	);
	expect(a).toMatchObject({ x: 2, y: 2 });
});

test("tickEventMovement with through ignores collision and steps onto a blocked tile", () => {
	let a = actor(2, 2);
	let state = createMovementState();
	let route = movement({ type: "route", route: ["right"] });
	tickEventMovement(
		a,
		state,
		route,
		options({ through: true }),
		STEP_INTERVAL_MS,
		() => true,
		() => 0,
	);
	expect(a).toMatchObject({ x: 3, y: 2, facing: "right" });
});

test("tickEventMovement with directionFix moves without turning the facing", () => {
	let a = actor(2, 2);
	let state = createMovementState();
	let route = movement({ type: "route", route: ["right"] });
	tickEventMovement(
		a,
		state,
		route,
		options({ directionFix: true }),
		STEP_INTERVAL_MS,
		OPEN,
		() => 0,
	);
	expect(a).toMatchObject({ x: 3, y: 2, facing: "down" });
});
