/**
 * Unit tests for {@link DragSession}, constructed and driven directly with no
 * DOM and no rendering: every assertion reads session state or observes
 * dispatched "change" events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { DragSession } from "./drag-session";

/** Collects `"change"` event dispatch counts for assertions. */
function countChanges(session: DragSession): { count(): number } {
	let calls = 0;

	session.addEventListener("change", () => {
		calls++;
	});

	return { count: () => calls };
}

describe(DragSession.name, () => {
	test("starts with no source, no target, and inactive", () => {
		let session = new DragSession();

		expect(session.source).toBeNull();
		expect(session.target).toBeNull();
		expect(session.active).toBe(false);
	});

	test("start sets the source, becomes active, and dispatches change", () => {
		let session = new DragSession<{ index: number }>();
		let changes = countChanges(session);

		session.start({ key: "row-1", data: { index: 0 } });

		expect(session.source).toEqual({ key: "row-1", data: { index: 0 } });
		expect(session.active).toBe(true);
		expect(changes.count()).toBe(1);
	});

	test("start clears any target left over from a prior session", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		session.moveOver({ key: "row-2", position: "after" });

		session.start({ key: "row-3" });

		expect(session.source).toEqual({ key: "row-3" });
		expect(session.target).toBeNull();
	});

	test("moveOver records the drop candidate and dispatches change", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		let changes = countChanges(session);

		session.moveOver({ key: "row-2", position: "after" });

		expect(session.target).toEqual({ key: "row-2", position: "after" });
		expect(changes.count()).toBe(1);
	});

	test("moveOver does nothing before a session has started", () => {
		let session = new DragSession();
		let changes = countChanges(session);

		session.moveOver({ key: "row-2", position: "after" });

		expect(session.target).toBeNull();
		expect(changes.count()).toBe(0);
	});

	test("moveOver with the same key and position does not dispatch change", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		session.moveOver({ key: "row-2", position: "after" });
		let changes = countChanges(session);

		session.moveOver({ key: "row-2", position: "after" });

		expect(changes.count()).toBe(0);
	});

	test("moveOver with the same key but a different position dispatches change", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		session.moveOver({ key: "row-2", position: "after" });
		let changes = countChanges(session);

		session.moveOver({ key: "row-2", position: "before" });

		expect(session.target).toEqual({ key: "row-2", position: "before" });
		expect(changes.count()).toBe(1);
	});

	test("clearTarget clears an active target and dispatches change", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		session.moveOver({ key: "row-2", position: "after" });
		let changes = countChanges(session);

		session.clearTarget();

		expect(session.target).toBeNull();
		expect(changes.count()).toBe(1);
	});

	test("clearTarget does nothing when there is no target set", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		let changes = countChanges(session);

		session.clearTarget();

		expect(changes.count()).toBe(0);
	});

	test("drop returns the source and target, then ends the session", () => {
		let session = new DragSession<{ index: number }>();
		session.start({ key: "row-1", data: { index: 0 } });
		session.moveOver({ key: "row-3", position: "before" });
		let changes = countChanges(session);

		let detail = session.drop();

		expect(detail).toEqual({
			source: { key: "row-1", data: { index: 0 } },
			target: { key: "row-3", position: "before" },
		});
		expect(session.source).toBeNull();
		expect(session.target).toBeNull();
		expect(session.active).toBe(false);
		expect(changes.count()).toBe(1);
	});

	test("drop returns null and dispatches nothing without an active session", () => {
		let session = new DragSession();
		let changes = countChanges(session);

		let detail = session.drop();

		expect(detail).toBeNull();
		expect(changes.count()).toBe(0);
	});

	test("drop returns null and dispatches nothing when there is no current target", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		let changes = countChanges(session);

		let detail = session.drop();

		expect(detail).toBeNull();
		expect(session.active).toBe(true);
		expect(changes.count()).toBe(0);
	});

	test("cancel ends an active session and dispatches change", () => {
		let session = new DragSession();
		session.start({ key: "row-1" });
		session.moveOver({ key: "row-2", position: "on" });
		let changes = countChanges(session);

		session.cancel();

		expect(session.source).toBeNull();
		expect(session.target).toBeNull();
		expect(session.active).toBe(false);
		expect(changes.count()).toBe(1);
	});

	test("cancel does nothing without an active session", () => {
		let session = new DragSession();
		let changes = countChanges(session);

		session.cancel();

		expect(changes.count()).toBe(0);
	});

	test("removeEventListener stops delivering change events", () => {
		let session = new DragSession();
		let changeCount = 0;
		let listener = () => {
			changeCount++;
		};

		session.addEventListener("change", listener);
		session.start({ key: "row-1" });
		session.removeEventListener("change", listener);
		session.cancel();

		expect(changeCount).toBe(1);
	});

	test("an aborted signal detaches the change listener", () => {
		let session = new DragSession();
		let controller = new AbortController();
		let changeCount = 0;

		session.addEventListener(
			"change",
			() => {
				changeCount++;
			},
			{ signal: controller.signal },
		);

		session.start({ key: "row-1" });
		controller.abort();
		session.cancel();

		expect(changeCount).toBe(1);
	});
});
