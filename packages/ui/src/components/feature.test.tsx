/**
 * Covers {@link Feature} compound parts, {@link Feature.Grid} column steps
 * and chrome variants, the media slot and the icon tile tones.
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

	test("lays cells as separate cards by default, spanning a lone last cell", async () => {
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
		expect(html).toContain('data-variant="cards"');
		expect(html).toContain("var(--ui-surface-raised, Canvas)");
		expect(html).toContain("var(--ui-marketing-card-radius-outer, 1.5rem)");
		expect(html).toContain("& > :last-child:nth-child(3n + 1)");
		expect(html).toContain("& > :last-child:nth-child(3n + 2)");
	});

	test("steps to two columns at the md container and the requested count at lg", async () => {
		let html = await renderToString(
			<Feature.Grid columns={3}>
				<Feature>
					<Feature.Title>One</Feature.Title>
				</Feature>
			</Feature.Grid>,
		);

		expect(html).toMatch(
			/@container ui-marketing-feature-grid \(36rem <= width < 48rem\)\s*\{\s*\.[a-z0-9-]+\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
		);
		expect(html).toMatch(
			/@container ui-marketing-feature-grid \(width >= 48rem\)\s*\{\s*\.[a-z0-9-]+\s*\{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
		);
	});

	test("draws a mosaic's rules with the marketing hairline", async () => {
		let html = await renderToString(
			<Feature.Grid variant="mosaic">
				<Feature>
					<Feature.Title>One</Feature.Title>
				</Feature>
			</Feature.Grid>,
		);

		expect(html).toContain('data-variant="mosaic"');
		expect(html).toContain("gap: 1px");
		expect(html).toContain("background-color: var(--ui-marketing-hairline");
		expect(html).not.toContain("--ui-marketing-card-radius-outer");
	});

	test("bleeds media past the cell padding, fades it, and hides it below md", async () => {
		let html = await renderToString(
			<Feature>
				<Feature.Media>
					<img src="/monitors.png" alt="" />
				</Feature.Media>
				<Feature.Title>Monitors</Feature.Title>
			</Feature>,
		);

		expect(html).toContain('data-slot="feature-media"');
		expect(html).toContain(
			"margin-block-start: calc(-1 * var(--ui-marketing-cell-padding-block, 0px))",
		);
		expect(html).toContain("mask-image: linear-gradient(to bottom, black 50%, transparent)");
		expect(html).toMatch(
			/display: none;[\s\S]*@container \(min-width: 36rem\)[^{]*\{[^{]*\{\s*display: block/,
		);
	});

	test("draws a quiet hairline icon tile by default and the brand badge on request", async () => {
		let quiet = await renderToString(<Feature.Icon>★</Feature.Icon>);
		let brand = await renderToString(<Feature.Icon tone="brand">★</Feature.Icon>);

		expect(quiet).toContain('data-tone="quiet"');
		expect(quiet).toContain("box-shadow: inset 0 0 0 1px var(--ui-marketing-hairline");
		expect(quiet).not.toContain("--ui-brand-bg-tint");
		expect(brand).toContain('data-tone="brand"');
		expect(brand).toContain("var(--ui-brand-bg-tint");
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
		expect(html).toContain("@container ui-marketing-feature-grid (width >= 48rem)");

		let hostClasses = new Set(
			(html.match(/data-slot="feature-grid"[^>]*class="([^"]+)"/)?.[1] ?? "")
				.split(/\s+/)
				.filter(Boolean),
		);
		let tracksMatch = html.match(
			/@container ui-marketing-feature-grid \([^)]+\)\s*\{\s*\.([a-z0-9-]+)\s*\{/,
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
