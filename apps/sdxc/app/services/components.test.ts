/**
 * Covers the generated `@sdxc/ui` document the site serves. The extraction that built
 * it is tested where it lives; this is the other half — that every page a URL can ask
 * for is in the document, shaped the way the page reads it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { listComponents, readComponent } from "~/app/services/components";

describe("listComponents", () => {
	test("names every component in the catalogue, alphabetically", async () => {
		let components = await listComponents();
		let names = components.map((entry) => entry.name);
		let sorted = names.slice().sort((a, b) => a.localeCompare(b));

		expect(components).toHaveLength(102);
		expect(names).toEqual(sorted);
	});

	test("reads the exported name rather than spelling the file name back", async () => {
		let components = await listComponents();

		expect(components.find((entry) => entry.slug === "listbox")?.name).toBe("ListBox");
	});
});

describe("readComponent", () => {
	test("opens with what the pattern is, which the module's own comment states", async () => {
		let badge = await readComponent("badge");

		expect(badge?.name).toBe("Badge");
		expect(badge?.summary).toMatch(/^A compact pill/);
		expect(badge?.description).toMatch(/^Renders a single-line pill host/);
		expect(badge?.examples).toHaveLength(3);
	});

	test("lists a prop's allowed values rather than the name of its union", async () => {
		let badge = await readComponent("badge");
		let rows = badge?.props.rows ?? [];

		expect(rows.find((row) => row.name === "variant")?.values).toEqual([
			'"default"',
			'"secondary"',
			'"outline"',
		]);
		expect(rows.find((row) => row.name === "color")?.values).toEqual([
			'"brand"',
			'"neutral"',
			'"success"',
			'"warning"',
			'"danger"',
		]);
	});

	test("reads the compound parts the component publishes", async () => {
		let badge = await readComponent("badge");

		expect(badge?.parts.map((part) => part.name)).toEqual(["Badge.Icon", "Badge.Text"]);
	});

	test("reports what a props interface inherits, since some declare nothing of their own", async () => {
		let dialog = await readComponent("alert-dialog");

		expect(dialog?.props.rows).toEqual([]);
		expect(dialog?.props.inherits).toEqual([
			'Omit<Dialog.Props, "role" | "closedby" | "closedBy">',
		]);
	});

	test("holds a reference for every component the tree links to", async () => {
		let entries = await listComponents();
		let read = await Promise.all(entries.map((entry) => readComponent(entry.slug)));

		expect(read.filter((reference) => reference === null)).toEqual([]);
		expect(read.filter((reference) => reference?.summary === "")).toEqual([]);
	});

	test("reports nothing for a slug the catalogue does not publish", async () => {
		expect(await readComponent("nothing-here")).toBeNull();
	});
});
