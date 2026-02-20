import { describe, expect, test } from "bun:test";

import * as ContentType from "./content-type";
import { formData, formURLEncoded, json, text, xml } from "./request";

describe(json, () => {
	test("creates request with JSON content-type", () => {
		let req = json("https://example.com/api", { name: "John" });
		expect(req.headers.get("Content-Type")).toBe(ContentType.JSON);
	});

	test("stringifies body correctly", async () => {
		let req = json("https://example.com/api", { name: "John" });
		let body = await req.json();
		expect(body).toEqual({ name: "John" });
	});

	test("defaults to POST method", () => {
		let req = json("https://example.com/api", { data: "test" });
		expect(req.method).toBe("POST");
	});

	test("allows overriding method to PUT", () => {
		let req = json("https://example.com/api", { data: "test" }, { method: "PUT" });
		expect(req.method).toBe("PUT");
	});

	test("allows overriding method to PATCH", () => {
		let req = json("https://example.com/api", { data: "test" }, { method: "PATCH" });
		expect(req.method).toBe("PATCH");
	});

	test("accepts URL as string", () => {
		let req = json("https://example.com/api", { data: "test" });
		expect(req.url).toBe("https://example.com/api");
	});

	test("accepts URL object", () => {
		let url = new URL("https://example.com/api");
		let req = json(url, { data: "test" });
		expect(req.url).toBe("https://example.com/api");
	});

	test("preserves custom headers", () => {
		let req = json(
			"https://example.com/api",
			{ data: "test" },
			{ headers: { Authorization: "Bearer token" } },
		);
		expect(req.headers.get("Authorization")).toBe("Bearer token");
		expect(req.headers.get("Content-Type")).toBe(ContentType.JSON);
	});
});

describe(text, () => {
	test("creates request with text/plain content-type", () => {
		let req = text("https://example.com/api", "Hello, world!");
		expect(req.headers.get("Content-Type")).toBe(ContentType.Text);
	});

	test("defaults to POST method", () => {
		let req = text("https://example.com/api", "Hello, world!");
		expect(req.method).toBe("POST");
	});

	test("body is plain string", async () => {
		let req = text("https://example.com/api", "Hello, world!");
		let body = await req.text();
		expect(body).toBe("Hello, world!");
	});

	test("allows overriding method", () => {
		let req = text("https://example.com/api", "Hello", { method: "PUT" });
		expect(req.method).toBe("PUT");
	});

	test("accepts URL object", () => {
		let url = new URL("https://example.com/api");
		let req = text(url, "Hello");
		expect(req.url).toBe("https://example.com/api");
	});

	test("preserves custom headers", () => {
		let req = text("https://example.com/api", "Hello", {
			headers: { "X-Custom": "value" },
		});
		expect(req.headers.get("X-Custom")).toBe("value");
		expect(req.headers.get("Content-Type")).toBe(ContentType.Text);
	});
});

describe(xml, () => {
	test("creates request with text/xml content-type", () => {
		let req = xml("https://example.com/api", "<root><item/></root>");
		expect(req.headers.get("Content-Type")).toBe(ContentType.XML);
	});

	test("defaults to POST method", () => {
		let req = xml("https://example.com/api", "<root/>");
		expect(req.method).toBe("POST");
	});

	test("body is XML string", async () => {
		let xmlContent = "<user><name>John</name></user>";
		let req = xml("https://example.com/api", xmlContent);
		let body = await req.text();
		expect(body).toBe(xmlContent);
	});

	test("allows overriding method", () => {
		let req = xml("https://example.com/api", "<root/>", { method: "PUT" });
		expect(req.method).toBe("PUT");
	});

	test("accepts URL object", () => {
		let url = new URL("https://example.com/api");
		let req = xml(url, "<root/>");
		expect(req.url).toBe("https://example.com/api");
	});

	test("preserves custom headers", () => {
		let req = xml("https://example.com/api", "<root/>", {
			headers: { "X-Custom": "value" },
		});
		expect(req.headers.get("X-Custom")).toBe("value");
		expect(req.headers.get("Content-Type")).toBe(ContentType.XML);
	});
});

