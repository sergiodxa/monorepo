/**
 * Tests for {@link Switch}: covers its bare-track rendering (unchanged from
 * before `children` existed), the native `<label>` wrapping it grows once
 * `children` is passed, and that a consumer-supplied `mix` still lands on
 * the track itself in both cases.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { css } from "remix/ui";
import { renderToString } from "remix/ui/server";

import { Switch } from "./switch";

describe(Switch.name, () => {
	test("renders a bare input with no wrapping label when children is omitted", async () => {
		let html = await renderToString(<Switch name="notifications" aria-label="Notifications" />);

		expect(html).not.toContain("<label");
		expect(html).toContain("<input");
		expect(html).toContain('type="checkbox"');
		expect(html).toContain('role="switch"');
	});

	test("wraps the track in a label alongside the visible text when children is set", async () => {
		let html = await renderToString(<Switch name="notifications">Notifications</Switch>);

		expect(html).toContain("<label");
		expect(html).toContain("<input");
		expect(html).toContain("Notifications");
		// The input renders inside the label, not before/outside it.
		expect(html.indexOf("<label")).toBeLessThan(html.indexOf("<input"));
	});

	test("keeps a consumer-supplied mix on the track when wrapped in a label", async () => {
		let html = await renderToString(
			<Switch name="notifications" mix={css({ color: "red" })}>
				Notifications
			</Switch>,
		);

		expect(html).toContain("color: red;");
	});

	test("disables the track and dims the label's cursor together", async () => {
		let html = await renderToString(
			<Switch name="notifications" disabled>
				Notifications
			</Switch>,
		);

		expect(html).toContain("disabled");
		expect(html).toContain("cursor: not-allowed;");
	});
});
