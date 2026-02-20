import { describe, expect, test } from "bun:test";

import * as ContentType from "./content-type";

describe("text types", () => {
	test("Text has correct value", () => {
		expect(ContentType.Text).toBe("text/plain; charset=utf-8");
	});

	test("HTML has correct value", () => {
		expect(ContentType.HTML).toBe("text/html; charset=utf-8");
	});

	test("CSS has correct value", () => {
		expect(ContentType.CSS).toBe("text/css; charset=utf-8");
	});

	test("JavaScript has correct value", () => {
		expect(ContentType.JavaScript).toBe("text/javascript; charset=utf-8");
	});

	test("CSV has correct value", () => {
		expect(ContentType.CSV).toBe("text/csv; charset=utf-8");
	});

	test("XML has correct value", () => {
		expect(ContentType.XML).toBe("text/xml; charset=utf-8");
	});

	test("Markdown has correct value", () => {
		expect(ContentType.Markdown).toBe("text/markdown; charset=utf-8");
	});

	test("all text types include charset=utf-8", () => {
		expect(ContentType.Text).toContain("charset=utf-8");
		expect(ContentType.HTML).toContain("charset=utf-8");
		expect(ContentType.CSS).toContain("charset=utf-8");
		expect(ContentType.JavaScript).toContain("charset=utf-8");
		expect(ContentType.CSV).toContain("charset=utf-8");
		expect(ContentType.XML).toContain("charset=utf-8");
		expect(ContentType.Markdown).toContain("charset=utf-8");
	});
});

describe("application types", () => {
	test("Json has correct value", () => {
		expect(ContentType.Json).toBe("application/json; charset=utf-8");
	});

	test("JSONLines has correct value", () => {
		expect(ContentType.JSONLines).toBe("application/jsonl; charset=utf-8");
	});

	test("PDF has correct value", () => {
		expect(ContentType.PDF).toBe("application/pdf");
	});

	test("ZIP has correct value", () => {
		expect(ContentType.ZIP).toBe("application/zip");
	});

	test("GZip has correct value", () => {
		expect(ContentType.GZip).toBe("application/gzip");
	});

	test("FormData has correct value", () => {
		expect(ContentType.FormData).toBe("multipart/form-data");
	});

	test("FormURLEncoded has correct value", () => {
		expect(ContentType.FormURLEncoded).toBe("application/x-www-form-urlencoded");
	});

	test("OctetStream has correct value", () => {
		expect(ContentType.OctetStream).toBe("application/octet-stream");
	});

	test("ApplicationXML has correct value", () => {
		expect(ContentType.ApplicationXML).toBe("application/xml; charset=utf-8");
	});

	test("PDF has no charset", () => {
		expect(ContentType.PDF).not.toContain("charset");
	});

	test("ZIP has no charset", () => {
		expect(ContentType.ZIP).not.toContain("charset");
	});

	test("GZip has no charset", () => {
		expect(ContentType.GZip).not.toContain("charset");
	});

	test("OctetStream has no charset", () => {
		expect(ContentType.OctetStream).not.toContain("charset");
	});

	test("text-based application types include charset=utf-8", () => {
		expect(ContentType.Json).toContain("charset=utf-8");
		expect(ContentType.JSONLines).toContain("charset=utf-8");
		expect(ContentType.ApplicationXML).toContain("charset=utf-8");
	});
});

describe("image types", () => {
	test("PNG has correct value", () => {
		expect(ContentType.PNG).toBe("image/png");
	});

	test("JPEG has correct value", () => {
		expect(ContentType.JPEG).toBe("image/jpeg");
	});

	test("GIF has correct value", () => {
		expect(ContentType.GIF).toBe("image/gif");
	});

	test("WebP has correct value", () => {
		expect(ContentType.WebP).toBe("image/webp");
	});

	test("SVG has correct value", () => {
		expect(ContentType.SVG).toBe("image/svg+xml");
	});

	test("ICO has correct value", () => {
		expect(ContentType.ICO).toBe("image/x-icon");
	});

	test("AVIF has correct value", () => {
		expect(ContentType.AVIF).toBe("image/avif");
	});

	test("binary image types have no charset", () => {
		expect(ContentType.PNG).not.toContain("charset");
		expect(ContentType.JPEG).not.toContain("charset");
		expect(ContentType.GIF).not.toContain("charset");
		expect(ContentType.WebP).not.toContain("charset");
		expect(ContentType.ICO).not.toContain("charset");
		expect(ContentType.AVIF).not.toContain("charset");
	});

	test("SVG has no charset (XML-based but typically served without)", () => {
		expect(ContentType.SVG).not.toContain("charset");
	});
});

describe("audio types", () => {
	test("MP3 has correct value", () => {
		expect(ContentType.MP3).toBe("audio/mpeg");
	});

	test("WAV has correct value", () => {
		expect(ContentType.WAV).toBe("audio/wav");
	});

	test("OGG has correct value", () => {
		expect(ContentType.OGG).toBe("audio/ogg");
	});

	test("WebMAudio has correct value", () => {
		expect(ContentType.WebMAudio).toBe("audio/webm");
	});

	test("audio types have no charset", () => {
		expect(ContentType.MP3).not.toContain("charset");
		expect(ContentType.WAV).not.toContain("charset");
		expect(ContentType.OGG).not.toContain("charset");
		expect(ContentType.WebMAudio).not.toContain("charset");
	});
});

describe("video types", () => {
	test("MP4 has correct value", () => {
		expect(ContentType.MP4).toBe("video/mp4");
	});

	test("WebMVideo has correct value", () => {
		expect(ContentType.WebMVideo).toBe("video/webm");
	});

	test("video types have no charset", () => {
		expect(ContentType.MP4).not.toContain("charset");
		expect(ContentType.WebMVideo).not.toContain("charset");
	});
});

describe("font types", () => {
	test("WOFF has correct value", () => {
		expect(ContentType.WOFF).toBe("font/woff");
	});

	test("WOFF2 has correct value", () => {
		expect(ContentType.WOFF2).toBe("font/woff2");
	});

	test("TTF has correct value", () => {
		expect(ContentType.TTF).toBe("font/ttf");
	});

	test("OTF has correct value", () => {
		expect(ContentType.OTF).toBe("font/otf");
	});

	test("font types have no charset", () => {
		expect(ContentType.WOFF).not.toContain("charset");
		expect(ContentType.WOFF2).not.toContain("charset");
		expect(ContentType.TTF).not.toContain("charset");
		expect(ContentType.OTF).not.toContain("charset");
	});
});

describe("streaming types", () => {
	test("EventStream has correct value", () => {
		expect(ContentType.EventStream).toBe("text/event-stream");
	});

	test("NDJson has correct value", () => {
		expect(ContentType.NDJson).toBe("application/x-ndjson");
	});

	test("EventStream has no charset (typically omitted for SSE)", () => {
		expect(ContentType.EventStream).not.toContain("charset");
	});

	test("NDJson has no charset", () => {
		expect(ContentType.NDJson).not.toContain("charset");
	});
});
