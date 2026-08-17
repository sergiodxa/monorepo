/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { touchAction } from "./touch-action";

describe("touchAction", () => {
	test("no-arg defaults to 'none'", async () => {
		expect(await declarations(touchAction())).toEqual(["touch-action: none"]);
	});

	test("an explicit value", async () => {
		expect(await declarations(touchAction("manipulation"))).toEqual(["touch-action: manipulation"]);
	});

	test("an arbitrary combination of pan values", async () => {
		expect(await declarations(touchAction("pan-x pan-y"))).toEqual(["touch-action: pan-x pan-y"]);
	});
});
