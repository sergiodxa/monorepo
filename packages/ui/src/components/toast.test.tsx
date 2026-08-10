/**
 * Tests for the `type` {@link Toast}'s three controls write: an explicit
 * `type="button"`, positioned before the consumer's own attributes, without
 * which the platform refuses to run an Invoker Command the control carries
 * inside a `<form>` — it decides whether the pairing is ambiguous while it
 * parses `command`/`commandfor` and never sees a `type` serialized after them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { renderToString } from "remix/ui/server";

import { Toast } from "./toast";

describe("Toast.Action", () => {
	test('types itself "button", so its command survives inside a form', async () => {
		let html = await renderToString(<Toast.Action>Undo</Toast.Action>);

		expect(html).toContain('type="button"');
	});

	test("writes type before the command attributes, which is where the platform reads it", async () => {
		let html = await renderToString(
			<Toast.Action commandfor="upload-toast" command="hide">
				Undo
			</Toast.Action>,
		);

		// Presence is not enough: the ambiguity check runs while `command`/`commandfor`
		// are parsed, so a `type` serialized after them is not seen and the command is
		// refused. Both attributes have to come after it.
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});

	test("leaves an explicitly typed submit action alone", async () => {
		let html = await renderToString(<Toast.Action type="submit">Retry</Toast.Action>);

		expect(html).toContain('type="submit"');
	});
});

describe("Toast.Cancel", () => {
	test('types itself "button", so its command survives inside a form', async () => {
		let html = await renderToString(<Toast.Cancel>Dismiss</Toast.Cancel>);

		expect(html).toContain('type="button"');
	});

	test("writes type before the command attributes, which is where the platform reads it", async () => {
		let html = await renderToString(
			<Toast.Cancel commandfor="upload-toast" command="hide">
				Dismiss
			</Toast.Cancel>,
		);

		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});
});

describe("Toast.Close", () => {
	test('types itself "button", so its command survives inside a form', async () => {
		let html = await renderToString(<Toast.Close aria-label="Dismiss" />);

		expect(html).toContain('type="button"');
	});

	test("writes type before the command attributes, which is where the platform reads it", async () => {
		let html = await renderToString(
			<Toast.Close aria-label="Dismiss" commandfor="upload-toast" command="hide" />,
		);

		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});
});
