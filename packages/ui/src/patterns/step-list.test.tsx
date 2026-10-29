/**
 * Covers {@link StepList} column tracks and the sizing-wrapper container split.
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
		expect(html).toContain("repeat(3, minmax(0, 1fr))");
		expect(html).toMatch(/<div class="[^"]+"[^>]*>\s*<ol data-slot="step-list"/);

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
});
