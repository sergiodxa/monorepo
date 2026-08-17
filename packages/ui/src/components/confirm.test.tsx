/**
 * Tests for {@link Confirm}'s two modes: the default, where confirming only
 * closes the panel through an Invoker Command, and the submit mode `form`
 * switches on, where the panel's content is wrapped in a real `<form>` and
 * the confirming control becomes its submit button — the shape a
 * server-rendered destructive action needs, which the close-only control
 * could never perform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { Confirm } from "./confirm";

describe(Confirm.name, () => {
	test("closes the panel with a command, and renders no form, by default", async () => {
		let html = await renderToString(
			<Confirm
				id="confirm-delete"
				title="Delete project?"
				confirmLabel="Delete"
				cancelLabel="Cancel"
			/>,
		);

		expect(html).not.toContain("<form");
		expect(html).toContain('command="close"');
		expect(html).toContain('commandfor="confirm-delete"');
	});

	test("wraps its content in a real form and submits it once form is set", async () => {
		let html = await renderToString(
			<Confirm
				id="revoke-session"
				title="Revoke this session?"
				confirmLabel="Revoke"
				cancelLabel="Cancel"
				form={{ action: "/account/sessions/abc/revoke" }}
			/>,
		);

		expect(html).toContain("<form");
		expect(html).toContain('action="/account/sessions/abc/revoke"');
		expect(html).toContain('method="post"');
		expect(html).toContain('type="submit"');
	});

	test("renders the panel's content inside the form, not beside it", async () => {
		let html = await renderToString(
			<Confirm
				id="revoke-session"
				title="Revoke this session?"
				confirmLabel="Revoke"
				cancelLabel="Cancel"
				form={{ action: "/revoke" }}
			/>,
		);

		expect(html.indexOf("<form")).toBeLessThan(html.indexOf("Revoke this session?"));
		expect(html.indexOf("Revoke this session?")).toBeLessThan(html.indexOf("</form>"));
		expect(html.indexOf('type="submit"')).toBeLessThan(html.indexOf("</form>"));
	});

	test("submits the hidden fields it was given, ahead of the panel's own content", async () => {
		let html = await renderToString(
			<Confirm
				id="delete-client"
				title="Delete client?"
				confirmLabel="Delete"
				cancelLabel="Cancel"
				form={{
					action: "/admin/clients/abc",
					fields: <input type="hidden" name="csrf" value="t0ken" />,
				}}
			/>,
		);

		expect(html).toContain('name="csrf"');
		expect(html).toContain('value="t0ken"');
		expect(html.indexOf('name="csrf"')).toBeLessThan(html.indexOf("Delete client?"));
	});

	test("submits with the method it was given instead of the default", async () => {
		let html = await renderToString(
			<Confirm
				id="search-again"
				title="Run the search again?"
				confirmLabel="Search"
				cancelLabel="Cancel"
				form={{ action: "/search", method: "get" }}
			/>,
		);

		expect(html).toContain('method="get"');
		expect(html).not.toContain('method="post"');
	});

	test("keeps cancel a close-command button in submit mode, so cancelling never submits", async () => {
		let html = await renderToString(
			<Confirm
				id="revoke-session"
				title="Revoke this session?"
				confirmLabel="Revoke"
				cancelLabel="Cancel"
				form={{ action: "/revoke" }}
			/>,
		);

		expect(html).toContain('type="button"');
		expect(html).toContain('command="close"');
		expect(html).toContain('commandfor="revoke-session"');
	});
});
