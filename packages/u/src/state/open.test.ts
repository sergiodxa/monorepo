/**
 * Unit tests for `open.ts`.
 *
 * `<details>`/`<dialog>` expose openness as an attribute; popovers expose it
 * only as a pseudo-class, so both selectors must reach the stylesheet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { open } from "./open";

describe("open", () => {
	test("emits both the '[open]' attribute and the ':popover-open' selector", async () => {
		expect(await serialize(open(p(4)))).toContain("&[open], &:popover-open {");
		expect(await declarations(open(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
