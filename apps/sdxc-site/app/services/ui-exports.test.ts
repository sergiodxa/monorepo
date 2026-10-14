/**
 * Covers the generated `@sdxc/ui` subpath document the site serves: that every subpath
 * the package publishes has pages, in the order the sidebar lists them, and that a page
 * carries what its module declares rather than a sibling's types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { listUiExports, readUiExport } from "~/app/services/ui-exports";
import { UI_SUBPATHS } from "~/app/services/ui-subpaths";

describe("listUiExports", () => {
	test("lists every subpath's pages, alphabetically", async () => {
		for (let subpath of UI_SUBPATHS) {
			let names = (await listUiExports(subpath)).map((entry) => entry.name);

			expect(names.length).toBeGreaterThan(0);
			expect(names).toEqual(names.slice().sort((a, b) => a.localeCompare(b)));
		}
	});

	test("documents every mixin and behavior class the package publishes", async () => {
		let mixins = (await listUiExports("mixins")).map((entry) => entry.name);
		let behaviors = (await listUiExports("behaviors")).map((entry) => entry.name);

		expect(mixins).toContain("hotkey");
		expect(mixins).toContain("copyToClipboard");
		expect(behaviors).toEqual([
			"Announcer",
			"CalendarModel",
			"DragSession",
			"FilterModel",
			"ResizeSession",
			"ScrollFollowModel",
			"SelectionModel",
			"Toaster",
		]);
	});
});

describe("readUiExport", () => {
	test("reads a mixin's call and the event it dispatches", async () => {
		let page = await readUiExport("mixins", "copy-to-clipboard");

		expect(page?.symbol.signature).toBe("copyToClipboard(): MixinDescriptor<HTMLButtonElement>");
		expect(page?.companions.map((companion) => companion.name)).toContain("CopyEvent");
	});

	test("keeps each animation's options on its own page", async () => {
		let fade = await readUiExport("animations", "fade");

		expect(fade?.companions.map((companion) => companion.name)).toEqual(["Fade.Options"]);
	});

	test("reads a behavior class's methods", async () => {
		let toaster = await readUiExport("behaviors", "toaster");

		expect(toaster?.symbol.methods.map((method) => method.name)).toContain("add");
	});

	test("answers null for a slug the subpath publishes no page for", async () => {
		expect(await readUiExport("mixins", "not-a-mixin")).toBeNull();
	});
});
