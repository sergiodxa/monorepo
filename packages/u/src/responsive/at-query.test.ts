/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { atQuery } from "./at-query.js";

describe("atQuery", () => {
	test("nests the wrapped utility's styles under the literal query, unwrapped", async () => {
		expect(await serialize(atQuery("(min-width: 40rem)", p(4)))).toMatch(
			/@container \(min-width: 40rem\) \{[\s\S]*padding: calc\(var\(--ui-spacing, 0\.25rem\) \* 4\)/,
		);
	});

	test("the wrapped utility's declaration survives the serializer unchanged", async () => {
		expect(await declarations(atQuery("(min-width: 40rem)", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("never wraps the literal length in var(--ui-container-*, ...)", async () => {
		expect(await serialize(atQuery("(min-width: 40rem)", p(4)))).not.toContain(
			"var(--ui-container-",
		);
	});

	test("passes a named-container segment through verbatim alongside the literal length", async () => {
		expect(await serialize(atQuery("sidebar (min-width: 40rem)", p(4)))).toContain(
			"@container sidebar (min-width: 40rem) {",
		);
	});
});
