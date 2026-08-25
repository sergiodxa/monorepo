/**
 * Unit tests for {@link FilterModel}: construct instances, call methods, and
 * assert on state and dispatched `"change"` events, driving the model
 * directly in plain script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { FilterModel } from "./filter-model";

const APPLE: FilterModel.Option = { id: "apple", value: "Apple" };
const BANANA: FilterModel.Option = { id: "banana", value: "Banana" };
const CHERRY: FilterModel.Option = { id: "cherry", value: "Cherry", keywords: ["fruit", "red"] };

const OPTIONS: FilterModel.Option[] = [APPLE, BANANA, CHERRY];

function countChanges(model: FilterModel): { count(): number } {
	let calls = 0;

	model.addEventListener("change", () => {
		calls++;
	});

	return { count: () => calls };
}

describe(FilterModel.name, () => {
	test("starts with no options, no query, and no active match", () => {
		let model = new FilterModel();

		expect(model.query).toBe("");
		expect(model.options).toEqual([]);
		expect(model.matches).toEqual([]);
		expect(model.activeId).toBeNull();
		expect(model.activeOption).toBeNull();
		expect(model.isEmpty).toBe(true);
	});

	test("seeds options, query, and active match from init", () => {
		let model = new FilterModel({ options: OPTIONS, query: "an" });

		expect(model.query).toBe("an");
		expect(model.options).toEqual(OPTIONS);
		expect(model.matches).toEqual([BANANA]);
		expect(model.activeId).toBe("banana");
		expect(model.activeOption).toEqual(BANANA);
		expect(model.isEmpty).toBe(false);
	});

	test("matches every option for an empty query", () => {
		let model = new FilterModel({ options: OPTIONS });

		expect(model.matches).toEqual(OPTIONS);
		expect(model.activeId).toBe("apple");
	});

	test("setQuery filters case-insensitively against value", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setQuery("BAN");

		expect(model.matches).toEqual([BANANA]);
		expect(model.isMatch("banana")).toBe(true);
		expect(model.isMatch("apple")).toBe(false);
	});

	test("setQuery matches against keywords as well as value", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setQuery("red");

		expect(model.matches).toEqual([CHERRY]);
	});

	test("setQuery dispatches change and updates activeId", () => {
		let model = new FilterModel({ options: OPTIONS });
		let changes = countChanges(model);

		model.setQuery("cherry");

		expect(changes.count()).toBe(1);
		expect(model.activeId).toBe("cherry");
	});

	test("setQuery is a no-op when the query is unchanged", () => {
		let model = new FilterModel({ options: OPTIONS, query: "app" });
		let changes = countChanges(model);

		model.setQuery("app");

		expect(changes.count()).toBe(0);
	});

	test("setQuery keeps the active option when it still matches", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setActive("cherry");
		model.setQuery("e");

		expect(model.matches.map((option) => option.id)).toEqual(["apple", "cherry"]);
		expect(model.activeId).toBe("cherry");
	});

	test("setQuery falls back to the first match when the active option drops out", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setActive("cherry");
		model.setQuery("a");

		expect(model.matches.map((option) => option.id)).toEqual(["apple", "banana"]);
		expect(model.activeId).toBe("apple");
	});

	test("setQuery clears activeId when nothing matches", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setQuery("zzz");

		expect(model.matches).toEqual([]);
		expect(model.activeId).toBeNull();
		expect(model.isEmpty).toBe(true);
	});

	test("setOptions replaces the option set and recomputes matches", () => {
		let model = new FilterModel({ options: OPTIONS, query: "an" });
		let nextOptions = [
			{ id: "mango", value: "Mango" },
			{ id: "banana", value: "Banana" },
		];

		model.setOptions(nextOptions);

		expect(model.options).toEqual(nextOptions);
		expect(model.matches).toEqual(nextOptions);
	});

	test("setOptions always dispatches change", () => {
		let model = new FilterModel({ options: OPTIONS });
		let changes = countChanges(model);

		model.setOptions(OPTIONS);

		expect(changes.count()).toBe(1);
	});

	test("setActive activates a matched id and dispatches change", () => {
		let model = new FilterModel({ options: OPTIONS });
		let changes = countChanges(model);

		model.setActive("cherry");

		expect(model.activeId).toBe("cherry");
		expect(model.activeOption).toEqual(CHERRY);
		expect(changes.count()).toBe(1);
	});

	test("setActive ignores an id outside the matched set", () => {
		let model = new FilterModel({ options: OPTIONS, query: "an" });
		let changes = countChanges(model);

		model.setActive("cherry");

		expect(model.activeId).toBe("banana");
		expect(changes.count()).toBe(0);
	});

	test("setActive(null) clears activation", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setActive(null);

		expect(model.activeId).toBeNull();
	});

	test("setActive is a no-op when the id is already active", () => {
		let model = new FilterModel({ options: OPTIONS });
		let changes = countChanges(model);

		model.setActive("apple");

		expect(changes.count()).toBe(0);
	});

	test("moveNext advances through matches in order", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.moveNext();

		expect(model.activeId).toBe("banana");
	});

	test("moveNext wraps from the last match to the first", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setActive("cherry");
		model.moveNext();

		expect(model.activeId).toBe("apple");
	});

	test("movePrevious steps back through matches in order", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setActive("cherry");
		model.movePrevious();

		expect(model.activeId).toBe("banana");
	});

	test("movePrevious wraps from the first match to the last", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.movePrevious();

		expect(model.activeId).toBe("cherry");
	});

	test("moveNext activates the first match when nothing is active", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setActive(null);
		model.moveNext();

		expect(model.activeId).toBe("apple");
	});

	test("moveFirst and moveLast jump to the boundaries of the matched set", () => {
		let model = new FilterModel({ options: OPTIONS });

		model.setActive("banana");
		model.moveLast();
		expect(model.activeId).toBe("cherry");

		model.moveFirst();
		expect(model.activeId).toBe("apple");
	});

	test("movement is inert and dispatches nothing when there are no matches", () => {
		let model = new FilterModel({ options: OPTIONS, query: "zzz" });
		let changes = countChanges(model);

		model.moveNext();
		model.movePrevious();
		model.moveFirst();
		model.moveLast();

		expect(model.activeId).toBeNull();
		expect(changes.count()).toBe(0);
	});

	test("a custom match function overrides the default substring matcher", () => {
		let model = new FilterModel({
			options: OPTIONS,
			query: "5",
			match: (option, query) => option.value.length === Number(query),
		});

		expect(model.matches).toEqual([APPLE]);
	});
});
