/**
 * Covers `SelectionModel` state transitions and dispatched `"change"` events:
 * constructor clamping, point/toggle/range/select-all/clear semantics per
 * mode, anchor tracking, key/disabled-key set replacement and pruning, and
 * the no-op guard that keeps `"change"` from firing when a call does not
 * actually alter the selected-key set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { SelectionModel } from "./selection-model";

/**
 * Subscribes to a model's `"change"` event and returns a counter reflecting
 * how many times it has fired so far.
 */
function countChanges(model: SelectionModel): { readonly count: number } {
	let counter = { count: 0 };
	model.addEventListener("change", () => {
		counter.count += 1;
	});
	return counter;
}

describe(SelectionModel.name, () => {
	describe("constructor", () => {
		test("defaults to an empty, multiple-mode model with no known keys", () => {
			let model = new SelectionModel();

			expect(model.mode).toBe("multiple");
			expect(model.keys).toEqual([]);
			expect(model.selectedKeys.size).toBe(0);
			expect(model.disabledKeys.size).toBe(0);
			expect(model.anchorKey).toBeNull();
			expect(model.isEmpty).toBe(true);
			expect(model.isAll).toBe(false);
			expect(model.size).toBe(0);
		});

		test("accepts an initial mode, keys, disabledKeys, and selectedKeys", () => {
			let model = new SelectionModel({
				mode: "multiple",
				keys: ["a", "b", "c"],
				disabledKeys: ["b"],
				selectedKeys: ["a", "c"],
			});

			expect(model.keys).toEqual(["a", "b", "c"]);
			expect(model.disabledKeys.has("b")).toBe(true);
			expect(model.selectedKeys).toEqual(new Set(["a", "c"]));
		});

		test("drops disabled keys from the initial selection", () => {
			let model = new SelectionModel({
				disabledKeys: ["a"],
				selectedKeys: ["a", "b"],
			});

			expect(model.selectedKeys).toEqual(new Set(["b"]));
		});

		test("dedupes repeated keys", () => {
			let model = new SelectionModel({ keys: ["a", "a", "b"] });

			expect(model.keys).toEqual(["a", "b"]);
		});

		test("clamps an initial multi-key selection down to one key in single mode", () => {
			let model = new SelectionModel({
				mode: "single",
				selectedKeys: ["a", "b", "c"],
			});

			expect(model.selectedKeys).toEqual(new Set(["a"]));
		});

		test("clamps the initial selection to empty in none mode", () => {
			let model = new SelectionModel({
				mode: "none",
				selectedKeys: ["a", "b"],
			});

			expect(model.selectedKeys.size).toBe(0);
		});
	});

	describe("select", () => {
		test("adds a key in multiple mode without dropping the existing selection", () => {
			let model = new SelectionModel();

			model.select("a");
			model.select("b");

			expect(model.selectedKeys).toEqual(new Set(["a", "b"]));
		});

		test("replaces the selection in single mode", () => {
			let model = new SelectionModel({ mode: "single" });

			model.select("a");
			model.select("b");

			expect(model.selectedKeys).toEqual(new Set(["b"]));
		});

		test("sets anchorKey to the selected key", () => {
			let model = new SelectionModel();

			model.select("a");

			expect(model.anchorKey).toBe("a");
		});

		test("is a no-op for a disabled key", () => {
			let model = new SelectionModel({ disabledKeys: ["a"] });
			let changes = countChanges(model);

			model.select("a");

			expect(model.selectedKeys.size).toBe(0);
			expect(model.anchorKey).toBeNull();
			expect(changes.count).toBe(0);
		});

		test("is a no-op in none mode", () => {
			let model = new SelectionModel({ mode: "none" });
			let changes = countChanges(model);

			model.select("a");

			expect(model.selectedKeys.size).toBe(0);
			expect(model.anchorKey).toBeNull();
			expect(changes.count).toBe(0);
		});

		test("allows selecting a key absent from the known key list", () => {
			let model = new SelectionModel({ keys: ["a", "b"] });

			model.select("z");

			expect(model.selectedKeys.has("z")).toBe(true);
		});
	});

	describe("deselect", () => {
		test("removes a selected key", () => {
			let model = new SelectionModel({ selectedKeys: ["a", "b"] });

			model.deselect("a");

			expect(model.selectedKeys).toEqual(new Set(["b"]));
		});

		test("sets anchorKey to the deselected key", () => {
			let model = new SelectionModel({ selectedKeys: ["a"] });

			model.deselect("a");

			expect(model.anchorKey).toBe("a");
		});

		test("is a no-op when the key was not selected", () => {
			let model = new SelectionModel({ selectedKeys: ["a"] });
			let changes = countChanges(model);

			model.deselect("z");

			expect(model.selectedKeys).toEqual(new Set(["a"]));
			expect(model.anchorKey).toBeNull();
			expect(changes.count).toBe(0);
		});
	});

	describe("toggle", () => {
		test("adds an unselected key in multiple mode", () => {
			let model = new SelectionModel();

			model.toggle("a");

			expect(model.selectedKeys).toEqual(new Set(["a"]));
			expect(model.anchorKey).toBe("a");
		});

		test("removes an already-selected key in multiple mode", () => {
			let model = new SelectionModel({ selectedKeys: ["a", "b"] });

			model.toggle("a");

			expect(model.selectedKeys).toEqual(new Set(["b"]));
			expect(model.anchorKey).toBe("a");
		});

		test("replaces the selection with the key in single mode when unselected", () => {
			let model = new SelectionModel({ mode: "single", selectedKeys: ["a"] });

			model.toggle("b");

			expect(model.selectedKeys).toEqual(new Set(["b"]));
		});

		test("clears the selection in single mode when the key was already selected", () => {
			let model = new SelectionModel({ mode: "single", selectedKeys: ["a"] });

			model.toggle("a");

			expect(model.selectedKeys.size).toBe(0);
		});

		test("is a no-op for a disabled key", () => {
			let model = new SelectionModel({ disabledKeys: ["a"] });
			let changes = countChanges(model);

			model.toggle("a");

			expect(model.selectedKeys.size).toBe(0);
			expect(changes.count).toBe(0);
		});

		test("is a no-op in none mode", () => {
			let model = new SelectionModel({ mode: "none" });
			let changes = countChanges(model);

			model.toggle("a");

			expect(model.selectedKeys.size).toBe(0);
			expect(changes.count).toBe(0);
		});
	});

	describe("selectRange", () => {
		test("selects the contiguous span from the anchor forward", () => {
			let model = new SelectionModel({ keys: ["a", "b", "c", "d", "e"] });

			model.toggle("b");
			model.selectRange("d");

			expect(model.selectedKeys).toEqual(new Set(["b", "c", "d"]));
		});

		test("selects the contiguous span from the anchor backward", () => {
			let model = new SelectionModel({ keys: ["a", "b", "c", "d", "e"] });

			model.toggle("d");
			model.selectRange("b");

			expect(model.selectedKeys).toEqual(new Set(["b", "c", "d"]));
		});

		test("keeps the anchor unchanged so repeated calls re-span from the same start", () => {
			let model = new SelectionModel({ keys: ["a", "b", "c", "d", "e"] });

			model.toggle("b");
			model.selectRange("d");
			model.selectRange("a");

			expect(model.anchorKey).toBe("b");
			expect(model.selectedKeys).toEqual(new Set(["a", "b"]));
		});

		test("excludes disabled keys within the span", () => {
			let model = new SelectionModel({
				keys: ["a", "b", "c", "d"],
				disabledKeys: ["c"],
			});

			model.toggle("a");
			model.selectRange("d");

			expect(model.selectedKeys).toEqual(new Set(["a", "b", "d"]));
		});

		test("is a no-op when the target key is disabled", () => {
			let model = new SelectionModel({
				keys: ["a", "b", "c"],
				disabledKeys: ["c"],
			});

			model.toggle("a");
			let changes = countChanges(model);
			model.selectRange("c");

			expect(model.selectedKeys).toEqual(new Set(["a"]));
			expect(changes.count).toBe(0);
		});

		test("falls back to toggle when there is no anchor yet", () => {
			let model = new SelectionModel({ keys: ["a", "b", "c"] });

			model.selectRange("b");

			expect(model.selectedKeys).toEqual(new Set(["b"]));
			expect(model.anchorKey).toBe("b");
		});

		test("falls back to toggle when the keys are unknown to the model", () => {
			let model = new SelectionModel();

			model.toggle("a");
			model.selectRange("b");

			expect(model.selectedKeys).toEqual(new Set(["a", "b"]));
			expect(model.anchorKey).toBe("b");
		});

		test("falls back to toggle outside multiple mode", () => {
			let model = new SelectionModel({ mode: "single", keys: ["a", "b", "c"] });

			model.toggle("a");
			model.selectRange("c");

			expect(model.selectedKeys).toEqual(new Set(["c"]));
			expect(model.anchorKey).toBe("c");
		});
	});

	describe("selectAll", () => {
		test("selects every non-disabled known key in multiple mode", () => {
			let model = new SelectionModel({
				keys: ["a", "b", "c"],
				disabledKeys: ["b"],
			});

			model.selectAll();

			expect(model.selectedKeys).toEqual(new Set(["a", "c"]));
			expect(model.isAll).toBe(true);
		});

		test("is a no-op outside multiple mode", () => {
			let model = new SelectionModel({ mode: "single", keys: ["a", "b"] });
			let changes = countChanges(model);

			model.selectAll();

			expect(model.selectedKeys.size).toBe(0);
			expect(changes.count).toBe(0);
		});

		test("is a no-op when there are no known keys", () => {
			let model = new SelectionModel();
			let changes = countChanges(model);

			model.selectAll();

			expect(model.selectedKeys.size).toBe(0);
			expect(changes.count).toBe(0);
		});
	});

	describe("clear", () => {
		test("deselects every key", () => {
			let model = new SelectionModel({ selectedKeys: ["a", "b"] });

			model.clear();

			expect(model.selectedKeys.size).toBe(0);
		});

		test("is a no-op when already empty", () => {
			let model = new SelectionModel();
			let changes = countChanges(model);

			model.clear();

			expect(changes.count).toBe(0);
		});
	});

	describe("setKeys", () => {
		test("replaces the known key order", () => {
			let model = new SelectionModel({ keys: ["a", "b"] });

			model.setKeys(["c", "d"]);

			expect(model.keys).toEqual(["c", "d"]);
		});

		test("dedupes repeated keys", () => {
			let model = new SelectionModel();

			model.setKeys(["a", "a", "b"]);

			expect(model.keys).toEqual(["a", "b"]);
		});

		test("prunes selected keys that are no longer known", () => {
			let model = new SelectionModel({ keys: ["a", "b", "c"], selectedKeys: ["a", "b"] });

			model.setKeys(["b", "c"]);

			expect(model.selectedKeys).toEqual(new Set(["b"]));
		});

		test("clears anchorKey when the anchor is no longer known", () => {
			let model = new SelectionModel({ keys: ["a", "b"] });

			model.toggle("a");
			model.setKeys(["b"]);

			expect(model.anchorKey).toBeNull();
		});

		test("keeps anchorKey when it is still known", () => {
			let model = new SelectionModel({ keys: ["a", "b"] });

			model.toggle("a");
			model.setKeys(["a", "b", "c"]);

			expect(model.anchorKey).toBe("a");
		});

		test("does not dispatch change when the selection is unaffected", () => {
			let model = new SelectionModel({ keys: ["a", "b"], selectedKeys: ["a"] });
			let changes = countChanges(model);

			model.setKeys(["a", "b", "c"]);

			expect(changes.count).toBe(0);
		});
	});

	describe("setDisabledKeys", () => {
		test("replaces the disabled key set", () => {
			let model = new SelectionModel({ disabledKeys: ["a"] });

			model.setDisabledKeys(["b"]);

			expect(model.isDisabled("a")).toBe(false);
			expect(model.isDisabled("b")).toBe(true);
		});

		test("drops newly disabled keys from the selection", () => {
			let model = new SelectionModel({ selectedKeys: ["a", "b", "c"] });

			model.setDisabledKeys(["b"]);

			expect(model.selectedKeys).toEqual(new Set(["a", "c"]));
		});

		test("does not dispatch change when nothing selected becomes disabled", () => {
			let model = new SelectionModel({ selectedKeys: ["a"] });
			let changes = countChanges(model);

			model.setDisabledKeys(["z"]);

			expect(changes.count).toBe(0);
		});
	});

	describe("setMode", () => {
		test("is a no-op when set to the current mode", () => {
			let model = new SelectionModel({ selectedKeys: ["a", "b"] });
			let changes = countChanges(model);

			model.setMode("multiple");

			expect(model.selectedKeys).toEqual(new Set(["a", "b"]));
			expect(changes.count).toBe(0);
		});

		test("clamps down to the first selected key when switching to single", () => {
			let model = new SelectionModel();

			model.select("a");
			model.select("b");
			model.setMode("single");

			expect(model.selectedKeys).toEqual(new Set(["a"]));
		});

		test("clears the selection when switching to none", () => {
			let model = new SelectionModel({ selectedKeys: ["a", "b"] });

			model.setMode("none");

			expect(model.selectedKeys.size).toBe(0);
		});

		test("allows growing the selection again after switching back to multiple", () => {
			let model = new SelectionModel({ mode: "single", selectedKeys: ["a"] });

			model.setMode("multiple");
			model.select("b");

			expect(model.selectedKeys).toEqual(new Set(["a", "b"]));
		});
	});

	describe("isSelected / isDisabled", () => {
		test("reflect current selection and disabled membership", () => {
			let model = new SelectionModel({ disabledKeys: ["b"], selectedKeys: ["a"] });

			expect(model.isSelected("a")).toBe(true);
			expect(model.isSelected("b")).toBe(false);
			expect(model.isDisabled("b")).toBe(true);
			expect(model.isDisabled("a")).toBe(false);
		});
	});

	describe("change event", () => {
		test("fires exactly once per call that mutates the selection", () => {
			let model = new SelectionModel();
			let changes = countChanges(model);

			model.select("a");
			model.select("b");
			model.deselect("a");

			expect(changes.count).toBe(3);
		});

		test("does not fire when re-selecting an already-selected key", () => {
			let model = new SelectionModel({ selectedKeys: ["a"] });
			let changes = countChanges(model);

			model.select("a");

			expect(changes.count).toBe(0);
		});

		test("stops firing after the listener's abort signal fires", () => {
			let model = new SelectionModel();
			let controller = new AbortController();
			let count = 0;

			model.addEventListener("change", () => (count += 1), { signal: controller.signal });

			model.select("a");
			controller.abort();
			model.select("b");

			expect(count).toBe(1);
		});
	});

	describe("selectedKeys reference stability", () => {
		test("returns the same set reference across no-op calls", () => {
			let model = new SelectionModel({ selectedKeys: ["a"] });
			let before = model.selectedKeys;

			model.select("a");

			expect(model.selectedKeys).toBe(before);
		});

		test("returns a new set reference after a real mutation", () => {
			let model = new SelectionModel({ selectedKeys: ["a"] });
			let before = model.selectedKeys;

			model.select("b");

			expect(model.selectedKeys).not.toBe(before);
		});
	});
});
