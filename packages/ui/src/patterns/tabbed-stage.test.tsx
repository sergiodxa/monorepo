/**
 * Covers {@link TabbedStage} markup for both orientations: pill tabs over a full-width
 * stage, and a rail of items beside a sticky stage column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { TabbedStage } from "./tabbed-stage.js";

describe("TabbedStage", () => {
	test("lifts the selected pill onto the raised surface in a horizontal stage", async () => {
		let html = await renderToString(
			<TabbedStage name="views" aria-label="Product views">
				<TabbedStage.Item value="monitors" label="Monitors" defaultChecked>
					<p>Monitors panel</p>
				</TabbedStage.Item>
				<TabbedStage.Item value="alerts" label="Alerts" description="Ignored here.">
					<p>Alerts panel</p>
				</TabbedStage.Item>
			</TabbedStage>,
		);

		expect(html).toContain('data-orientation="horizontal"');
		expect(html).toContain("background-color: var(--ui-surface-raised, Canvas)");
		expect(html).toContain("box-shadow: var(--ui-shadow-control");
		expect(html).toContain("background-color: var(--ui-neutral-bg-tint-hover)");
		expect(html).not.toContain("--ui-brand-bg-solid");
		expect(html).not.toContain("Ignored here.");
	});

	test("lays a vertical stage as a rail beside a sticky stage column", async () => {
		let html = await renderToString(
			<TabbedStage name="how" orientation="vertical" aria-label="How it works">
				<TabbedStage.Item value="detect" label="Detect" description="Probes agree." defaultChecked>
					<p>Detect panel</p>
				</TabbedStage.Item>
				<TabbedStage.Item value="page" label="Page">
					<p>Page panel</p>
				</TabbedStage.Item>
				<TabbedStage.Item value="resolve" label="Resolve">
					<p>Resolve panel</p>
				</TabbedStage.Item>
			</TabbedStage>,
		);

		expect(html).toContain('data-orientation="vertical"');
		expect(html).toContain("container: ui-tabbed-stage / inline-size");
		expect(html).toContain("@container ui-tabbed-stage (min-width: 48rem)");
		expect(html).toContain("grid-template-rows: repeat(3, min-content) 1fr");
		expect(html).toContain("position: sticky");
		expect(html).toContain("calc(var(--ui-marketing-header-height, 4rem) + 2rem)");
		expect(html).toContain("outline-offset: -2px");
		expect(html).toContain('data-slot="tabbed-stage-description"');
		expect(html).toContain("Probes agree.");
	});
});
