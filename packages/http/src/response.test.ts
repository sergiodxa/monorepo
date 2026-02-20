import { describe, expect, test } from "bun:test";

import { Location } from "@pkg/location";

import * as ContentType from "./content-type";
import {
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
} from "./response";

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
		expect(res.headers.get("Content-Type")).toBe(ContentType.Text);
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
		expect(res.headers.get("Content-Type")).toBe(ContentType.HTML);
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
		expect(res.headers.get("Content-Type")).toBe(ContentType.CSS);
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
		expect(res.headers.get("Content-Type")).toBe(ContentType.JavaScript);
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
		expect(res.headers.get("Content-Type")).toBe(ContentType.XML);
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
	test("sets CSV content-type", () => {
		let res = csv("name,age\nJohn,30\nJane,25");
		expect(res.headers.get("Content-Type")).toBe(ContentType.CSV);
	});

	test("returns CSV body", async () => {
		let res = csv("name,age\nJohn,30\nJane,25");
		let body = await res.text();
		expect(body).toBe("name,age\nJohn,30\nJane,25");
	});

	test("accepts custom headers", () => {
		let res = csv("id,value\n1,100", {
			headers: { "Content-Disposition": "attachment; filename=data.csv" },
		});
		expect(res.headers.get("Content-Disposition")).toBe("attachment; filename=data.csv");
	});
});

describe(markdown, () => {
	test("sets Markdown content-type", () => {
		let res = markdown("# Hello World");
		expect(res.headers.get("Content-Type")).toBe(ContentType.Markdown);
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
