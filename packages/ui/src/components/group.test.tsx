/**
 * Tests for {@link Group}: a control flattens its end corners only when another
 * control follows it, so a trailing `<link rel="prefetch">` hint leaves the
 * cluster's last control rounded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Group } from "./group.js";

describe(Group.name, () => {
	test("flattens end corners only before a following control", async () => {
		let html = await renderToString(<Group />);

		expect(html).toContain("& > *:has(~ :not(link))");
		expect(html).not.toContain("& > *:not(:last-child)");
	});
});
