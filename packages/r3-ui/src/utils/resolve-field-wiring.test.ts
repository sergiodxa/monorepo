/**
 * Unit tests for the field wiring computation in
 * {@link "./resolve-field-wiring"}: every assertion checks a known set of
 * options against the expected resolved wiring, with no DOM and no rendering
 * involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { resolveFieldWiring } from "./resolve-field-wiring";

describe(resolveFieldWiring.name, () => {
	test("falls back to the neutral color and a valid, undescribed state when every option is omitted", () => {
		expect(resolveFieldWiring("username", {})).toEqual({
			resolvedColor: "neutral",
			resolvedInvalid: false,
			descriptionId: undefined,
			errorId: undefined,
			describedBy: undefined,
		});
	});

	test("keeps an explicit color instead of falling back to neutral", () => {
		expect(resolveFieldWiring("username", { color: "brand" }).resolvedColor).toBe("brand");
	});

	test("marks the field invalid as soon as an error message is set", () => {
		let wiring = resolveFieldWiring("username", { errorMessage: "Required" });

		expect(wiring.resolvedInvalid).toBe(true);
		expect(wiring.errorId).toBe("username-error");
	});

	test("lets an explicit ariaInvalid override the state an error message alone would imply", () => {
		expect(
			resolveFieldWiring("username", { errorMessage: "Required", ariaInvalid: false })
				.resolvedInvalid,
		).toBe(false);
		expect(resolveFieldWiring("username", { ariaInvalid: true }).resolvedInvalid).toBe(true);
	});

	test("reserves a description id only once a description is set", () => {
		expect(resolveFieldWiring("username", { description: "3-20 characters" }).descriptionId).toBe(
			"username-description",
		);
		expect(resolveFieldWiring("username", {}).descriptionId).toBeUndefined();
	});

	test("joins both ids into describedBy once description and error are both set", () => {
		let wiring = resolveFieldWiring("username", {
			description: "3-20 characters",
			errorMessage: "Too short",
		});

		expect(wiring.describedBy).toBe("username-description username-error");
	});

	test("describedBy holds the single set id when only one of description/error is present", () => {
		expect(resolveFieldWiring("username", { description: "Hint" }).describedBy).toBe(
			"username-description",
		);
		expect(resolveFieldWiring("username", { errorMessage: "Bad" }).describedBy).toBe(
			"username-error",
		);
	});

	test("prefixes both ids with the given field id", () => {
		let wiring = resolveFieldWiring("start-date", { description: "Hint", errorMessage: "Bad" });

		expect(wiring.descriptionId).toBe("start-date-description");
		expect(wiring.errorId).toBe("start-date-error");
	});
});
