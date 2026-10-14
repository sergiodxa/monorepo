/**
 * Covers the pair encoding one cookie carries every option group in, and the reading
 * of it. The value is the reader's to edit, so the assertions below are what keep a
 * hand-written cookie rendering the default instead of an option the site never
 * offered — or throwing on the way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	parseOptionSelections,
	selectedOption,
	selectOption,
	serializeOptionSelections,
} from "~/app/services/option-groups";

describe("parseOptionSelections", () => {
	test("reads a group's option", () => {
		expect(parseOptionSelections("package-manager:bun").get("package-manager")).toBe("bun");
	});

	test("reads nothing from an absent cookie", () => {
		expect(parseOptionSelections(null).size).toBe(0);
		expect(parseOptionSelections("").size).toBe(0);
	});

	test("drops a group this site does not offer", () => {
		expect(parseOptionSelections("editor:vim").size).toBe(0);
	});

	test("drops an option the group does not offer", () => {
		expect(parseOptionSelections("package-manager:deno").size).toBe(0);
	});

	test("reads the pairs it recognises out of a value carrying junk", () => {
		let selections = parseOptionSelections("nonsense|package-manager:yarn|editor:vim|:|");

		expect(selections.size).toBe(1);
		expect(selections.get("package-manager")).toBe("yarn");
	});
});

describe("serializeOptionSelections", () => {
	test("writes a pair per group", () => {
		let selections = selectOption(parseOptionSelections(null), "package-manager", "pnpm");

		expect(serializeOptionSelections(selections)).toBe("package-manager:pnpm");
	});

	test("round-trips through a parse", () => {
		let selections = selectOption(parseOptionSelections(null), "package-manager", "bun");
		let value = serializeOptionSelections(selections);

		expect(parseOptionSelections(value).get("package-manager")).toBe("bun");
	});

	test("writes nothing for a reader who has chosen nothing", () => {
		expect(serializeOptionSelections(parseOptionSelections(null))).toBe("");
	});
});

describe("selectOption", () => {
	test("replaces the group's earlier option", () => {
		let chosen = selectOption(
			parseOptionSelections("package-manager:yarn"),
			"package-manager",
			"bun",
		);

		expect(serializeOptionSelections(chosen)).toBe("package-manager:bun");
	});

	test("keeps the selections as they were for an option the group does not offer", () => {
		let selections = parseOptionSelections("package-manager:yarn");

		expect(selectOption(selections, "package-manager", "deno")).toBe(selections);
	});
});

describe("selectedOption", () => {
	test("answers with the reader's option", () => {
		expect(selectedOption(parseOptionSelections("package-manager:bun"), "package-manager")).toBe(
			"bun",
		);
	});

	test("answers with the group's first option where the reader has chosen nothing", () => {
		expect(selectedOption(parseOptionSelections(null), "package-manager")).toBe("npm");
		expect(selectedOption(undefined, "package-manager")).toBe("npm");
	});
});
