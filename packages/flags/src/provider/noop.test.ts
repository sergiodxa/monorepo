/**
 * That the provider standing in for one nobody set answers with the default and
 * says so.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { conformance } from "../testing/conformance.js";

import { NoopProvider } from "./noop.js";

describe("the no-op provider", () => {
	test("names itself as the specification does", () => {
		expect(new NoopProvider().metadata.name).toBe("No-op Provider");
	});

	test("resolves every type to its default with reason DEFAULT", () => {
		let provider = new NoopProvider();

		expect(provider.resolveBoolean("flag", true)).toEqual({ value: true, reason: "DEFAULT" });
		expect(provider.resolveString("flag", "fallback")).toEqual({
			value: "fallback",
			reason: "DEFAULT",
		});
		expect(provider.resolveNumber("flag", 50)).toEqual({ value: 50, reason: "DEFAULT" });
		expect(provider.resolveObject("flag", { title: "Checkout" })).toEqual({
			value: { title: "Checkout" },
			reason: "DEFAULT",
		});
	});

	test("carries no error fields, since nothing went wrong", () => {
		let details = new NoopProvider().resolveBoolean("flag", false);

		expect(details.errorCode).toBeUndefined();
		expect(details.errorMessage).toBeUndefined();
	});
});

conformance("no-op", () => new NoopProvider(), {});
