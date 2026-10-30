/**
 * Covers {@link ProductFrame} stages, shadow treatments, neutral and colored
 * traffic lights, the footer strip and the device radius.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { ProductFrame } from "./product-frame.js";

describe("ProductFrame", () => {
	test("draws a ring and stage lift on a raised body by default, with no stage", async () => {
		let html = await renderToString(
			<ProductFrame id="shot">
				<div>Stage</div>
			</ProductFrame>,
		);

		expect(html).not.toContain("product-frame-stage");
		expect(html).toMatch(
			/data-slot="product-frame"[^>]*id="shot"|id="shot"[^>]*data-slot="product-frame"/,
		);
		expect(html).toContain("box-shadow: var(--ui-shadow-stage)");
		expect(html).toContain("border-radius: 0.75rem");
		expect(html).toContain("background-color: var(--ui-surface-raised, Canvas)");
		expect(html).not.toMatch(/border: 1px solid|border-width: 1px/);
	});

	test("sets the frame on a tinted panel at 86% width with stage panel", async () => {
		let html = await renderToString(
			<ProductFrame stage="panel" id="shot">
				<div>Stage</div>
			</ProductFrame>,
		);

		expect(html).toMatch(/id="shot"[^>]*data-slot="product-frame-stage"[^>]*data-stage="panel"/);
		expect(html).toContain(
			"background-color: color-mix(in oklch, var(--ui-neutral-fg-emphasis) 4%, transparent)",
		);
		expect(html).toContain("padding-inline: clamp(1rem, 4cqi, 4rem)");
		expect(html).toContain("padding-block: clamp(1rem, 3cqi, 3rem)");
		expect(html).toContain("max-inline-size: 86%");
		expect(html).toContain("background-image: none");
	});

	test("paints a brand glow on a backdrop stage, or the page's backdrop instead", async () => {
		let glow = await renderToString(
			<ProductFrame stage="backdrop">
				<div>Stage</div>
			</ProductFrame>,
		);
		expect(glow).toContain("var(--ui-brand-bg-solid) 12%");

		let custom = await renderToString(
			<ProductFrame stage="backdrop" backdrop={<img src="/bg.jpg" alt="" />}>
				<div>Stage</div>
			</ProductFrame>,
		);
		expect(custom).toMatch(/aria-hidden="true"[^>]*data-slot="product-frame-backdrop"/);
		expect(custom).toContain('src="/bg.jpg"');
		expect(custom).not.toContain("var(--ui-brand-bg-solid) 12%");
	});

	test("casts a brand-tinted two-layer lift with shadow tinted", async () => {
		let html = await renderToString(
			<ProductFrame shadow="tinted">
				<div>Stage</div>
			</ProductFrame>,
		);

		expect(html).toContain('data-shadow="tinted"');
		expect(html).toContain(
			"0 20px 25px -5px color-mix(in oklch, var(--ui-brand-bg-solid) 20%, transparent), 0 8px 10px -6px color-mix(in oklch, var(--ui-brand-bg-solid) 20%, transparent)",
		);
	});

	test("draws neutral lights by default and the status set with lights color", async () => {
		let neutral = await renderToString(
			<ProductFrame lights>
				<div>Stage</div>
			</ProductFrame>,
		);
		expect(neutral).toContain("var(--ui-neutral-fg-emphasis) 15%");
		expect(neutral).not.toContain("--ui-danger-bg-solid");

		let color = await renderToString(
			<ProductFrame lights="color">
				<div>Stage</div>
			</ProductFrame>,
		);
		expect(color).toContain('data-color="true"');
		expect(color).toContain("--ui-danger-bg-solid");
	});

	test("renders the footer as a strip under the body", async () => {
		let html = await renderToString(
			<ProductFrame footer="Powered by Beacon">
				<div>Stage</div>
			</ProductFrame>,
		);

		expect(html).toMatch(
			/data-slot="product-frame-body".*data-slot="product-frame-footer"[^>]*>Powered by Beacon/s,
		);
	});

	test("gives the device variant a proportional radius and a deep lift", async () => {
		let html = await renderToString(
			<ProductFrame variant="device">
				<div>Stage</div>
			</ProductFrame>,
		);

		expect(html).toContain("border-radius: 16% / 8%");
		expect(html).toContain("0 25px 50px -12px rgb(0 0 0 / 0.25)");
	});
});
