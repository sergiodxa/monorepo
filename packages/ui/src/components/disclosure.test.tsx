/**
 * Tests for the tab stop {@link Disclosure.Trigger} withholds from a row marked
 * `aria-disabled`. A `<summary>` has no `disabled` of its own, so a row left in the tab
 * order still toggles on Enter and Space however muted it looks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { Disclosure } from "./disclosure.js";

describe("Disclosure.Trigger", () => {
	test("drops a disabled row out of the tab order, so Enter cannot reach it", async () => {
		let html = await renderToString(
			<Disclosure.Trigger aria-disabled="true">Legacy pricing</Disclosure.Trigger>,
		);

		expect(html).toContain('tabindex="-1"');
	});

	test("leaves an ordinary row focusable", async () => {
		let html = await renderToString(<Disclosure.Trigger>Refunds</Disclosure.Trigger>);

		expect(html).not.toContain("tabindex");
	});

	test("keeps a consumer's own tab stop on an ordinary row", async () => {
		let html = await renderToString(<Disclosure.Trigger tabIndex={0}>Refunds</Disclosure.Trigger>);

		expect(html).toContain('tabindex="0"');
	});
});
