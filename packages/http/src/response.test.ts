/**
 * Tests for the Response builders, covering their Content-Type headers,
 * bodies, status defaults, and header overrides.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@sdxc/location";
import { describe, expect, test } from "vitest";

import * as ContentType from "./content-type.js";
import {
	attachment,
	css,
	csv,
	file,
	html,
	javascript,
	json,
	markdown,
	noContent,
	pdf,
	redirect,
	stream,
	text,
	xml,
} from "./response.js";

describe(json, () => {
	test("creates JSON response", async () => {
		let res = json({ message: "Hello" });
		let body = await res.json();
		expect(body).toEqual({ message: "Hello" });
	});

	test("accepts custom status", () => {
		let res = json({ error: "Not found" }, { status: 404 });
		expect(res.status).toBe(404);
	});
});

describe(text, () => {
	test("sets text/plain content-type", () => {
		let res = text("Hello, World!");
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.Text}; charset=utf-8`);
	});

	test("returns text body", async () => {
		let res = text("Hello, World!");
		let body = await res.text();
		expect(body).toBe("Hello, World!");
	});

	test("accepts custom status", () => {
		let res = text("Error occurred", { status: 500 });
		expect(res.status).toBe(500);
	});
});

describe(html, () => {
	test("sets HTML content-type", () => {
		let res = html("<h1>Hello</h1>");
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.HTML}; charset=utf-8`);
	});

	test("returns HTML body", async () => {
		let res = html("<h1>Hello</h1>");
		let body = await res.text();
		expect(body).toBe("<h1>Hello</h1>");
	});

	test("accepts custom status", () => {
		let res = html("<h1>Not Found</h1>", { status: 404 });
		expect(res.status).toBe(404);
	});
});

describe(css, () => {
	test("sets CSS content-type", () => {
		let res = css("body { color: red; }");
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.CSS}; charset=utf-8`);
	});

	test("returns CSS body", async () => {
		let res = css("body { color: red; }");
		let body = await res.text();
		expect(body).toBe("body { color: red; }");
	});

	test("accepts custom headers", () => {
		let res = css(".error { color: red; }", {
			headers: { "Cache-Control": "max-age=3600" },
		});
		expect(res.headers.get("Cache-Control")).toBe("max-age=3600");
	});
});

describe(javascript, () => {
	test("sets JavaScript content-type", () => {
		let res = javascript("console.log('Hello');");
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.JavaScript}; charset=utf-8`);
	});

	test("returns JavaScript body", async () => {
		let res = javascript("console.log('Hello');");
		let body = await res.text();
		expect(body).toBe("console.log('Hello');");
	});

	test("accepts custom headers", () => {
		let res = javascript("export default 42;", {
			headers: { "Cache-Control": "max-age=3600" },
		});
		expect(res.headers.get("Cache-Control")).toBe("max-age=3600");
	});
});

describe(xml, () => {
	test("sets XML content-type", () => {
		let res = xml("<root><item>Hello</item></root>");
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.XML}; charset=utf-8`);
	});

	test("returns XML body", async () => {
		let res = xml("<root><item>Hello</item></root>");
		let body = await res.text();
		expect(body).toBe("<root><item>Hello</item></root>");
	});

	test("accepts custom status", () => {
		let res = xml("<error>Not found</error>", { status: 404 });
		expect(res.status).toBe(404);
	});
});

describe(csv, () => {
	test("sets a UTF-8 CSV content-type", () => {
		let res = csv("name,age\nJohn,30\nJane,25");
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.CSV}; charset=utf-8`);
	});

	test("returns CSV body", async () => {
		let res = csv("name,age\nJohn,30\nJane,25");
		let body = await res.text();
		expect(body).toBe("name,age\nJohn,30\nJane,25");
	});

	test("streams a body as it is written", async () => {
		let encoder = new TextEncoder();
		let body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode("name,city\r\n"));
				controller.enqueue(encoder.encode("Ada,Zürich\r\n"));
				controller.close();
			},
		});
		let res = csv(body);
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.CSV}; charset=utf-8`);
		expect(await res.text()).toBe("name,city\r\nAda,Zürich\r\n");
	});

	test("accepts custom headers", () => {
		let res = csv("id,value\n1,100", {
			headers: { "Content-Disposition": attachment("data.csv") },
		});
		expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="data.csv"');
	});
});

describe(attachment, () => {
	test("writes a plain ASCII name with no filename*", () => {
		expect(attachment("report-2026-08.csv")).toBe('attachment; filename="report-2026-08.csv"');
	});

	test("keeps spaces and punctuation in a plain name", () => {
		expect(attachment("Q3 report (final) #2.csv")).toBe(
			'attachment; filename="Q3 report (final) #2.csv"',
		);
	});

	test("escapes quotes in the fallback", () => {
		expect(attachment('say "hi".csv')).toBe('attachment; filename="say \\"hi\\".csv"');
	});

	test("escapes backslashes in the fallback", () => {
		expect(attachment("a\\b.csv")).toBe('attachment; filename="a\\\\b.csv"');
	});

	test("adds filename* for a Latin name with accents", () => {
		expect(attachment("Café report.csv")).toBe(
			"attachment; filename=\"Caf_ report.csv\"; filename*=UTF-8''Caf%C3%A9%20report.csv",
		);
	});

	test("adds filename* for a CJK name", () => {
		expect(attachment("報告.csv")).toBe(
			"attachment; filename=\"__.csv\"; filename*=UTF-8''%E5%A0%B1%E5%91%8A.csv",
		);
	});

	test("replaces an astral character with one fallback character", () => {
		expect(attachment("📈.csv")).toBe(
			"attachment; filename=\"_.csv\"; filename*=UTF-8''%F0%9F%93%88.csv",
		);
	});

	test("percent-encodes characters outside RFC 8187 attr-char", () => {
		expect(attachment("résumé (it's *mine*).csv")).toBe(
			'attachment; filename="r_sum_ (it\'s *mine*).csv"; ' +
				"filename*=UTF-8''r%C3%A9sum%C3%A9%20%28it%27s%20%2Amine%2A%29.csv",
		);
	});

	test("keeps RFC 8187 attr-char punctuation literal", () => {
		expect(attachment("ü!#$&+-.^_`|~.csv")).toBe(
			"attachment; filename=\"_!#$&+-.^_`|~.csv\"; filename*=UTF-8''%C3%BC!#$&+-.^_`|~.csv",
		);
	});

	test("replaces control characters so the value is a valid header", () => {
		let value = attachment("line\nbreak.csv");
		expect(value).toBe(
			"attachment; filename=\"line_break.csv\"; filename*=UTF-8''line%0Abreak.csv",
		);
		expect(() => new Headers({ "Content-Disposition": value })).not.toThrow();
	});

	test("encodes a lone surrogate as the replacement character", () => {
		expect(attachment("a\uD800.csv")).toBe(
			"attachment; filename=\"a_.csv\"; filename*=UTF-8''a%EF%BF%BD.csv",
		);
	});
});

describe(markdown, () => {
	test("sets Markdown content-type", () => {
		let res = markdown("# Hello World");
		expect(res.headers.get("Content-Type")).toBe(`${ContentType.Markdown}; charset=utf-8`);
	});

	test("returns Markdown body", async () => {
		let res = markdown("# Hello World\n\nThis is **bold** text.");
		let body = await res.text();
		expect(body).toBe("# Hello World\n\nThis is **bold** text.");
	});

	test("accepts custom status", () => {
		let res = markdown("# Error\n\nPage not found.", { status: 404 });
		expect(res.status).toBe(404);
	});
});

describe(pdf, () => {
	test("sets PDF content-type", () => {
		let pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
		let res = pdf(pdfBlob);
		expect(res.headers.get("Content-Type")).toBe(ContentType.PDF);
	});

	test("works with Blob", async () => {
		let pdfContent = "%PDF-1.4 test content";
		let pdfBlob = new Blob([pdfContent], { type: "application/pdf" });
		let res = pdf(pdfBlob);
		let body = await res.text();
		expect(body).toBe(pdfContent);
	});

	test("works with ArrayBuffer", async () => {
		let encoder = new TextEncoder();
		let buffer = encoder.encode("%PDF-1.4").buffer;
		let res = pdf(buffer as ArrayBuffer);
		expect(res.headers.get("Content-Type")).toBe(ContentType.PDF);
	});

	test("accepts custom headers", () => {
		let pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
		let res = pdf(pdfBlob, {
			headers: { "Content-Disposition": "inline; filename=document.pdf" },
		});
		expect(res.headers.get("Content-Disposition")).toBe("inline; filename=document.pdf");
	});
});

describe(file, () => {
	test("sets Content-Disposition header with filename", () => {
		let fileBlob = new Blob(["file content"]);
		let res = file(fileBlob, "archive.zip");
		expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="archive.zip"');
	});

	test("writes a non-ASCII filename through attachment", () => {
		let res = file(new Blob(["file content"]), 'Café "final".csv');
		expect(res.headers.get("Content-Disposition")).toBe(attachment('Café "final".csv'));
		expect(res.headers.get("Content-Disposition")).toBe(
			'attachment; filename="Caf_ \\"final\\".csv"; filename*=UTF-8\'\'Caf%C3%A9%20%22final%22.csv',
		);
	});

	test("sets octet-stream content-type", () => {
		let fileBlob = new Blob(["file content"]);
		let res = file(fileBlob, "data.bin");
		expect(res.headers.get("Content-Type")).toBe(ContentType.OctetStream);
	});

	test("returns file body", async () => {
		let content = "file content";
		let fileBlob = new Blob([content]);
		let res = file(fileBlob, "test.txt");
		let body = await res.text();
		expect(body).toBe(content);
	});

	test("accepts custom headers", () => {
		let fileBlob = new Blob(["file content"]);
		let res = file(fileBlob, "photo.png", {
			headers: { "Cache-Control": "no-store" },
		});
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});
});

describe(stream, () => {
	test("sets event-stream content-type", () => {
		let readable = new ReadableStream();
		let res = stream(readable);
		expect(res.headers.get("Content-Type")).toBe(ContentType.EventStream);
	});

	test("sets no-cache header", () => {
		let readable = new ReadableStream();
		let res = stream(readable);
		expect(res.headers.get("Cache-Control")).toBe("no-cache");
	});

	test("sets keep-alive connection header", () => {
		let readable = new ReadableStream();
		let res = stream(readable);
		expect(res.headers.get("Connection")).toBe("keep-alive");
	});

	test("accepts custom headers", () => {
		let readable = new ReadableStream();
		let res = stream(readable, {
			headers: { "X-Custom-Header": "value" },
		});
		expect(res.headers.get("X-Custom-Header")).toBe("value");
	});
});

describe(noContent, () => {
	test("returns 204 status", () => {
		let res = noContent();
		expect(res.status).toBe(204);
	});

	test("has empty body", async () => {
		let res = noContent();
		let body = await res.text();
		expect(body).toBe("");
	});

	test("accepts custom headers", () => {
		let res = noContent({ headers: { "X-Request-Id": "abc123" } });
		expect(res.headers.get("X-Request-Id")).toBe("abc123");
	});
});

describe(redirect, () => {
	test("defaults to 307 status", () => {
		let res = redirect("/login");
		expect(res.status).toBe(307);
	});

	test("sets Location header", () => {
		let res = redirect("/login");
		expect(res.headers.get("Location")).toBe("/login");
	});

	test("works with URL object", () => {
		let res = redirect(new URL("https://example.com/path"));
		expect(res.headers.get("Location")).toBe("https://example.com/path");
	});

	test("works with Location object", () => {
		let location = new Location({ pathname: "/search", search: "q=test" });
		let res = redirect(location);
		expect(res.headers.get("Location")).toBe("/search?q=test");
	});

	test("accepts custom status", () => {
		let res = redirect("/path", { status: redirect.Status.Permanent });
		expect(res.status).toBe(308);
	});

	test("accepts SeeOther status", () => {
		let res = redirect("/path", { status: redirect.Status.SeeOther });
		expect(res.status).toBe(303);
	});

	test("throws for invalid target", () => {
		// @ts-expect-error Testing runtime behavior
		expect(() => redirect(123)).toThrow("Invalid redirect target");
	});

	test("accepts custom headers", () => {
		let res = redirect("/path", {
			headers: { "X-Redirect-Reason": "auth" },
		});
		expect(res.headers.get("X-Redirect-Reason")).toBe("auth");
	});
});
