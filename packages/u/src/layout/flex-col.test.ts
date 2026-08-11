/**
 * Unit tests for `flexCol()`'s fixed `flex-direction: column` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { flexCol } from "./flex-col";

describe("flexCol", () => {
	test("sets flex-direction: column", async () => {
		expect(await declarations(flexCol())).toEqual(["flex-direction: column"]);
	});
});
