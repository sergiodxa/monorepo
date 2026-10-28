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

	test("adds panel chrome when variant is panel", async () => {
		let html = await renderToString(
			<Feature variant="panel">
				<Feature.Title>Panel claim</Feature.Title>
			</Feature>,
		);

		expect(html).toContain('data-variant="panel"');
	});
});
