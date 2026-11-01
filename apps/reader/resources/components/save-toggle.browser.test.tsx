/**
 * Holds the save control to its two shapes: a bare mark in a list, named for a screen
 * reader and a pointer, and the mark with its name beside it where a page has the room.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import SaveToggle from "~/resources/components/save-toggle";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts the control for an unsaved post, with or without its name printed. */
function mountToggle(showLabel: boolean) {
	mounted = render(
		<SaveToggle
			action="/items/a/save"
			isSaved={false}
			returnTo="/reading"
			save="Save"
			unsave="Remove from saved"
			failed="Could not be saved"
			full="Your saved posts are full"
			showLabel={showLabel}
		/>,
	);
	let button = mounted.container.querySelector<HTMLButtonElement>('button[type="submit"]');
	if (!button) throw new Error("The control drew no button");
	return button;
}

describe("SaveToggle", () => {
	test("prints its name beside the mark where the page asks for it", () => {
		let button = mountToggle(true);

		expect(button.textContent).toContain("Save");
		expect(button.getAttribute("aria-label")).toBe("Save");
		expect(button.getBoundingClientRect().width).toBeGreaterThan(
			button.getBoundingClientRect().height,
		);
	});

	test("stays a bare mark in a list, named by its label alone", () => {
		let button = mountToggle(false);

		expect(button.textContent?.trim()).toBe("");
		expect(button.getAttribute("aria-label")).toBe("Save");
	});
});
