/**
 * Unit tests for the `ResizeSession` behavior class: construct the class,
 * drive it through pointer-session and constraint-solving methods, and
 * assert on its state and dispatched events, with no DOM involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ResizeSession } from "./resize-session";

/**
 * Collects every event of a given type dispatched by a target for the
 * lifetime of a test, so assertions can check both count and ordering.
 */
function record(target: EventTarget, type: string): string[] {
	let log: string[] = [];
	target.addEventListener(type, () => log.push(type));
	return log;
}

describe("ResizeSession", () => {
	test("starts idle with no active session and no panels", () => {
		let session = new ResizeSession();

		expect(session.isActive).toBe(false);
		expect(session.activeHandleIndex).toBeNull();
		expect(session.panels).toEqual([]);
	});

	test("start() activates the session and resolves default min/max", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 40 },
				{ id: "c", size: 30 },
			],
			pointerPosition: 100,
			groupSize: 1000,
		});

		expect(session.isActive).toBe(true);
		expect(session.activeHandleIndex).toBe(0);
		expect(session.panels).toEqual([
			{ id: "a", size: 30, min: 0, max: 100 },
			{ id: "b", size: 40, min: 0, max: 100 },
			{ id: "c", size: 30, min: 0, max: 100 },
		]);
	});

	test("start() honors explicit min/max instead of the defaults", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30, min: 10, max: 60 },
				{ id: "b", size: 70, min: 20 },
			],
			pointerPosition: 0,
			groupSize: 500,
		});

		expect(session.panels).toEqual([
			{ id: "a", size: 30, min: 10, max: 60 },
			{ id: "b", size: 70, min: 20, max: 100 },
		]);
	});

	test("start() throws when panels has fewer than two entries", () => {
		let session = new ResizeSession();

		expect(() =>
			session.start({
				handleIndex: 0,
				panels: [{ id: "a", size: 100 }],
				pointerPosition: 0,
				groupSize: 500,
			}),
		).toThrow(RangeError);
	});

	test("start() throws for a handleIndex with no adjacent panel pair", () => {
		let session = new ResizeSession();
		let panels = [
			{ id: "a", size: 50 },
			{ id: "b", size: 50 },
		];

		expect(() =>
			session.start({ handleIndex: -1, panels, pointerPosition: 0, groupSize: 500 }),
		).toThrow(RangeError);
		expect(() =>
			session.start({ handleIndex: 1, panels, pointerPosition: 0, groupSize: 500 }),
		).toThrow(RangeError);
	});

	test("start() throws when a session is already active", () => {
		let session = new ResizeSession();
		let panels = [
			{ id: "a", size: 50 },
			{ id: "b", size: 50 },
		];

		session.start({ handleIndex: 0, panels, pointerPosition: 0, groupSize: 500 });

		expect(() =>
			session.start({ handleIndex: 0, panels, pointerPosition: 0, groupSize: 500 }),
		).toThrow(Error);
	});

	test("move() grows the left panel and shrinks its immediate right neighbor", () => {
		let session = new ResizeSession();
		let changes = record(session, "change");

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 40 },
				{ id: "c", size: 30 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});

		session.move(50); // +50px / 1000px group = +5 size units

		expect(session.panels).toEqual([
			{ id: "a", size: 35, min: 0, max: 100 },
			{ id: "b", size: 35, min: 0, max: 100 },
			{ id: "c", size: 30, min: 0, max: 100 },
		]);
		expect(changes).toEqual(["change"]);
	});

	test("move() shrinks the left panel and grows the right one for a negative delta", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 1,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 40 },
				{ id: "c", size: 30 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});

		session.move(-150); // -150px / 1000px group = -15 size units

		expect(session.panels).toEqual([
			{ id: "a", size: 30, min: 0, max: 100 },
			{ id: "b", size: 25, min: 0, max: 100 },
			{ id: "c", size: 45, min: 0, max: 100 },
		]);
	});

	test("move() recomputes from the session baseline instead of accumulating drift", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 40 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});

		session.move(50);
		session.move(20);
		session.move(80);

		// Every move() is relative to pointerPosition 0, so only the final
		// position's delta (+8 size units) should be reflected, not the sum.
		expect(session.panels[0]?.size).toBe(38);
		expect(session.panels[1]?.size).toBe(32);
	});

	test("move() cascades a shrink into a further panel once the immediate neighbor hits its min", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 40, min: 32 },
				{ id: "c", size: 30 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});

		session.move(200); // request +20 size units

		expect(session.panels).toEqual([
			{ id: "a", size: 50, min: 0, max: 100 },
			{ id: "b", size: 32, min: 32, max: 100 }, // bottomed out at its min
			{ id: "c", size: 18, min: 0, max: 100 }, // absorbed the remainder
		]);
	});

	test("move() clamps to the growing panel's headroom even with donor room to spare", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30, max: 40 },
				{ id: "b", size: 40 },
				{ id: "c", size: 30 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});

		session.move(200); // request +20 size units, but "a" can only grow by 10

		expect(session.panels).toEqual([
			{ id: "a", size: 40, min: 0, max: 40 },
			{ id: "b", size: 30, min: 0, max: 100 },
			{ id: "c", size: 30, min: 0, max: 100 },
		]);
	});

	test("move() clamps to total donor availability across the whole group", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 1,
			panels: [
				{ id: "a", size: 30, min: 25 },
				{ id: "b", size: 40, min: 38 },
				{ id: "c", size: 30 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});

		session.move(-1500); // request -150 size units, far more than the group can give up

		expect(session.panels).toEqual([
			{ id: "a", size: 25, min: 25, max: 100 }, // bottomed out
			{ id: "b", size: 38, min: 38, max: 100 }, // bottomed out
			{ id: "c", size: 37, min: 0, max: 100 }, // only absorbed what was available (5 + 2)
		]);
	});

	test("move() is a no-op when no session is active", () => {
		let session = new ResizeSession();
		let changes = record(session, "change");

		session.move(500);

		expect(session.panels).toEqual([]);
		expect(changes).toEqual([]);
	});

	test("end() finalizes the session, keeping the last solved sizes", () => {
		let session = new ResizeSession();
		let ends = record(session, "end");

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 70 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});
		session.move(100);
		session.end();

		expect(session.isActive).toBe(false);
		expect(session.activeHandleIndex).toBeNull();
		expect(session.panels[0]?.size).toBe(40);
		expect(ends).toEqual(["end"]);
	});

	test("end() is a no-op when no session is active", () => {
		let session = new ResizeSession();
		let ends = record(session, "end");

		session.end();

		expect(ends).toEqual([]);
	});

	test("cancel() reverts every panel to its size at start() and dispatches change then end", () => {
		let session = new ResizeSession();
		let log: string[] = [];
		session.addEventListener("change", () => log.push("change"));
		session.addEventListener("end", () => log.push("end"));

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 70 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});
		session.move(100); // sizes become 40 / 60
		log.length = 0; // ignore the move()'s change event for this assertion

		session.cancel();

		expect(session.panels).toEqual([
			{ id: "a", size: 30, min: 0, max: 100 },
			{ id: "b", size: 70, min: 0, max: 100 },
		]);
		expect(session.isActive).toBe(false);
		expect(log).toEqual(["change", "end"]);
	});

	test("cancel() is a no-op when no session is active", () => {
		let session = new ResizeSession();
		let log = record(session, "change");

		session.cancel();

		expect(log).toEqual([]);
		expect(session.isActive).toBe(false);
	});

	test("panels getter returns a defensive copy that cannot mutate session state", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 30 },
				{ id: "b", size: 70 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});

		let firstRead = session.panels;
		firstRead[0]!.size = 999;

		expect(session.panels[0]?.size).toBe(30);
	});

	test("a session can be started again after end()", () => {
		let session = new ResizeSession();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "a", size: 50 },
				{ id: "b", size: 50 },
			],
			pointerPosition: 0,
			groupSize: 1000,
		});
		session.end();

		session.start({
			handleIndex: 0,
			panels: [
				{ id: "x", size: 20 },
				{ id: "y", size: 80 },
			],
			pointerPosition: 10,
			groupSize: 500,
		});

		expect(session.isActive).toBe(true);
		expect(session.panels).toEqual([
			{ id: "x", size: 20, min: 0, max: 100 },
			{ id: "y", size: 80, min: 0, max: 100 },
		]);
	});
});
