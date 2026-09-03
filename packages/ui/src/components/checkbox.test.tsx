/**
 * Tests for {@link Checkbox}'s glyph box: it is a fixed-size flex item sitting next to
 * label content of arbitrary length, and a flex item gives up its declared size unless it
 * is told not to — which squashed the box into a sliver beside a long, wrapping label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { Checkbox } from "./checkbox.js";

describe(Checkbox.name, () => {
	test("refuses to be compressed by a long label sharing its row", async () => {
		let html = await renderToString(
			<Checkbox name="record_ids" value="1">
				{"v=DKIM1; k=rsa; p=".concat("A".repeat(400))}
			</Checkbox>,
		);

		expect(html).toContain("flex-shrink: 0;");
	});
});
