/**
 * Unit tests for {@link Toaster}, constructed and driven directly with no
 * DOM and no rendering: `Date.now`, `setTimeout`, and `clearTimeout` are
 * faked so every timer assertion advances a virtual clock instead of
 * waiting on real time, and every other assertion reads queue state or
 * observes dispatched "toast"/"change" events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { Toaster } from "./toaster";

/** One pending call recorded by the faked `setTimeout`. */
interface FakeTimer {
	id: number;
	dueAt: number;
	callback: () => void;
}

describe(Toaster.name, () => {
	let now: number;
	let timers: FakeTimer[];
	let nextTimerId: number;
	let dateNowSpy: ReturnType<typeof spyOn>;
	let setTimeoutSpy: ReturnType<typeof spyOn>;
	let clearTimeoutSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		now = 0;
		timers = [];
		nextTimerId = 0;

		dateNowSpy = spyOn(Date, "now").mockImplementation(() => now);

		setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((
			callback: () => void,
			delay?: number,
		) => {
			let id = ++nextTimerId;
			timers.push({ id, dueAt: now + (delay ?? 0), callback });
			return id as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout);

		clearTimeoutSpy = spyOn(globalThis, "clearTimeout").mockImplementation(((id: number) => {
			timers = timers.filter((timer) => timer.id !== id);
		}) as typeof clearTimeout);
	});

	afterEach(() => {
		dateNowSpy.mockRestore();
		setTimeoutSpy.mockRestore();
		clearTimeoutSpy.mockRestore();
	});

	/** Advances the virtual clock by `ms` and fires every timer now due, in schedule order. */
	function advance(ms: number): void {
		now += ms;

		let due = timers.filter((timer) => timer.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
		timers = timers.filter((timer) => timer.dueAt > now);

		for (let timer of due) timer.callback();
	}

	test("starts with an empty queue", () => {
		let toaster = new Toaster();

		expect(toaster.toasts).toEqual([]);
		expect(toaster.size).toBe(0);
	});

	test("add queues a toast with the given data and duration, not paused", () => {
		let toaster = new Toaster<{ title: string }>();

		let id = toaster.add({ title: "Saved" }, { duration: 3000 });

		expect(toaster.size).toBe(1);
		expect(toaster.get(id)).toEqual({
			id,
			data: { title: "Saved" },
			duration: 3000,
			createdAt: 0,
			paused: false,
		});
	});

	test("add generates a unique id per toast when none is given", () => {
		let toaster = new Toaster();

		let firstId = toaster.add("first");
		let secondId = toaster.add("second");

		expect(firstId).not.toBe(secondId);
		expect(toaster.toasts.map((toast) => toast.id)).toEqual([firstId, secondId]);
	});

	test("add dispatches toast and then change", () => {
		let toaster = new Toaster();
		let order: string[] = [];

		toaster.addEventListener("toast", () => order.push("toast"));
		toaster.addEventListener("change", () => order.push("change"));

		toaster.add("hello");

		expect(order).toEqual(["toast", "change"]);
	});

	test("a toast auto-dismisses once its duration elapses", () => {
		let toaster = new Toaster();
		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		let id = toaster.add("hello", { duration: 1000 });
		changeCount = 0;

		advance(999);
		expect(toaster.get(id)).toBeDefined();

		advance(1);
		expect(toaster.get(id)).toBeUndefined();
		expect(toaster.size).toBe(0);
		expect(changeCount).toBe(1);
	});

	test("a toast with a null duration never auto-dismisses", () => {
		let toaster = new Toaster();

		let id = toaster.add("persistent", { duration: null });

		advance(1_000_000);

		expect(toaster.get(id)).toEqual({
			id,
			data: "persistent",
			duration: null,
			createdAt: 0,
			paused: false,
		});
	});

	test("add reuses an id already queued, replacing the toast and its timer", () => {
		let toaster = new Toaster();

		toaster.add("first", { id: "shared", duration: 1000 });
		toaster.add("second", { id: "shared", duration: 5000 });

		expect(toaster.size).toBe(1);
		expect(toaster.get("shared")?.data).toBe("second");
		expect(toaster.get("shared")?.duration).toBe(5000);

		// The first toast's 1000ms timer must have been cleared, not just outlived.
		advance(1000);
		expect(toaster.get("shared")).toBeDefined();

		advance(4000);
		expect(toaster.get("shared")).toBeUndefined();
	});

	test("update patches data without resetting the timer", () => {
		let toaster = new Toaster<string>();
		let id = toaster.add("loading", { duration: 1000 });

		advance(600);
		let updated = toaster.update(id, "done");

		expect(updated).toBe(true);
		expect(toaster.get(id)?.data).toBe("done");

		advance(399);
		expect(toaster.get(id)).toBeDefined();

		advance(1);
		expect(toaster.get(id)).toBeUndefined();
	});

	test("update with a duration restarts the timer from full", () => {
		let toaster = new Toaster<string>();
		let id = toaster.add("loading", { duration: 1000 });

		advance(900);
		toaster.update(id, "done", { duration: 1000 });

		advance(900);
		expect(toaster.get(id)).toBeDefined();

		advance(100);
		expect(toaster.get(id)).toBeUndefined();
	});

	test("update with an unknown id returns false and does not dispatch change", () => {
		let toaster = new Toaster();
		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		let updated = toaster.update("unknown", "data");

		expect(updated).toBe(false);
		expect(changeCount).toBe(0);
	});

	test("dismiss removes a toast by id and clears its timer", () => {
		let toaster = new Toaster();
		let id = toaster.add("hello", { duration: 1000 });

		let dismissed = toaster.dismiss(id);

		expect(dismissed).toBe(true);
		expect(toaster.get(id)).toBeUndefined();

		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);
		advance(1000);

		// Nothing left to fire: the timer was cleared, not just orphaned.
		expect(changeCount).toBe(0);
	});

	test("dismiss with an unknown id returns false and does not dispatch change", () => {
		let toaster = new Toaster();
		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		let dismissed = toaster.dismiss("unknown");

		expect(dismissed).toBe(false);
		expect(changeCount).toBe(0);
	});

	test("dismissAll empties the queue, clears every timer, and dispatches change once", () => {
		let toaster = new Toaster();
		toaster.add("first", { duration: 1000 });
		toaster.add("second", { duration: 2000 });

		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		toaster.dismissAll();

		expect(toaster.toasts).toEqual([]);
		expect(changeCount).toBe(1);

		advance(2000);
		expect(changeCount).toBe(1);
	});

	test("dismissAll on an already empty queue does nothing and does not dispatch change", () => {
		let toaster = new Toaster();
		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		toaster.dismissAll();

		expect(changeCount).toBe(0);
	});

	test("pause stops a toast's countdown until resume, which continues from the time left", () => {
		let toaster = new Toaster();
		let id = toaster.add("hello", { duration: 1000 });

		advance(400);
		toaster.pause(id);
		expect(toaster.get(id)?.paused).toBe(true);

		// Paused: advancing well past the original duration must not dismiss it.
		advance(10_000);
		expect(toaster.get(id)).toBeDefined();

		toaster.resume(id);
		expect(toaster.get(id)?.paused).toBe(false);

		// 600ms were left when paused.
		advance(599);
		expect(toaster.get(id)).toBeDefined();

		advance(1);
		expect(toaster.get(id)).toBeUndefined();
	});

	test("pause and resume with no id apply to every queued toast", () => {
		let toaster = new Toaster();
		let firstId = toaster.add("first", { duration: 1000 });
		let secondId = toaster.add("second", { duration: 2000 });

		toaster.pause();

		expect(toaster.get(firstId)?.paused).toBe(true);
		expect(toaster.get(secondId)?.paused).toBe(true);

		advance(5000);
		expect(toaster.size).toBe(2);

		toaster.resume();

		expect(toaster.get(firstId)?.paused).toBe(false);
		expect(toaster.get(secondId)?.paused).toBe(false);

		advance(1000);
		expect(toaster.get(firstId)).toBeUndefined();
		expect(toaster.get(secondId)).toBeDefined();

		advance(1000);
		expect(toaster.get(secondId)).toBeUndefined();
	});

	test("pause does not dispatch change for an unknown id, an already-paused toast, or a persistent toast", () => {
		let toaster = new Toaster();
		let runningId = toaster.add("running", { duration: 1000 });
		let persistentId = toaster.add("persistent", { duration: null });

		toaster.pause(runningId);

		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		toaster.pause("unknown");
		toaster.pause(runningId);
		toaster.pause(persistentId);

		expect(changeCount).toBe(0);
	});

	test("resume does not dispatch change for a toast that is not paused", () => {
		let toaster = new Toaster();
		let id = toaster.add("hello", { duration: 1000 });

		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		toaster.resume(id);

		expect(changeCount).toBe(0);
	});

	test("dispose clears every pending timer without dispatching further events", () => {
		let toaster = new Toaster();
		toaster.add("first", { duration: 1000 });
		toaster.add("second", { duration: 2000 });

		let changeCount = 0;
		toaster.addEventListener("change", () => changeCount++);

		toaster.dispose();

		expect(toaster.toasts).toEqual([]);
		expect(changeCount).toBe(0);

		advance(2000);
		expect(changeCount).toBe(0);
	});

	test("removeEventListener stops delivering change events", () => {
		let toaster = new Toaster();
		let changeCount = 0;
		let listener = () => changeCount++;

		toaster.addEventListener("change", listener);
		toaster.add("first");
		toaster.removeEventListener("change", listener);
		toaster.add("second");

		expect(changeCount).toBe(1);
	});

	test("an aborted signal detaches the change listener", () => {
		let toaster = new Toaster();
		let controller = new AbortController();
		let changeCount = 0;

		toaster.addEventListener("change", () => changeCount++, { signal: controller.signal });

		toaster.add("first");
		controller.abort();
		toaster.add("second");

		expect(changeCount).toBe(1);
	});
});
