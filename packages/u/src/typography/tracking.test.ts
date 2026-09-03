/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { tracking } from "./tracking.js";

describe("tracking", () => {
	test("every named scale value resolves through the tracking variable with its fallback", async () => {
		expect(await declarations(tracking("tighter"))).toEqual([
			"letter-spacing: var(--ui-tracking-tighter, -0.05em)",
		]);
		expect(await declarations(tracking("tight"))).toEqual([
			"letter-spacing: var(--ui-tracking-tight, -0.025em)",
		]);
		expect(await declarations(tracking("normal"))).toEqual([
			"letter-spacing: var(--ui-tracking-normal, 0em)",
		]);
		expect(await declarations(tracking("wide"))).toEqual([
			"letter-spacing: var(--ui-tracking-wide, 0.025em)",
		]);
		expect(await declarations(tracking("wider"))).toEqual([
			"letter-spacing: var(--ui-tracking-wider, 0.05em)",
		]);
		expect(await declarations(tracking("widest"))).toEqual([
			"letter-spacing: var(--ui-tracking-widest, 0.1em)",
		]);
	});

	test("no-arg defaults to normal", async () => {
		expect(await declarations(tracking())).toEqual([
			"letter-spacing: var(--ui-tracking-normal, 0em)",
		]);
	});

	test("a raw letter-spacing string passes through unchanged", async () => {
		expect(await declarations(tracking("0.18em"))).toEqual(["letter-spacing: 0.18em"]);
		expect(await declarations(tracking("-0.04em"))).toEqual(["letter-spacing: -0.04em"]);
	});
});
