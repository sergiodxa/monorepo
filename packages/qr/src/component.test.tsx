/**
 * Tests the `QrCode` component through server rendering: the image role and name, the
 * viewBox with its quiet zone, the fixed colors, and the forced-colors opt-out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { css } from "remix/component";
import { renderToString } from "remix/component/server";
import { expect, test } from "vitest";

import type { SvgPath } from "./svg-path.js";

import { QrCode } from "./component.js";
import { QR } from "./encode.js";

/** A version 1 symbol, 21 modules a side, with the standard four-module quiet zone. */
const PATH = unwrap(QR.encode("HELLO WORLD")).toSVGPath();

test("renders an image named by its label", async () => {
	let html = await renderToString(<QrCode path={PATH} label="Scan to add this account" />);
	expect(html).toMatch(/<svg [^>]*role="img"/);
	expect(html).toContain('aria-label="Scan to add this account"');
});

test("uses the path's viewBox, quiet zone included", async () => {
	expect(await renderToString(<QrCode path={PATH} label="Code" />)).toContain(
		'viewBox="0 0 29 29"',
	);
	let narrow = unwrap(QR.encode("HELLO WORLD")).toSVGPath({ margin: 2 });
	expect(await renderToString(<QrCode path={narrow} label="Code" />)).toContain(
		'viewBox="0 0 25 25"',
	);
});

test("draws dark modules over a light background at the given size", async () => {
	let html = await renderToString(<QrCode path={PATH} label="Code" size="10rem" />);
	expect(html).toContain('width="10rem"');
	expect(html).toContain('height="10rem"');
	expect(html).toContain('shape-rendering="crispEdges"');
	expect(html).toContain('<rect width="100%" height="100%" fill="#fff"');
	expect(html).toContain(`<path d="${PATH.d}" fill="#000"`);
});

test("defaults to 12rem and accepts brand colors", async () => {
	let html = await renderToString(
		<QrCode path={PATH} label="Code" dark="#1a237e" light="#fffde7" />,
	);
	expect(html).toContain('width="12rem"');
	expect(html).toContain('fill="#fffde7"');
	expect(html).toContain('fill="#1a237e"');
});

test("renders from path data that survives a JSON round trip", async () => {
	let serialized = JSON.parse(JSON.stringify(PATH)) as SvgPath;
	expect(await renderToString(<QrCode path={serialized} label="Code" />)).toBe(
		await renderToString(<QrCode path={PATH} label="Code" />),
	);
});

test("opts out of forced colors and passes mixins through", async () => {
	let html = await renderToString(
		<QrCode path={PATH} label="Code" mix={css({ borderRadius: "8px" })} />,
	);
	expect(html).toContain("forced-color-adjust: none");
	expect(html).toContain("border-radius: 8px");
});
