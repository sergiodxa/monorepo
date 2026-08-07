/**
 * Tests for the `type` {@link Button} resolves: a button carrying an Invoker
 * Command renders `type="button"` on its own, because inside a `<form>` an
 * untyped button is a submit button and the platform then refuses to run its
 * command at all — while a button carrying no command is left untyped, so a
 * plain submit button inside a form still submits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { renderToString } from "remix/ui/server";

import { Button } from "./button";

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

	test("respects an explicit type even on a command invoker", async () => {
		let html = await renderToString(
			<Button type="reset" commandfor="confirm-delete" command="close">
				Reset
			</Button>,
		);

		expect(html).toContain('type="reset"');
		expect(html).not.toContain('type="button"');
	});
});
