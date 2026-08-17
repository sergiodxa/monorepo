/**
 * Tests for {@link AlertDialog}'s two footer controls: that both render an
 * explicit `type="button"` — and render it before their command attributes,
 * without which the platform refuses to run their Invoker Command inside a
 * `<form>` (a button there defaults to `"submit"`, a submit button can't
 * invoke, and the check runs while the command attributes are parsed) — and
 * that an action asked to submit instead drops the command it could no longer
 * run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { AlertDialog } from "./alert-dialog";

describe("AlertDialog.Cancel", () => {
	test('renders an explicit type="button" so its close command survives inside a form', async () => {
		let html = await renderToString(
			<AlertDialog.Cancel commandfor="delete-project">Cancel</AlertDialog.Cancel>,
		);

		expect(html).toContain('type="button"');
		expect(html).toContain('command="close"');
		expect(html).toContain('commandfor="delete-project"');
	});

	test("writes that type before the command attributes, where the platform reads it", async () => {
		let html = await renderToString(
			<AlertDialog.Cancel commandfor="delete-project">Cancel</AlertDialog.Cancel>,
		);

		// This control is the one the admin screens render inside a `<form>`, so it is
		// the one whose attribute order the platform actually judges.
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});

	test('keeps type="button" even when a consumer passes it explicitly', async () => {
		let html = await renderToString(
			<AlertDialog.Cancel commandfor="delete-project" type="button">
				Cancel
			</AlertDialog.Cancel>,
		);

		expect(html).toContain('type="button"');
		expect(html).not.toContain('type="submit"');
	});
});

describe("AlertDialog.Action", () => {
	test('renders an explicit type="button" alongside its close command', async () => {
		let html = await renderToString(
			<AlertDialog.Action commandfor="delete-project">Delete</AlertDialog.Action>,
		);

		expect(html).toContain('type="button"');
		expect(html).toContain('command="close"');
	});

	test("submits its enclosing form, and renders no command at all, when asked to", async () => {
		let html = await renderToString(
			<AlertDialog.Action type="submit" name="intent" value="delete">
				Delete
			</AlertDialog.Action>,
		);

		expect(html).toContain('type="submit"');
		expect(html).toContain('name="intent"');
		expect(html).not.toContain("command=");
		expect(html).not.toContain("commandfor=");
	});

	test("drops a command a submitting action was passed anyway, since the platform would refuse it", async () => {
		let html = await renderToString(
			<AlertDialog.Action type="submit" commandfor="delete-project" command="close">
				Delete
			</AlertDialog.Action>,
		);

		expect(html).toContain('type="submit"');
		expect(html).not.toContain("command=");
		expect(html).not.toContain("commandfor=");
	});
});
