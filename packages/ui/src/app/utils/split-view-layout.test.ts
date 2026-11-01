/**
 * Round-trips the split view's layout cookie and reads it back from a `Cookie` header,
 * dropping any field a stale or tampered cookie gets wrong rather than the whole layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	parseSplitViewLayout,
	readSplitViewLayout,
	serializeSplitViewLayout,
} from "./split-view-layout.js";

describe("split view layout", () => {
	test("round-trips sizes and collapsed panes", () => {
		let value = serializeSplitViewLayout({ sidebar: 18.256, list: 30, collapsed: ["sidebar"] });

		expect(value).toBe("18.26:30:sidebar");
		expect(parseSplitViewLayout(value)).toEqual({
			sidebar: 18.26,
			list: 30,
			collapsed: ["sidebar"],
		});
	});

	test("reads its own cookie out of a header holding others", () => {
		let header = `theme=dark; ui-split-view=${encodeURIComponent("20:35:detail")}; other=1`;

		expect(readSplitViewLayout(header)).toEqual({ sidebar: 20, list: 35, collapsed: ["detail"] });
		expect(readSplitViewLayout(header, "inbox-layout")).toBeUndefined();
		expect(readSplitViewLayout(null)).toBeUndefined();
	});

	test("drops fields that do not parse", () => {
		expect(parseSplitViewLayout("abc:150:sidebar,bogus")).toEqual({
			sidebar: undefined,
			list: undefined,
			collapsed: ["sidebar"],
		});
	});
});
