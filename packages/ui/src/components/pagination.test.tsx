/**
 * Tests for the `type` {@link Pagination.Button} resolves: a control carrying an
 * Invoker Command renders `type="button"` on its own, before the command
 * attributes, because inside a `<form>` an untyped button is a submit button and
 * the platform then refuses to run its command at all — judging that while it
 * parses `command`/`commandfor`, so a `type` written after them is refused the
 * same way. A control carrying no command is left untyped, so a previous/next
 * control a consumer wired to a real form still submits it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { renderToString } from "remix/ui/server";

import { Pagination } from "./pagination";

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

		// Presence is not enough: the ambiguity check runs while `command`/`commandfor`
		// are parsed, so a `type` serialized after them is not seen and the command is
		// refused. Both attributes have to come after it.
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});
});
