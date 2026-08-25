/**
 * Tests for {@link Tabs}'s compound parts, focused on {@link Tabs.List}'s
 * sliding indicator: {@link tabIndicatorMix} covers the offset/length/opacity
 * math directly (pure `raw()` output, no DOM), and the `renderToString`
 * suites confirm it's wired into `Tabs.List` correctly, that omitting
 * `activeIndex`/`tabSize` leaves the pre-existing client-measured behavior
 * untouched, and that {@link Tabs.Tab} still renders as a real `<a>` with a
 * manually-set `aria-selected`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor } from "remix/ui";

import { css } from "remix/ui";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { Tabs, tabIndicatorMix } from "./tabs";

/** Unwraps a `raw()`/`css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe(tabIndicatorMix.name, () => {
	test("computes the inline-axis offset/length/opacity for a fixed pixel tab size", () => {
		expect(styles(tabIndicatorMix("horizontal", 2, "110px"))).toEqual({
			"--ui-tab-indicator-inline-start": "calc((110px + calc(var(--ui-spacing, 0.25rem) * 1)) * 2)",
			"--ui-tab-indicator-inline-size": "110px",
			"--ui-tab-indicator-opacity": "1",
		});
	});

	test("computes the block-axis custom properties instead when orientation is vertical", () => {
		expect(styles(tabIndicatorMix("vertical", 1, "80px"))).toEqual({
			"--ui-tab-indicator-block-start": "calc((80px + calc(var(--ui-spacing, 0.25rem) * 1)) * 1)",
			"--ui-tab-indicator-block-size": "80px",
			"--ui-tab-indicator-opacity": "1",
		});
	});

	test("resolves a spacing-scale number tabSize the same way every other sizing prop does", () => {
		expect(styles(tabIndicatorMix("horizontal", 1, 4))).toEqual({
			"--ui-tab-indicator-inline-start":
				"calc((calc(var(--ui-spacing, 0.25rem) * 4) + calc(var(--ui-spacing, 0.25rem) * 1)) * 1)",
			"--ui-tab-indicator-inline-size": "calc(var(--ui-spacing, 0.25rem) * 4)",
			"--ui-tab-indicator-opacity": "1",
		});
	});

	test("treats an explicit activeIndex of 0 as a real offset, not a no-op", () => {
		expect(styles(tabIndicatorMix("horizontal", 0, "110px"))).toEqual({
			"--ui-tab-indicator-inline-start": "calc((110px + calc(var(--ui-spacing, 0.25rem) * 1)) * 0)",
			"--ui-tab-indicator-inline-size": "110px",
			"--ui-tab-indicator-opacity": "1",
		});
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(tabIndicatorMix("horizontal", 1, "110px")).not.toBe(
			tabIndicatorMix("horizontal", 1, "110px"),
		);
	});
});

describe(Tabs.List.name, () => {
	test("leaves the indicator at its default resting fallback when activeIndex/tabSize are omitted", async () => {
		let html = await renderToString(
			<Tabs>
				<Tabs.List aria-label="Sections">
					<Tabs.Tab href="/a" aria-selected="true">
						A
					</Tabs.Tab>
					<Tabs.Tab href="/b" aria-selected="false">
						B
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>,
		);

		expect(html).toContain("var(--ui-tab-indicator-inline-size, 0px)");
		expect(html).toContain("var(--ui-tab-indicator-inline-start, 0px)");
		expect(html).toContain("var(--ui-tab-indicator-opacity, 0)");
		expect(html).not.toContain("--ui-tab-indicator-inline-start: calc(");
		expect(html).not.toContain("--ui-tab-indicator-inline-size: ");
		expect(html).not.toContain("--ui-tab-indicator-opacity: 1;");
	});

	test("computes and sets the three inline-axis custom properties when both activeIndex and tabSize are given", async () => {
		let html = await renderToString(
			<Tabs>
				<Tabs.List aria-label="Sections" activeIndex={1} tabSize="110px">
					<Tabs.Tab href="/a" aria-selected="false">
						A
					</Tabs.Tab>
					<Tabs.Tab href="/b" aria-selected="true">
						B
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>,
		);

		expect(html).toContain(
			"--ui-tab-indicator-inline-start: calc((110px + calc(var(--ui-spacing, 0.25rem) * 1)) * 1);",
		);
		expect(html).toContain("--ui-tab-indicator-inline-size: 110px;");
		expect(html).toContain("--ui-tab-indicator-opacity: 1;");
	});

	test("computes the block-axis custom properties instead for a vertical Tabs root", async () => {
		let html = await renderToString(
			<Tabs orientation="vertical">
				<Tabs.List aria-label="Sections" activeIndex={2} tabSize="80px">
					<Tabs.Tab href="/a" aria-selected="false">
						A
					</Tabs.Tab>
					<Tabs.Tab href="/b" aria-selected="false">
						B
					</Tabs.Tab>
					<Tabs.Tab href="/c" aria-selected="true">
						C
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>,
		);

		expect(html).toContain(
			"--ui-tab-indicator-block-start: calc((80px + calc(var(--ui-spacing, 0.25rem) * 1)) * 2);",
		);
		expect(html).toContain("--ui-tab-indicator-block-size: 80px;");
		expect(html).toContain("--ui-tab-indicator-opacity: 1;");
	});

	test.each([
		["activeIndex only", { activeIndex: 1 }],
		["tabSize only", { tabSize: "110px" }],
	])("does not override the indicator when only %s is given", async (_label, partial) => {
		let html = await renderToString(
			<Tabs>
				<Tabs.List aria-label="Sections" {...partial}>
					<Tabs.Tab href="/a" aria-selected="true">
						A
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>,
		);

		expect(html).not.toContain("--ui-tab-indicator-inline-start: calc(");
		expect(html).not.toContain("--ui-tab-indicator-opacity: 1;");
	});

	test("still merges a consumer-supplied mix alongside the computed indicator", async () => {
		let html = await renderToString(
			<Tabs>
				<Tabs.List
					aria-label="Sections"
					activeIndex={0}
					tabSize="110px"
					mix={css({ color: "red" })}
				>
					<Tabs.Tab href="/a" aria-selected="true">
						A
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>,
		);

		expect(html).toContain("color: red;");
		expect(html).toContain("--ui-tab-indicator-opacity: 1;");
	});

	test("keeps role=tablist and the orientation attributes unchanged by the new props", async () => {
		let html = await renderToString(
			<Tabs>
				<Tabs.List aria-label="Sections" activeIndex={0} tabSize="110px">
					<Tabs.Tab href="/a" aria-selected="true">
						A
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>,
		);

		expect(html).toContain('role="tablist"');
		expect(html).toContain('data-orientation="horizontal"');
		expect(html).toContain('aria-orientation="horizontal"');
	});
});

describe(Tabs.Tab.name, () => {
	test("renders as a real <a> carrying the tab role and a manually-set aria-selected", async () => {
		let html = await renderToString(
			<Tabs>
				<Tabs.Tab href="/settings/profile" aria-selected="true">
					Profile
				</Tabs.Tab>
			</Tabs>,
		);

		expect(html).toContain("<a");
		expect(html).toContain('href="/settings/profile"');
		expect(html).toContain('role="tab"');
		expect(html).toContain('aria-selected="true"');
		expect(html).toContain("Profile");
	});

	test("carries aria-selected=false for an inactive tab, unaffected by the indicator work", async () => {
		let html = await renderToString(
			<Tabs>
				<Tabs.Tab href="/settings/billing" aria-selected="false">
					Billing
				</Tabs.Tab>
			</Tabs>,
		);

		expect(html).toContain('aria-selected="false"');
	});
});
