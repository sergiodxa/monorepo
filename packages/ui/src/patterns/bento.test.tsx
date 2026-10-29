/**
 * Covers {@link Bento} column tracks and the host/wrapper container split.
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
			/@container ui-marketing-bento \(min-width:[^)]+\)\s*\{\s*\.([a-z0-9-]+)\s*\{/,
		);
		expect(tracksMatch?.[1]).toBeTruthy();
		expect(hostClasses.has(tracksMatch![1]!)).toBe(false);
	});
});
