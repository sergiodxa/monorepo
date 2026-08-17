/**
 * Tests for {@link Switch}: covers its bare-track rendering (unchanged from
 * before `children` existed), the native `<label>` wrapping it grows once
 * `children` is passed, and that a consumer-supplied `mix` still lands on
 * the track itself in both cases.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/ui";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

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

	/**
	 * The checked state is the native control's, and only the native control's.
	 *
	 * An authored `aria-checked` takes precedence over the checkedness assistive
	 * technology would otherwise read off the input, and it can only hold the value
	 * this render produced — so it would start out valid and turn into a lie the
	 * first time somebody flipped the switch, which is the entire purpose of a
	 * switch. Rendering none keeps the announced state and the drawn state (`&:checked`)
	 * the same fact. Both directions are asserted because the failure that prompted
	 * this looked fine in one of them: a boolean `true` serialized as the bare
	 * attribute name and a boolean `false` vanished, so neither state was ever a
	 * token ARIA recognizes.
	 */
	describe("checked state", () => {
		test("carries no aria-checked of its own, whichever way it is rendered", async () => {
			let on = await renderToString(<Switch name="notifications" defaultChecked />);
			let off = await renderToString(<Switch name="notifications" />);
			let controlled = await renderToString(<Switch name="notifications" checked={false} />);

			expect(on).not.toContain("aria-checked");
			expect(off).not.toContain("aria-checked");
			expect(controlled).not.toContain("aria-checked");
		});

		test("keeps the role and the native checkedness that carries the state for it", async () => {
			let html = await renderToString(<Switch name="notifications" defaultChecked />);

			expect(html).toContain('role="switch"');
			expect(html).toContain("checked");
		});
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
