/**
 * Guards the rule that lets a loaded picture show through its fallback, and the inset
 * hairline that edges the picture. Every utility lands in a cascade layer of its own,
 * in first-use order, so a rule sharing a property on the fallback can lose.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Avatar } from "./avatar.js";

describe("an image placeholder's fallback", () => {
	/**
	 * The fallback is centered with `display: flex`; hiding it with `display: none` left
	 * the outcome to layer order, and a page that first used the centering utility after
	 * this rule drew the initials over every loaded picture.
	 */
	test("stands down behind an unbroken image through a property nothing else sets", async () => {
		let html = await renderToString(
			<Avatar>
				<Avatar.Image src="https://example.test/ada.png" alt="" />
				<Avatar.Fallback>AD</Avatar.Fallback>
			</Avatar>,
		);
		let rule = html.slice(html.indexOf(':is(img[data-slot="image"]:not([data-image-error])) ~ &'));

		expect(rule.slice(0, rule.indexOf("}"))).toContain("visibility: hidden");
		expect(rule.slice(0, rule.indexOf("}"))).not.toContain("display: none");
	});
});

describe("an image placeholder's image", () => {
	test("draws an inset hairline from the theme's image outline token", async () => {
		let html = await renderToString(
			<Avatar>
				<Avatar.Image src="https://example.test/ada.png" alt="" />
			</Avatar>,
		);

		expect(html).toContain("outline-color: var(--ui-image-outline, rgb(0 0 0 / 0.1))");
		expect(html).toContain("outline-offset: -1px");
	});
});
