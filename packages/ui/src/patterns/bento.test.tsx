/**
 * Covers {@link Bento} column steps, chrome variants, outer-corner rules, the
 * media slot, the hero title step and the host/wrapper container split.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Bento } from "./bento.js";

describe("Bento", () => {
	test("keeps the named container on the host and the column tracks on an inner wrapper", async () => {
		let html = await renderToString(
			<Bento columns={3}>
				<Bento.Cell>
					<Bento.Title>One</Bento.Title>
					<Bento.Body>First claim.</Bento.Body>
				</Bento.Cell>
				<Bento.Cell>
					<Bento.Title>Two</Bento.Title>
					<Bento.Body>Second claim.</Bento.Body>
				</Bento.Cell>
			</Bento>,
		);

		expect(html).toContain('data-columns="3"');
		expect(html).toContain("container: ui-marketing-bento / inline-size");
		expect(html).toContain("repeat(3, minmax(0, 1fr))");
		expect(html).toMatch(/data-slot="bento"[^>]*>\s*<div\b/);

		let hostClasses = new Set(
			(html.match(/data-slot="bento"[^>]*class="([^"]+)"/)?.[1] ?? "").split(/\s+/).filter(Boolean),
		);
		let tracksMatch = html.match(
			/@container ui-marketing-bento \([^)]+\)\s*\{\s*\.([a-z0-9-]+)\s*\{/,
		);
		expect(tracksMatch?.[1]).toBeTruthy();
		expect(hostClasses.has(tracksMatch![1]!)).toBe(false);
	});

	test("draws separate cards by default and rounds outer corners at every step", async () => {
		let html = await renderToString(
			<Bento columns={4}>
				<Bento.Cell>
					<Bento.Title>Monitors</Bento.Title>
				</Bento.Cell>
			</Bento>,
		);

		expect(html).toContain('data-variant="cards"');
		expect(html).toContain("@container ui-marketing-bento (width < 36rem)");
		expect(html).toContain("@container ui-marketing-bento (36rem <= width < 48rem)");
		expect(html).toContain("@container ui-marketing-bento (width >= 48rem)");
		expect(html).toContain("> :nth-child(4n + 1):nth-last-child(-n + 4)");
		expect(html).toContain("& > :last-child:nth-child(4n + 3)");
		expect(html).toContain("grid-column: span 2");
	});

	test("hands lg outer corners to the page once a cell names its own", async () => {
		let html = await renderToString(
			<Bento columns={3}>
				<Bento.Cell data-corner="start-start end-start">
					<Bento.Title>Status pages</Bento.Title>
				</Bento.Cell>
			</Bento>,
		);

		expect(html).toContain('data-corner="start-start end-start"');
		expect(html).toContain("&:not(:has(> [data-corner])) > :first-child");
		expect(html).toContain('& > [data-corner~="end-start"]');
	});

	test("keeps the hairline mosaic as an opt-in variant", async () => {
		let html = await renderToString(
			<Bento variant="mosaic">
				<Bento.Cell>
					<Bento.Title>Incidents</Bento.Title>
				</Bento.Cell>
			</Bento>,
		);

		expect(html).toContain('data-variant="mosaic"');
		expect(html).toContain("background-color: var(--ui-marketing-hairline");
		expect(html).not.toContain("--ui-marketing-card-radius-outer");
	});

	test("pads cells 1.5rem, 2.5rem from lg, and lets media bleed to the edges", async () => {
		let html = await renderToString(
			<Bento>
				<Bento.Cell>
					<Bento.Media>
						<img src="/incidents.png" alt="" />
					</Bento.Media>
					<Bento.Title size="lg">Incidents</Bento.Title>
					<Bento.Body>
						Open one <strong>from the alert</strong>.
					</Bento.Body>
				</Bento.Cell>
			</Bento>,
		);

		expect(html).toContain("--ui-marketing-cell-padding-block: 1.5rem");
		expect(html).toMatch(
			/@container ui-marketing-bento \(min-width: 48rem\)\s*\{\s*\.[a-z0-9-]+\s*\{\s*--ui-marketing-cell-padding-block: 2\.5rem/,
		);
		expect(html).toContain('data-slot="bento-media"');
		expect(html).toContain(
			"margin-inline: calc(-1 * var(--ui-marketing-cell-padding-inline, 0px))",
		);
		expect(html).toContain('data-size="lg"');
		expect(html).toContain("var(--ui-text-xl, 1.25rem)");
		expect(html).toMatch(
			/@container ui-marketing-bento \(min-width: 36rem\)\s*\{\s*\.[a-z0-9-]+\s*\{\s*font-size: var\(--ui-text-2xl/,
		);
		expect(html).toContain(":is(strong, b, [data-emphasis])");
	});
});
