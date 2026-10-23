/**
 * Tests for the `type` {@link Pagination.Button} resolves: a control carrying an
 * Invoker Command renders `type="button"` on its own, before the command
 * attributes, because inside a `<form>` an untyped button is a submit button and
 * the platform then refuses to run its command at all — judging that while it
 * parses `command`/`commandfor`, so a `type` written after them is refused the
 * same way. Also covers the markup each {@link Pagination.Link} prefetch mode writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Pagination } from "./pagination.js";

describe("Pagination.Button", () => {
	test('types itself "button" when it carries a command, so its command survives inside a form', async () => {
		let html = await renderToString(
			<Pagination.Button aria-label="Next" commandfor="results" command="next">
				Next
			</Pagination.Button>,
		);

		expect(html).toContain('type="button"');
	});

	test('types itself "button" when it carries only a commandfor', async () => {
		let html = await renderToString(
			<Pagination.Button aria-label="Next" commandfor="results">
				Next
			</Pagination.Button>,
		);

		expect(html).toContain('type="button"');
	});

	test("renders no type of its own for a control carrying no command", async () => {
		let html = await renderToString(<Pagination.Button aria-label="Next">Next</Pagination.Button>);

		expect(html).not.toContain("type=");
	});

	test("leaves an explicitly typed submit control alone", async () => {
		let html = await renderToString(
			<Pagination.Button aria-label="Next" type="submit">
				Next
			</Pagination.Button>,
		);

		expect(html).toContain('type="submit"');
	});

	test("writes type before the command attributes, which is where the platform reads it", async () => {
		let html = await renderToString(
			<Pagination.Button aria-label="Next" commandfor="results" command="next">
				Next
			</Pagination.Button>,
		);

		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});
});

describe("Pagination.Link prefetch", () => {
	test("writes neither the attribute nor a hint by default", async () => {
		let html = await renderToString(<Pagination.Link href="/next">2</Pagination.Link>);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).not.toContain('rel="prefetch"');
	});

	test.each(["intent", "viewport"] as const)(
		'writes data-rmx-prefetch="%s" on the anchor and renders no hint',
		async (mode) => {
			let html = await renderToString(
				<Pagination.Link href="/next" prefetch={mode}>
					2
				</Pagination.Link>,
			);

			expect(html).toMatch(new RegExp(`<a[^>]*data-rmx-prefetch="${mode}"`));
			expect(html).not.toContain('rel="prefetch"');
		},
	);

	test('renders a prefetch hint after the anchor, without the attribute, for "render"', async () => {
		let html = await renderToString(
			<Pagination.Link href="/next" prefetch="render">
				2
			</Pagination.Link>,
		);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).toMatch(/<\/a><link rel="prefetch" href="\/next"\s*\/?>/);
	});

	test('renders no hint for "render" when the anchor has no destination', async () => {
		let html = await renderToString(
			<Pagination.Link href="" prefetch="render">
				2
			</Pagination.Link>,
		);

		expect(html).not.toContain('rel="prefetch"');
	});
});
