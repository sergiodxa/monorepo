/**
 * Tests for the battle animation queue and its task factories.
 *
 * Covers `AnimationQueue` running tasks strictly in enqueue order, advancing
 * only the current task, `idle`, and `clear`, plus the `waitTask`,
 * `callbackTask`, and `runTask` factories that cover the common task shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import {
	type AnimationTask,
	AnimationQueue,
	callbackTask,
	runTask,
	waitTask,
} from "./animation-queue";

test("AnimationQueue is idle with no tasks", () => {
	let queue = new AnimationQueue();
	expect(queue.idle).toBe(true);
});

test("AnimationQueue runs tasks one at a time in enqueue order", () => {
	let order: string[] = [];
	let queue = new AnimationQueue();
	queue.enqueue(
		callbackTask(() => order.push("a")),
		callbackTask(() => order.push("b")),
	);

	expect(queue.idle).toBe(false);
	queue.update(16); // completes "a", drops it
	expect(order).toEqual(["a"]);
	queue.update(16); // completes "b", drops it
	expect(order).toEqual(["a", "b"]);
	expect(queue.idle).toBe(true);
});

test("AnimationQueue advances only the current task, not later ones", () => {
	let ran: string[] = [];
	let queue = new AnimationQueue();
	// A two-tick task followed by a one-tick task.
	let ticks = 0;
	let slow: AnimationTask = {
		update() {
			ran.push("slow");
			ticks++;
			return ticks >= 2;
		},
	};
	queue.enqueue(
		slow,
		callbackTask(() => ran.push("fast")),
	);

	queue.update(16); // slow tick 1, not done
	queue.update(16); // slow tick 2, done
	expect(ran).toEqual(["slow", "slow"]);
	queue.update(16); // now fast runs
	expect(ran).toEqual(["slow", "slow", "fast"]);
});

test("AnimationQueue update is a no-op when idle", () => {
	let queue = new AnimationQueue();
	expect(() => queue.update(16)).not.toThrow();
	expect(queue.idle).toBe(true);
});

test("AnimationQueue clear drops every remaining task", () => {
	let queue = new AnimationQueue();
	queue.enqueue(waitTask(1000), waitTask(1000));
	expect(queue.idle).toBe(false);
	queue.clear();
	expect(queue.idle).toBe(true);
});

test("waitTask completes only once the elapsed time reaches its duration", () => {
	let task = waitTask(100);
	expect(task.update(50)).toBe(false);
	expect(task.update(40)).toBe(false);
	expect(task.update(10)).toBe(true);
});

test("callbackTask runs its function once and completes immediately", () => {
	let calls = 0;
	let task = callbackTask(() => calls++);
	expect(task.update(16)).toBe(true);
	expect(calls).toBe(1);
});

test("runTask is backed directly by the supplied update function", () => {
	let seen: number[] = [];
	let task = runTask((dt) => {
		seen.push(dt);
		return seen.length >= 2;
	});
	expect(task.update(16)).toBe(false);
	expect(task.update(32)).toBe(true);
	expect(seen).toEqual([16, 32]);
});
