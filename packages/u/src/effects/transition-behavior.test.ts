/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { transitionBehavior } from "./transition-behavior.js";

describe("transitionBehavior", () => {
	test("sets transition-behavior to 'normal'", async () => {
		expect(await declarations(transitionBehavior("normal"))).toEqual([
			"transition-behavior: normal",
		]);
	});

	test("sets transition-behavior to 'allow-discrete'", async () => {
		expect(await declarations(transitionBehavior("allow-discrete"))).toEqual([
			"transition-behavior: allow-discrete",
		]);
	});
});
