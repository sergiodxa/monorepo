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

import type { TagChips as TagChipsView } from "~/resources/views/tag-chips";

import TagChips, { AddLabel } from "~/resources/views/tag-chips";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** The strip's copy, which the assertions name controls by. */
const COPY = {
	legend: "Labels on this post",
	add: "Add a label",
	placeholder: "Label…",
	remove: "Remove",
};

/** Mounts one post's labels and the control that adds one, as a row draws them. */
function mountRow(chips: TagChipsView.Chip[]) {
	mounted = render(
		<div>
			<TagChips chips={chips} returnTo="/saved" copy={COPY} />
			<AddLabel
				applyAction="/items/a/tags"
				returnTo="/saved"
				optionsId="label-options"
				copy={COPY}
			/>
		</div>,
	);
	return mounted.container;
}

/** The label a post carries in these tests. */
const TO_TRY: TagChipsView.Chip = {
	id: "tag-1",
	name: "To try",
	href: "/tags/tag-1",
	removeAction: "/items/a/tags/tag-1",
};

describe("TagChips", () => {
	test("draws nothing under a post that has no labels", () => {
		let row = mountRow([]);

		expect(row.querySelector('[aria-label="Labels on this post"]')).toBeNull();
		expect(row.querySelector("summary")).toBeNull();
	});

	test("keeps the new-label field closed until the reader opens it", async () => {
		let row = mountRow([TO_TRY]);
		let field = row.querySelector<HTMLInputElement>('input[name="name"]');
		let toggle = row.querySelector<HTMLButtonElement>('button[aria-label="Add a label"]');
		if (!field || !toggle) throw new Error("The row drew no field or toggle");

		expect(field.checkVisibility()).toBe(false);

		toggle.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(field.checkVisibility()).toBe(true);
	});

	test("names each label's remove control with the label", () => {
		let row = mountRow([TO_TRY]);

		expect(row.querySelector('[aria-label="Remove To try"]')).not.toBeNull();
		expect(row.querySelector('[aria-label="Labels on this post"]')).not.toBeNull();
	});
});
