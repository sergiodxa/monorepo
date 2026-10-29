/**
 * Covers {@link Feature} compound parts and {@link Feature.Grid} column
 * tracks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Feature } from "./feature.js";

describe("Feature", () => {
	test("composes icon, title, description, and action parts", async () => {
		let html = await renderToString(
			<Feature>
				<Feature.Icon>★</Feature.Icon>
				<Feature.Title>Fast checks</Feature.Title>
				<Feature.Description>Probe from the edge.</Feature.Description>
				<Feature.Action>
					<a href="/docs">Read more</a>
				</Feature.Action>
			</Feature>,
		);

		expect(html).toContain('data-slot="feature"');
		expect(html).toContain('data-slot="feature-icon"');
		expect(html).toContain("Fast checks");
		expect(html).toContain("Probe from the edge.");
		expect(html).toContain("Read more");
	});

	test("lays cells in a hairline grid with column spanning for a lone last cell", async () => {
		let html = await renderToString(
			<Feature.Grid columns={3}>
				<Feature>
					<Feature.Title>One</Feature.Title>
				</Feature>
				<Feature>
					<Feature.Title>Two</Feature.Title>
				</Feature>
				<Feature>
					<Feature.Title>Three</Feature.Title>
				</Feature>
			</Feature.Grid>,
		);

		expect(html).toContain('data-columns="3"');
		expect(html).toContain("container: ui-marketing-feature-grid / inline-size");
		expect(html).toContain("repeat(3, minmax(0, 1fr))");
		expect(html).toContain("var(--ui-neutral-border)");
	});

	test("keeps the named container on the host and the column tracks on an inner wrapper", async () => {
		let html = await renderToString(
			<Feature.Grid columns={2}>
				<Feature>
					<Feature.Title>One</Feature.Title>
				</Feature>
				<Feature>
					<Feature.Title>Two</Feature.Title>
				</Feature>
			</Feature.Grid>,
		);

		expect(html).toMatch(/data-slot="feature-grid"[^>]*>\s*<div\b/);
		expect(html).toContain("container: ui-marketing-feature-grid / inline-size");
		expect(html).toContain("@container ui-marketing-feature-grid (min-width:");

		let hostClasses = new Set(
			(html.match(/data-slot="feature-grid"[^>]*class="([^"]+)"/)?.[1] ?? "")
				.split(/\s+/)
				.filter(Boolean),
		);
		let tracksMatch = html.match(
			/@container ui-marketing-feature-grid \(min-width:[^)]+\)\s*\{\s*\.([a-z0-9-]+)\s*\{/,
		);
		expect(tracksMatch?.[1]).toBeTruthy();
		expect(hostClasses.has(tracksMatch![1]!)).toBe(false);
	});

	test("adds panel chrome when variant is panel", async () => {
		let html = await renderToString(
			<Feature variant="panel">
				<Feature.Title>Panel claim</Feature.Title>
			</Feature>,
		);

		expect(html).toContain('data-variant="panel"');
	});
});
