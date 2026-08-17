/**
 * Unit tests for `flexColReverse()`'s fixed `flex-direction: column-reverse`
 * declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { flexColReverse } from "./flex-col-reverse";

describe("flexColReverse", () => {
	test("sets display: flex and flex-direction: column-reverse", async () => {
		expect(await declarations(flexColReverse())).toEqual([
			"display: flex",
			"flex-direction: column-reverse",
		]);
	});
});
