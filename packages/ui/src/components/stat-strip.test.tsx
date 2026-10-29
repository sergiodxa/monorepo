/**
 * Covers {@link StatStrip} ruled and gap variants plus item value/label slots.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { StatStrip } from "./stat-strip.js";

describe("StatStrip", () => {
	test("renders ruled cells with value and label", async () => {
		let html = await renderToString(
			<StatStrip>
				<StatStrip.Item label="Packages">42</StatStrip.Item>
				<StatStrip.Item label="Apps">12</StatStrip.Item>
			</StatStrip>,
		);

		expect(html).toContain('data-variant="ruled"');
		expect(html).toContain("42");
		expect(html).toContain("Packages");
		expect(html).toContain("border-inline-start");
		expect(html).toContain("container: ui-marketing-stat-strip / inline-size");
	});

	test("uses a gap seam when variant is gap", async () => {
		let html = await renderToString(
			<StatStrip variant="gap">
				<StatStrip.Item label="Uptime">99.99%</StatStrip.Item>
			</StatStrip>,
		);

		expect(html).toContain('data-variant="gap"');
		expect(html).toContain("99.99%");
	});

	test("keeps the named container on the host and the column tracks on an inner wrapper", async () => {
		let html = await renderToString(
			<StatStrip>
				<StatStrip.Item label="Packages">42</StatStrip.Item>
				<StatStrip.Item label="Apps">12</StatStrip.Item>
			</StatStrip>,
		);

		expect(html).toMatch(/data-slot="stat-strip"[^>]*>\s*<div\b/);
		expect(html).toContain("container: ui-marketing-stat-strip / inline-size");
		expect(html).toContain("@container ui-marketing-stat-strip (min-width:");
		expect(html).toContain("repeat(5, minmax(0, 1fr))");

		let hostClasses = new Set(
			(html.match(/data-slot="stat-strip"[^>]*class="([^"]+)"/)?.[1] ?? "")
				.split(/\s+/)
				.filter(Boolean),
		);
		let tracksMatch = html.match(
			/@container ui-marketing-stat-strip \(min-width:[^)]+\)\s*\{\s*\.([a-z0-9-]+)\s*\{/,
		);
		expect(tracksMatch?.[1]).toBeTruthy();
		expect(hostClasses.has(tracksMatch![1]!)).toBe(false);
	});
});
