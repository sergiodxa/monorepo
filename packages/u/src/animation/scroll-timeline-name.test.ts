/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { scrollTimelineName } from "./scroll-timeline-name";

describe("scrollTimelineName", () => {
	test("prefixes the name with --", async () => {
		expect(await declarations(scrollTimelineName("page-scroll"))).toEqual([
			"scroll-timeline-name: --page-scroll",
		]);
	});

	test("prefixes a single-word name the same way", async () => {
		expect(await declarations(scrollTimelineName("log"))).toEqual(["scroll-timeline-name: --log"]);
	});

	test("emits only scrollTimelineName", async () => {
		expect(await declarations(scrollTimelineName("page-scroll"))).toHaveLength(1);
	});
});
