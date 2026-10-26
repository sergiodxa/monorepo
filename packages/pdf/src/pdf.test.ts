/**
 * Tests for the document: page sizes, the catalog and information dictionary, compressed
 * content streams and byte-for-byte deterministic output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { inspect, pageContents } from "./inspect.js";
import { PDF } from "./pdf.js";

/** The object whose head matches `pattern`. */
function find(file: ReturnType<typeof inspect>, pattern: RegExp): string {
	return [...file.objects.values()].find((object) => pattern.test(object.head))?.head ?? "";
}

describe("PDF", () => {
	test("writes a valid file with one empty letter page by default", async () => {
		let pdf = new PDF();
		pdf.page();
		let file = inspect(await pdf.bytes());
		expect(file.xrefValid).toBe(true);
		expect(find(file, /\/Type \/Page\b/)).toContain("/MediaBox [0 0 612 792]");
		expect(find(file, /\/Type \/Pages/)).toContain("/Count 1");
		expect(file.trailer).toMatch(/\/Root 1 0 R \/Info 3 0 R/);
	});

	test("sizes pages by name, by dimensions, and per page", async () => {
		let pdf = new PDF({ size: "a4" });
		let first = pdf.page();
		let second = pdf.page({ size: [300, 400] });
		expect([first.width, first.height]).toEqual([595.28, 841.89]);
		expect([second.width, second.height]).toEqual([300, 400]);
		let file = inspect(await pdf.bytes());
		let pages = [...file.objects.values()].filter((o) => /\/Type \/Page\b/.test(o.head));
		expect(pages.map((page) => /\/MediaBox \[([^\]]+)\]/.exec(page.head)?.[1])).toEqual([
			"0 0 595.28 841.89",
			"0 0 300 400",
		]);
	});

	test("writes metadata into the catalog and information dictionary", async () => {
		let pdf = new PDF({
			title: "Résumé",
			author: "Ada Lovelace",
			subject: "Work",
			keywords: ["engineer", "mathematician"],
			lang: "en",
			createdAt: new Date(Date.UTC(2026, 9, 26, 8, 5, 9)),
		});
		pdf.page();
		let file = inspect(await pdf.bytes());
		let catalog = find(file, /\/Type \/Catalog/);
		expect(catalog).toContain("/Lang (en)");
		expect(catalog).toContain("/ViewerPreferences << /DisplayDocTitle true >>");
		let info = file.objects.get(3)?.head ?? "";
		expect(info).toContain("/Title <FEFF");
		expect(info).toContain("/Author (Ada Lovelace)");
		expect(info).toContain("/Keywords (engineer, mathematician)");
		expect(info).toContain("/CreationDate (D:20261026080509Z)");
		expect(info).toContain("/Producer (@sdxc/pdf)");
	});

	test("compresses each page's content stream", async () => {
		let pdf = new PDF();
		pdf.page().line({ from: [0, 0], to: [10, 0] });
		pdf.page().rect({ x: 0, y: 0, width: 5, height: 5, fill: "#000000" });
		let file = inspect(await pdf.bytes());
		expect(find(file, /\/Filter \/FlateDecode/)).toMatch(/\/Length \d+/);
		let contents = await pageContents(file);
		expect(contents).toHaveLength(2);
		expect(contents[0]).toContain("0 792 m\n10 792 l");
		expect(contents[1]).toContain("0 787 5 5 re");
	});

	test("writes the same bytes for the same calls", async () => {
		let draw = () => {
			let pdf = new PDF({ title: "Same", createdAt: new Date(0) });
			pdf.page().rect({ x: 1, y: 2, width: 3, height: 4, stroke: "#123456", radius: 1 });
			return pdf.bytes();
		};
		expect(await draw()).toEqual(await draw());
	});

	test("streams the same bytes it answers", async () => {
		let pdf = new PDF();
		pdf.page().line({ from: [0, 0], to: [1, 1] });
		let streamed = new Uint8Array(await new Response(pdf.stream()).arrayBuffer());
		expect(streamed).toEqual(await pdf.bytes());
	});
});
