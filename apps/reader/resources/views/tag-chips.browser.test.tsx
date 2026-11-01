/**
 * Holds a kept post's label strip to its quiet contract: the field for a new label waits
 * behind its disclosure, so a list of kept posts is not a column of empty fields, and opens
 * in place when the reader asks for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import TagChips from "~/resources/views/tag-chips";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts the strip of one post carrying the "To try" label. */
function mountStrip() {
	mounted = render(
		<TagChips
			chips={[
				{ id: "tag-1", name: "To try", href: "/tags/tag-1", removeAction: "/items/a/tags/tag-1" },
			]}
			applyAction="/items/a/tags"
			returnTo="/saved"
			optionsId="label-options"
			copy={{
				legend: "Labels on this post",
				add: "Add a label",
				placeholder: "Label…",
				remove: "Remove",
			}}
		/>,
	);
	return mounted.container;
}

describe("TagChips", () => {
	test("keeps the new-label field closed until the reader opens it", async () => {
		let strip = mountStrip();
		let field = strip.querySelector<HTMLInputElement>('input[name="name"]');
		let toggle = strip.querySelector<HTMLElement>("summary");
		if (!field || !toggle) throw new Error("The strip drew no field or toggle");

		expect(field.checkVisibility()).toBe(false);

		toggle.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(field.checkVisibility()).toBe(true);
	});

	test("names each label's remove control with the label", () => {
		let strip = mountStrip();

		expect(strip.querySelector('[aria-label="Remove To try"]')).not.toBeNull();
		expect(strip.querySelector('[aria-label="Labels on this post"]')).not.toBeNull();
	});
});
