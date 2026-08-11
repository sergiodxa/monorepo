/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { viewTimelineName } from "./view-timeline-name";

describe("viewTimelineName", () => {
	test("prefixes the name with --", async () => {
		expect(await declarations(viewTimelineName("reveal"))).toEqual([
			"view-timeline-name: --reveal",
		]);
	});

	test("prefixes a multi-word name the same way", async () => {
		expect(await declarations(viewTimelineName("hero-image"))).toEqual([
			"view-timeline-name: --hero-image",
		]);
	});

	test("emits only viewTimelineName", async () => {
		expect(await declarations(viewTimelineName("reveal"))).toHaveLength(1);
	});
});
