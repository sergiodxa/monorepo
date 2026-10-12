/**
 * Tests for {@link Button}: the `type` an Invoker Command needs (and where it is written),
 * the per-size icon-only measure, the glyph-edge markers that trim padding beside a
 * leading or trailing glyph, and the pointer target box drawn however it is positioned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Button } from "./button.js";

describe(Button.name, () => {
	test('types itself "button" when it carries a command, so its command survives inside a form', async () => {
		let html = await renderToString(
			<Button commandfor="confirm-delete" command="show-modal">
				Delete
			</Button>,
		);

		expect(html).toContain('type="button"');
	});

	test('types itself "button" when it carries only a commandfor', async () => {
		let html = await renderToString(<Button commandfor="confirm-delete">Delete</Button>);

		expect(html).toContain('type="button"');
	});

	test("renders no type of its own for a button carrying no command", async () => {
		let html = await renderToString(<Button>Save</Button>);

		expect(html).not.toContain("type=");
	});

	test("leaves an explicitly typed submit button alone", async () => {
		let html = await renderToString(<Button type="submit">Save</Button>);

		expect(html).toContain('type="submit"');
	});

	test("writes type before the command attributes, which is where the platform reads it", async () => {
		let html = await renderToString(
			<Button commandfor="confirm-delete" command="show-modal">
				Delete
			</Button>,
		);

		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});

	test("writes an explicit type before the command attributes too", async () => {
		let html = await renderToString(
			<Button type="button" commandfor="confirm-delete" command="close">
				Cancel
			</Button>,
		);

		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
	});

	test("respects an explicit type even on a command invoker", async () => {
		let html = await renderToString(
			<Button type="reset" commandfor="confirm-delete" command="close">
				Reset
			</Button>,
		);

		expect(html).toContain('type="reset"');
		expect(html).not.toContain('type="button"');
	});

	test("sizes an icon-only button from a per-size custom property", async () => {
		let html = await renderToString(
			<Button size="sm" aria-label="Close">
				<svg />
			</Button>,
		);

		expect(html).toContain("data-icon-only");
		expect(html).toContain("inline-size: var(--ui-button-icon-size-sm, 2rem);");
		expect(html).toContain("inline-size: var(--ui-button-icon-size-md, 2.5rem);");
		expect(html).toContain("inline-size: var(--ui-button-icon-size-lg, 3rem);");
	});

	test("marks a leading glyph beside a label so its side's padding drops a step", async () => {
		let html = await renderToString(
			<Button>
				<svg />
				Save
			</Button>,
		);

		expect(html).toMatch(/<button[^>]*data-glyph-start/);
		expect(html).not.toMatch(/<button[^>]*data-glyph-end/);
	});

	test("marks a trailing glyph after a label, even though :first-child would also match it", async () => {
		let html = await renderToString(
			<Button>
				Next
				<svg />
			</Button>,
		);

		expect(html).toMatch(/<button[^>]*data-glyph-end/);
		expect(html).not.toMatch(/<button[^>]*data-glyph-start/);
	});

	test("marks neither edge on an icon-only or text-only button", async () => {
		let iconOnly = await renderToString(
			<Button aria-label="Close">
				<svg />
			</Button>,
		);
		let textOnly = await renderToString(<Button>Save</Button>);

		expect(iconOnly).not.toMatch(/<button[^>]*data-glyph-/);
		expect(textOnly).not.toMatch(/<button[^>]*data-glyph-/);
	});

	test("draws an unanchored target box, so it reaches --ui-target-size however it is positioned", async () => {
		let html = await renderToString(
			<Button size="sm" aria-label="Close">
				<svg />
			</Button>,
		);

		expect(html).toMatch(
			/&::after \{[^}]*position: absolute;[^}]*inline-size: var\(--ui-target-size, 1\.5rem\);[^}]*block-size: var\(--ui-target-size, 1\.5rem\);/,
		);
		expect(html).not.toMatch(/&::after \{[^}]*inset/);
	});
});
