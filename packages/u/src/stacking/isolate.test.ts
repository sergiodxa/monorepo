/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { isolate } from "./isolate";

describe("isolate", () => {
	test("sets isolation: isolate", async () => {
		expect(await declarations(isolate())).toEqual(["isolation: isolate"]);
	});
});
