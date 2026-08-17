/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { timelineScope } from "./timeline-scope";

describe("timelineScope", () => {
	test("prefixes a single name with --", async () => {
		expect(await declarations(timelineScope("page-scroll"))).toEqual([
			"timeline-scope: --page-scroll",
		]);
	});

	test("prefixes every name and joins them with a comma", async () => {
		expect(await declarations(timelineScope("page-scroll", "hero-reveal"))).toEqual([
			"timeline-scope: --page-scroll, --hero-reveal",
		]);
	});

	test("emits the initial value when called with no names", async () => {
		// Regression: an empty value used to serialize to `timeline-scope: ;`,
		// an invalid declaration. `none` is the property's initial value, so it
		// says the same thing in CSS a browser accepts.
		expect(await declarations(timelineScope())).toEqual(["timeline-scope: none"]);
	});
});