describe(formData, () => {
	test("does NOT manually set Content-Type header (browser sets it with boundary)", () => {
		let data = new FormData();
		data.append("name", "John");
		let req = formData("https://example.com/api", data);
		let contentType = req.headers.get("Content-Type");
		expect(contentType).toStartWith("multipart/form-data");
		expect(contentType).toContain("boundary=");
	});

	test("defaults to POST method", () => {
		let data = new FormData();
		let req = formData("https://example.com/api", data);
		expect(req.method).toBe("POST");
	});

	test("body is FormData when passed FormData", async () => {
		let data = new FormData();
		data.append("name", "John");
		data.append("age", "30");
		let req = formData("https://example.com/api", data);
		let body = await req.formData();
		expect(body.get("name")).toBe("John");
		expect(body.get("age")).toBe("30");
	});

	test("converts Record to FormData", async () => {
		let req = formData("https://example.com/api", {
			name: "John",
			age: "30",
		});
		let body = await req.formData();
		expect(body.get("name")).toBe("John");
		expect(body.get("age")).toBe("30");
	});

	test("accepts Blob values in Record", async () => {
		let blob = new Blob(["file content"], { type: "text/plain" });
		let req = formData("https://example.com/api", {
			name: "document",
			file: blob,
		});
		let body = await req.formData();
		expect(body.get("name")).toBe("document");
		let file = body.get("file") as Blob;
		expect(file).toBeInstanceOf(Blob);
		expect(await file.text()).toBe("file content");
	});

	test("allows overriding method", () => {
		let data = new FormData();
		let req = formData("https://example.com/api", data, { method: "PUT" });
		expect(req.method).toBe("PUT");
	});

	test("accepts URL object", () => {
		let url = new URL("https://example.com/api");
		let data = new FormData();
		let req = formData(url, data);
		expect(req.url).toBe("https://example.com/api");
	});

	test("preserves custom headers", () => {
		let data = new FormData();
		let req = formData("https://example.com/api", data, {
			headers: { Authorization: "Bearer token" },
		});
		expect(req.headers.get("Authorization")).toBe("Bearer token");
	});
});

describe(formURLEncoded, () => {
	test("creates request with application/x-www-form-urlencoded content-type", () => {
		let req = formURLEncoded("https://example.com/api", { name: "John" });
		expect(req.headers.get("Content-Type")).toBe(ContentType.FormURLEncoded);
	});

	test("defaults to POST method", () => {
		let req = formURLEncoded("https://example.com/api", { name: "John" });
		expect(req.method).toBe("POST");
	});

	test("works with URLSearchParams", async () => {
		let params = new URLSearchParams();
		params.set("username", "john");
		params.set("password", "secret");
		let req = formURLEncoded("https://example.com/api", params);
		let body = await req.text();
		expect(body).toBe("username=john&password=secret");
	});

	test("works with Record<string, string>", async () => {
		let req = formURLEncoded("https://example.com/api", {
			username: "john",
			password: "secret",
		});
		let body = await req.text();
		expect(body).toContain("username=john");
		expect(body).toContain("password=secret");
	});

	test("converts Record to URLSearchParams string", async () => {
		let req = formURLEncoded("https://example.com/api", {
			key: "value",
		});
		let body = await req.text();
		expect(body).toBe("key=value");
	});

	test("allows overriding method", () => {
		let req = formURLEncoded("https://example.com/api", { data: "test" }, { method: "PUT" });
		expect(req.method).toBe("PUT");
	});

	test("accepts URL object", () => {
		let url = new URL("https://example.com/api");
		let req = formURLEncoded(url, { data: "test" });
		expect(req.url).toBe("https://example.com/api");
	});

	test("preserves custom headers", () => {
		let req = formURLEncoded(
			"https://example.com/api",
			{ data: "test" },
			{ headers: { Authorization: "Bearer token" } },
		);
		expect(req.headers.get("Authorization")).toBe("Bearer token");
		expect(req.headers.get("Content-Type")).toBe(ContentType.FormURLEncoded);
	});
});
