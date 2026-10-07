/**
 * Guards the rule that lets a loaded picture show through its fallback. Every utility a
 * page uses lands in a cascade layer of its own, declared in the order the page first
 * uses it, so a rule that shares a property with another one on the fallback can lose.
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
