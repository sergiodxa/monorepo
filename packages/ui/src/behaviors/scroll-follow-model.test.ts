/**
 * Unit tests for {@link ScrollFollowModel}, constructed and driven directly
 * with no DOM and no rendering: every assertion reads model state or
 * observes dispatched "change" events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { ScrollFollowModel } from "./scroll-follow-model";

/** Collects `"change"` event dispatch counts for assertions. */
function countChanges(model: ScrollFollowModel): { count(): number } {
	let calls = 0;

	model.addEventListener("change", () => {
		calls++;
	});

	return { count: () => calls };
}

describe(ScrollFollowModel.name, () => {
	test("starts pinned, unanchored, with no visible messages and both edges unreachable", () => {
		let model = new ScrollFollowModel();

		expect(model.pinned).toBe(true);
		expect(model.anchorTurnId).toBeNull();
		expect(model.visibleMessageIds.size).toBe(0);
		expect(model.startReachable).toBe(false);
		expect(model.endReachable).toBe(false);
		expect(model.pendingScrollRequest).toBeNull();
	});

	test("constructor options seed initial state", () => {
		let model = new ScrollFollowModel({
			pinned: false,
			anchorTurnId: "turn-1",
			visibleMessageIds: ["msg-1", "msg-2"],
			reachableEdges: { start: true, end: false },
		});

		expect(model.pinned).toBe(false);
		expect(model.anchorTurnId).toBe("turn-1");
		expect([...model.visibleMessageIds]).toEqual(["msg-1", "msg-2"]);
		expect(model.startReachable).toBe(true);
		expect(model.endReachable).toBe(false);
	});

	describe("setPinned", () => {
		test("updates pinned and dispatches change", () => {
			let model = new ScrollFollowModel({ pinned: true });
			let changes = countChanges(model);

			model.setPinned(false);

			expect(model.pinned).toBe(false);
			expect(changes.count()).toBe(1);
		});

		test("is a no-op when the value is unchanged", () => {
			let model = new ScrollFollowModel({ pinned: true });
			let changes = countChanges(model);

			model.setPinned(true);

			expect(changes.count()).toBe(0);
		});
	});

	describe("setAnchorTurnId", () => {
		test("updates the anchor turn and dispatches change", () => {
			let model = new ScrollFollowModel();
			let changes = countChanges(model);

			model.setAnchorTurnId("turn-7");

			expect(model.anchorTurnId).toBe("turn-7");
			expect(changes.count()).toBe(1);
		});

		test("accepts null to clear the anchor and dispatches change", () => {
			let model = new ScrollFollowModel({ anchorTurnId: "turn-7" });
			let changes = countChanges(model);

			model.setAnchorTurnId(null);

			expect(model.anchorTurnId).toBeNull();
			expect(changes.count()).toBe(1);
		});

		test("is a no-op when the id is unchanged", () => {
			let model = new ScrollFollowModel({ anchorTurnId: "turn-7" });
			let changes = countChanges(model);

			model.setAnchorTurnId("turn-7");

			expect(changes.count()).toBe(0);
		});
	});

	describe("setMessageVisible / isMessageVisible", () => {
		test("marks a message visible and dispatches change", () => {
			let model = new ScrollFollowModel();
			let changes = countChanges(model);

			model.setMessageVisible("msg-1", true);

			expect(model.isMessageVisible("msg-1")).toBe(true);
			expect([...model.visibleMessageIds]).toEqual(["msg-1"]);
			expect(changes.count()).toBe(1);
		});

		test("marks a message hidden and dispatches change", () => {
			let model = new ScrollFollowModel({ visibleMessageIds: ["msg-1"] });
			let changes = countChanges(model);

			model.setMessageVisible("msg-1", false);

			expect(model.isMessageVisible("msg-1")).toBe(false);
			expect(model.visibleMessageIds.size).toBe(0);
			expect(changes.count()).toBe(1);
		});

		test("is a no-op when visibility is unchanged", () => {
			let model = new ScrollFollowModel({ visibleMessageIds: ["msg-1"] });
			let changes = countChanges(model);

			model.setMessageVisible("msg-1", true);

			expect(changes.count()).toBe(0);
		});

		test("isMessageVisible reports false for an id never reported visible", () => {
			let model = new ScrollFollowModel();

			expect(model.isMessageVisible("unknown")).toBe(false);
		});

		test("tracks multiple visible messages independently", () => {
			let model = new ScrollFollowModel();

			model.setMessageVisible("msg-1", true);
			model.setMessageVisible("msg-2", true);
			model.setMessageVisible("msg-1", false);

			expect(model.isMessageVisible("msg-1")).toBe(false);
			expect(model.isMessageVisible("msg-2")).toBe(true);
			expect([...model.visibleMessageIds]).toEqual(["msg-2"]);
		});
	});

	describe("setReachableEdges", () => {
		test("updates both edges and dispatches change", () => {
			let model = new ScrollFollowModel();
			let changes = countChanges(model);

			model.setReachableEdges({ start: true, end: true });

			expect(model.startReachable).toBe(true);
			expect(model.endReachable).toBe(true);
			expect(changes.count()).toBe(1);
		});

		test("dispatches change when only one edge changes", () => {
			let model = new ScrollFollowModel({ reachableEdges: { start: true, end: true } });
			let changes = countChanges(model);

			model.setReachableEdges({ start: true, end: false });

			expect(model.startReachable).toBe(true);
			expect(model.endReachable).toBe(false);
			expect(changes.count()).toBe(1);
		});

		test("is a no-op when neither edge changes", () => {
			let model = new ScrollFollowModel({ reachableEdges: { start: true, end: false } });
			let changes = countChanges(model);

			model.setReachableEdges({ start: true, end: false });

			expect(changes.count()).toBe(0);
		});
	});

	describe("scrollToEnd", () => {
		test("records an end request and dispatches change", () => {
			let model = new ScrollFollowModel();
			let changes = countChanges(model);

			model.scrollToEnd();

			expect(model.pendingScrollRequest).toEqual({ type: "end" });
			expect(changes.count()).toBe(1);
		});

		test("dispatches change again on a repeated call", () => {
			let model = new ScrollFollowModel();
			model.scrollToEnd();
			let changes = countChanges(model);

			model.scrollToEnd();

			expect(changes.count()).toBe(1);
		});
	});

	describe("scrollToStart", () => {
		test("records a start request and dispatches change", () => {
			let model = new ScrollFollowModel();
			let changes = countChanges(model);

			model.scrollToStart();

			expect(model.pendingScrollRequest).toEqual({ type: "start" });
			expect(changes.count()).toBe(1);
		});

		test("replaces a previously pending request", () => {
			let model = new ScrollFollowModel();
			model.scrollToEnd();

			model.scrollToStart();

			expect(model.pendingScrollRequest).toEqual({ type: "start" });
		});
	});

	describe("scrollToMessage", () => {
		test("records a message request with default align and smooth", () => {
			let model = new ScrollFollowModel();
			let changes = countChanges(model);

			model.scrollToMessage("msg-42");

			expect(model.pendingScrollRequest).toEqual({
				type: "message",
				id: "msg-42",
				align: "start",
				smooth: true,
			});
			expect(changes.count()).toBe(1);
		});

		test("honors explicit align and smooth options", () => {
			let model = new ScrollFollowModel();

			model.scrollToMessage("msg-42", { align: "center", smooth: false });

			expect(model.pendingScrollRequest).toEqual({
				type: "message",
				id: "msg-42",
				align: "center",
				smooth: false,
			});
		});
	});

	describe("consumeScrollRequest", () => {
		test("returns the pending request and clears it without dispatching change", () => {
			let model = new ScrollFollowModel();
			model.scrollToEnd();
			let changes = countChanges(model);

			let request = model.consumeScrollRequest();

			expect(request).toEqual({ type: "end" });
			expect(model.pendingScrollRequest).toBeNull();
			expect(changes.count()).toBe(0);
		});

		test("returns null when there is no pending request", () => {
			let model = new ScrollFollowModel();

			expect(model.consumeScrollRequest()).toBeNull();
		});

		test("returns null on a second call for the same request", () => {
			let model = new ScrollFollowModel();
			model.scrollToStart();

			model.consumeScrollRequest();
			let second = model.consumeScrollRequest();

			expect(second).toBeNull();
		});
	});

	test("removeEventListener stops delivering change events", () => {
		let model = new ScrollFollowModel();
		let changeCount = 0;
		let listener = () => {
			changeCount++;
		};

		model.addEventListener("change", listener);
		model.setPinned(false);
		model.removeEventListener("change", listener);
		model.scrollToEnd();

		expect(changeCount).toBe(1);
	});

	test("an aborted signal detaches the change listener", () => {
		let model = new ScrollFollowModel();
		let controller = new AbortController();
		let changeCount = 0;

		model.addEventListener(
			"change",
			() => {
				changeCount++;
			},
			{ signal: controller.signal },
		);

		model.setPinned(false);
		controller.abort();
		model.scrollToEnd();

		expect(changeCount).toBe(1);
	});
});
