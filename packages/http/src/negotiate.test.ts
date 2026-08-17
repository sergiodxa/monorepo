import { describe, expect, test } from "bun:test";

import { accepts, respond, AcceptList } from "./negotiate";

function createRequest(accept?: string): Request {
	let headers = new Headers();
	if (accept) headers.set("Accept", accept);
	return new Request("https://example.com", { headers });
}

describe(accepts, () => {
	test("returns AcceptList instance", () => {
		let request = createRequest("application/json");
		let result = accepts(request);
		expect(result).toBeInstanceOf(AcceptList);
	});

	test("defaults to */* when no Accept header", () => {
		let request = createRequest();
		let result = accepts(request);
		expect(result.includes("json")).toBe(true);
		expect(result.includes("html")).toBe(true);
	});

	test("parses simple Accept header", () => {
		let request = createRequest("application/json");
		let result = accepts(request);
		expect(result.all()).toEqual(["application/json"]);
	});

	test("handles multiple types with quality values", () => {
		let request = createRequest("text/html, application/json;q=0.9, text/plain;q=0.8");
		let result = accepts(request);
		let types = result.all();
		expect(types).toBeArrayOfSize(3);
		expect(types).toEqual(["text/html", "application/json", "text/plain"]);
	});
});

describe(AcceptList, () => {
	describe(AcceptList.prototype.includes.name, () => {
		test("matches exact MIME type", () => {
			let list = new AcceptList("application/json");
			expect(list.includes("application/json")).toBe(true);
		});

		test("matches shorthand json", () => {
			let list = new AcceptList("application/json");
			expect(list.includes("json")).toBe(true);
		});

		test("matches shorthand html", () => {
			let list = new AcceptList("text/html");
			expect(list.includes("html")).toBe(true);
		});

		test("matches shorthand xml", () => {
			let list = new AcceptList("application/xml");
			expect(list.includes("xml")).toBe(true);
		});

		test("matches shorthand text", () => {
			let list = new AcceptList("text/plain");
			expect(list.includes("text")).toBe(true);
		});

		test("matches shorthand markdown", () => {
			let list = new AcceptList("text/markdown");
			expect(list.includes("markdown")).toBe(true);
		});

		test("returns false for non-matching type", () => {
			let list = new AcceptList("application/json");
			expect(list.includes("html")).toBe(false);
		});

		test("returns true for */* wildcard", () => {
			let list = new AcceptList("*/*");
			expect(list.includes("json")).toBe(true);
			expect(list.includes("html")).toBe(true);
		});
	});

	describe(AcceptList.prototype.all.name, () => {
		test("returns types in preference order", () => {
			let list = new AcceptList("text/html, application/json;q=0.9");
			let types = list.all();
			expect(types[0]).toBe("text/html");
			expect(types[1]).toBe("application/json");
		});

		test("sorts by quality value", () => {
			let list = new AcceptList("application/json;q=0.5, text/html;q=0.9");
			let types = list.all();
			expect(types[0]).toBe("text/html");
			expect(types[1]).toBe("application/json");
		});

		test("parses quality values correctly", () => {
			let list = new AcceptList("text/plain;q=0.1, application/json;q=0.8, text/html;q=1.0");
			let types = list.all();
			expect(types[0]).toBe("text/html");
			expect(types[1]).toBe("application/json");
			expect(types[2]).toBe("text/plain");
		});
	});

	describe(AcceptList.prototype.preferred.name, () => {
		test("returns first matching type", () => {
			let list = new AcceptList("text/html, application/json");
			let preferred = list.preferred("application/json", "text/html");
			expect(preferred).toBe("text/html");
		});

		test("returns null when no match", () => {
			let list = new AcceptList("application/json");
			let preferred = list.preferred("text/html", "text/plain");
			expect(preferred).toBeNull();
		});

		test("handles */* wildcard", () => {
			let list = new AcceptList("*/*");
			let preferred = list.preferred("application/json", "text/html");
			expect(preferred).toBe("application/json");
		});
	});

	describe(AcceptList.prototype.toShortType.name, () => {
		test("converts application/json to json", () => {
			let list = new AcceptList("*/*");
			expect(list.toShortType("application/json")).toBe("json");
		});

		test("converts text/html to html", () => {
			let list = new AcceptList("*/*");
			expect(list.toShortType("text/html")).toBe("html");
		});

		test("converts text/xml to xml", () => {
			let list = new AcceptList("*/*");
			expect(list.toShortType("text/xml")).toBe("xml");
		});

		test("converts application/xml to xml", () => {
			let list = new AcceptList("*/*");
			expect(list.toShortType("application/xml")).toBe("xml");
		});

		test("returns null for unknown MIME type", () => {
			let list = new AcceptList("*/*");
			expect(list.toShortType("application/octet-stream")).toBeNull();
		});
	});
});

describe(respond, () => {
	test("calls correct handler based on Accept header", async () => {
		let request = createRequest("application/json");
		let res = respond(request, {
			json: () => new Response("json"),
			html: () => new Response("html"),
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("json");
	});

	test("returns 406 when no handler matches and no default", async () => {
		let request = createRequest("application/json");
		let res = respond(request, {
			html: () => new Response("html"),
		});
		expect(res.status).toBe(406);
		expect(res.statusText).toBe("Not Acceptable");
		expect(await res.text()).toBe("Not Acceptable");
	});

	test("calls default handler when no handler matches", async () => {
		let request = createRequest("application/json");
		let res = respond(request, {
			html: () => new Response("html"),
			default: () => new Response("default"),
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("default");
	});

	test("respects quality value ordering", async () => {
		let request = createRequest("text/html;q=0.5, application/json;q=0.9");
		let res = respond(request, {
			json: () => new Response("json"),
			html: () => new Response("html"),
		});
		expect(await res.text()).toBe("json");
	});
});
