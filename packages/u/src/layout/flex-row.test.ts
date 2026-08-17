/**
 * Unit tests for `flexRow()`'s fixed `flex-direction: row` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { flexRow } from "./flex-row";

describe("flexRow", () => {
	test("sets flex-direction: row", async () => {
		expect(await declarations(flexRow())).toEqual(["flex-direction: row"]);
	});
});
