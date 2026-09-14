/**
 * The two answer helpers, checked on the fields the specification cares about:
 * what normal execution carries, and what abnormal execution carries instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import { failed, resolved } from "./details.js";

test("Requirement 2.2.3 — resolved() puts the resolved value in the value field", () => {
	expect(resolved(true)).toEqual({ value: true });
	expect(resolved("blue", { variant: "blue", reason: "TARGETING_MATCH" })).toEqual({
		value: "blue",
		variant: "blue",
		reason: "TARGETING_MATCH",
	});
});

test("Requirement 2.2.6 — resolved() leaves the error code unset", () => {
	expect(resolved(42, { reason: "STATIC" })).not.toHaveProperty("errorCode");
});

test("Requirement 2.3.2 — resolved() leaves the error message unset", () => {
	expect(resolved(42, { reason: "STATIC" })).not.toHaveProperty("errorMessage");
});

test("resolved() carries the variant and the flag metadata a provider attaches", () => {
	expect(resolved({ title: "Checkout" }, { variant: "v2", flagMetadata: { version: 3 } })).toEqual({
		value: { title: "Checkout" },
		variant: "v2",
		flagMetadata: { version: 3 },
	});
});

test("Requirement 2.2.7 — failed() reports the error on the details it returns", () => {
	expect(failed(false, "FLAG_NOT_FOUND", "No flag named new-checkout")).toEqual({
		value: false,
		reason: "ERROR",
		errorCode: "FLAG_NOT_FOUND",
		errorMessage: "No flag named new-checkout",
	});
});

test("failed() answers with the default value it was handed", () => {
	expect(failed({ title: "Checkout" }, "TYPE_MISMATCH").value).toEqual({ title: "Checkout" });
});

test("failed() omits the error message when none was given", () => {
	let details = failed(0, "TYPE_MISMATCH");

	expect(details).not.toHaveProperty("errorMessage");
	expect(details.reason).toBe("ERROR");
	expect(details.errorCode).toBe("TYPE_MISMATCH");
});
