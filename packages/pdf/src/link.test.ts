/**
 * Tests for link annotations: the rectangle in PDF space from a top-down box, the borderless
 * URI action, the ASCII form of the URI, and the page's `/Annots` array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Canvas } from "./canvas.js";

import { inspect } from "./inspect.js";
import { addLink, asciiURI, linkAnnotation } from "./link.js";
import { serialize } from "./objects.js";
import { PDF } from "./pdf.js";

/** An empty canvas for a page `height` points tall. */
function canvas(height: number): Canvas {
	return { width: 600, height, ops: [], fonts: new Set(), images: new Set(), links: [] };
}

describe("addLink", () => {
	test("turns a top-down box into a PDF-space rectangle", () => {
		let page = canvas(800);
		addLink(page, { x: 40, y: 100, width: 200, height: 20 }, "https://sergiodxa.com");
		expect(page.links).toEqual([{ rect: [40, 680, 240, 700], href: "https://sergiodxa.com" }]);
		expect(page.ops).toEqual([]);
	});

	test("orders the corners of a box with a negative size", () => {
		let page = canvas(800);
		addLink(page, { x: 100, y: 100, width: -50, height: -10 }, "https://sergiodxa.com");
		expect(page.links[0]?.rect).toEqual([50, 700, 100, 710]);
	});
});

describe("linkAnnotation", () => {
	test("writes a borderless Link annotation with a URI action", () => {
		let annotation = linkAnnotation({ rect: [1, 2, 3, 4], href: "https://sergiodxa.com/a(b)" });
		expect(serialize(annotation)).toBe(
			"<< /Type /Annot /Subtype /Link /Rect [1 2 3 4] /Border [0 0 0]" +
				" /A << /Type /Action /S /URI /URI (https://sergiodxa.com/a\\(b\\)) >> >>",
		);
	});
});

describe("asciiURI", () => {
	test("percent-encodes non-ASCII paths and turns international hosts into Punycode", () => {
		expect(asciiURI("https://example.com/café?q=ñ#ü")).toBe(
			"https://example.com/caf%C3%A9?q=%C3%B1#%C3%BC",
		);
		expect(asciiURI("https://bücher.de/")).toBe("https://xn--bcher-kva.de/");
	});

	test("encodes spaces and non-ASCII in a URI the URL parser rejects", () => {
		expect(asciiURI("/docs/a b/ñ")).toBe("/docs/a%20b/%C3%B1");
		expect(asciiURI("mailto:hola@sergiodxa.com")).toBe("mailto:hola@sergiodxa.com");
	});
});

test("lists every link of a page in its /Annots", async () => {
	let pdf = new PDF({ size: [600, 800] });
	let page = pdf.page();
	page.link({ x: 10, y: 10, width: 100, height: 12 }, "https://sergiodxa.com/ü");
	page.link({ x: 10, y: 30, width: 100, height: 12 }, "https://sergiodxa.com/b");
	pdf.page();
	let file = inspect(await pdf.bytes());
	let pages = [...file.objects.values()].filter((object) => /\/Type \/Page\b/.test(object.head));
	let refs = /\/Annots \[(\d+) 0 R (\d+) 0 R\]/.exec(pages[0]?.head ?? "")?.slice(1) ?? [];
	expect(file.objects.get(Number(refs[0]))?.head).toContain(
		"/Rect [10 778 110 790] /Border [0 0 0] /A << /Type /Action /S /URI /URI (https://sergiodxa.com/%C3%BC) >>",
	);
	expect(file.objects.get(Number(refs[1]))?.head).toContain("/Rect [10 758 110 770]");
	expect(pages[1]?.head).not.toContain("/Annots");
	expect(file.xrefValid).toBe(true);
});
