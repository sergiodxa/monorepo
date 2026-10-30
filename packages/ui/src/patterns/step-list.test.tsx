/**
 * Covers {@link StepList} column tracks, the sizing-wrapper container split, the quiet
 * numbered disc, and the timeline variant's rule, timestamp and media column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { StepList } from "./step-list.js";

describe("StepList", () => {
	test("keeps the named container on a sizing wrapper around the ordered list", async () => {
		let html = await renderToString(
			<StepList>
				<StepList.Item title="Compose">Write the band.</StepList.Item>
				<StepList.Item title="Ship">Publish the page.</StepList.Item>
			</StepList>,
		);

		expect(html).toContain('data-slot="step-list"');
		expect(html).toContain("container: ui-marketing-step-list / inline-size");
		expect(html).toContain("@container ui-marketing-step-list (min-width:");
		expect(html).toContain("grid-auto-flow: column");
		expect(html).toMatch(
			/<div class="[^"]+"[^>]*>\s*<div data-heading-level="[1-6]"[^>]*>\s*<ol data-slot="step-list"/,
		);

		let listClasses = new Set(
			(html.match(/data-slot="step-list"[^>]*class="([^"]+)"/)?.[1] ?? "")
				.split(/\s+/)
				.filter(Boolean),
		);
		let tracksMatch = html.match(
			/@container ui-marketing-step-list \(min-width:[^)]+\)\s*\{\s*\.([a-z0-9-]+)\s*\{/,
		);
		expect(tracksMatch?.[1]).toBeTruthy();
		expect(listClasses.has(tracksMatch![1]!)).toBe(true);

		let containerClassMatch = html.match(
			/\.([a-z0-9-]+)\s*\{\s*container:\s*ui-marketing-step-list \/ inline-size;/,
		);
		expect(containerClassMatch?.[1]).toBeTruthy();
		expect(listClasses.has(containerClassMatch![1]!)).toBe(false);
	});

	test("draws the number in a quiet ringed disc joined by hairline connectors", async () => {
		let html = await renderToString(
			<StepList>
				<StepList.Item title="Add a monitor">Paste the URL.</StepList.Item>
				<StepList.Item title="Share the page">Customers subscribe.</StepList.Item>
			</StepList>,
		);

		expect(html).toContain('data-variant="numbered"');
		expect(html).toContain("box-shadow: inset 0 0 0 1px var(--ui-marketing-hairline");
		expect(html).toContain("inline-size: calc(var(--ui-spacing, 0.25rem) * 10)");
		expect(html).not.toContain("var(--ui-brand-bg-solid)");
	});

	test("runs a timeline down a rule with a timestamp, copy and media per step", async () => {
		let html = await renderToString(
			<StepList variant="timeline">
				<StepList.Item meta="14:02 UTC" title="Detected" media={<figure>Probe map</figure>}>
					Three regions <strong>agree</strong>.
				</StepList.Item>
				<StepList.Item title="Resolved">Back to green.</StepList.Item>
			</StepList>,
		);

		expect(html).toContain('data-variant="timeline"');
		expect(html).toContain('data-slot="step-list-meta"');
		expect(html).toContain("14:02 UTC");
		expect(html).toContain('data-slot="step-list-media"');
		expect(html).toContain("Probe map");
		expect(html).toContain("grid-template-columns: minmax(0, 5fr) minmax(0, 7fr)");
		expect(html).toContain("background-color: var(--ui-brand-bg-solid)");
		expect(html).not.toContain("grid-auto-flow: column");
		expect(html.match(/data-slot="step-list-media"/g)).toHaveLength(1);
	});
});
