/**
 * Covers {@link Split} lean tracks, check-styled copy lists, and media column
 * sizing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Split } from "./split.js";

describe("Split", () => {
	test("leans the wider track toward copy when requested", async () => {
		let html = await renderToString(
			<Split lean="copy">
				<Split.Copy>Claims</Split.Copy>
				<Split.Media>Shot</Split.Media>
			</Split>,
		);

		expect(html).toContain('data-lean="copy"');
		expect(html).toContain("container: ui-marketing-split / inline-size");
		expect(html).toContain("1.15fr");
		expect(html).toContain("0.85fr");
		expect(html).toContain('data-slot="split-copy"');
		expect(html).toContain('data-slot="split-media"');
	});

	test("marks checked claim lists when checks is set", async () => {
		let html = await renderToString(
			<Split.Copy checks>
				<ul>
					<li>Claim one</li>
				</ul>
			</Split.Copy>,
		);

		expect(html).toContain('data-checks="true"');
		expect(html).toContain("list-style: none");
		expect(html).toContain("-webkit-mask:");
	});

	test("keeps the named container on the host and the column tracks on an inner wrapper", async () => {
		let html = await renderToString(
			<Split lean="media">
				<Split.Copy>Claims</Split.Copy>
				<Split.Media>Shot</Split.Media>
			</Split>,
		);

		expect(html).toMatch(/data-slot="split"[^>]*>\s*<div\b/);
		expect(html).toContain("container: ui-marketing-split / inline-size");
		expect(html).toContain("@container ui-marketing-split (min-width: 64rem)");

		let hostClasses = new Set(
			(html.match(/data-slot="split"[^>]*class="([^"]+)"/)?.[1] ?? "").split(/\s+/).filter(Boolean),
		);
		let tracksMatch = html.match(
			/@container ui-marketing-split \(min-width:[^)]+\)\s*\{\s*\.([a-z0-9-]+)\s*\{/,
		);
		expect(tracksMatch?.[1]).toBeTruthy();
		expect(hostClasses.has(tracksMatch![1]!)).toBe(false);
	});
});
