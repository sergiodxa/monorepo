/**
 * Tests for resource declaration and serving.
 *
 * The declaration cases cover the RFC 6570 conversion, which is where a mistake would
 * otherwise surface as a template a client expands into a URI this server never matches.
 * The serving cases go through real requests, and the last group checks the two things
 * resources do differently from tools: which list a declaration lands in, and the fact that
 * a read has no way to say anything to the model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RequestContext } from "remix/router";
import { describe, expect, expectTypeOf, test, vi } from "vitest";

import { createHandler } from "./handler";
import { ErrorCode } from "./jsonrpc";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "./protocol";
import { createResource, resource, resources } from "./resources";

const ARTICLE = "https://sergiodxa.com/articles/:slug.md";

let resourceset = resources({
	article: resource(ARTICLE, {
		name: "Article",
		title: "Blog article",
		description: "A published article, as Markdown.",
		mimeType: "text/markdown",
	}),
	about: resource("https://sergiodxa.com/about.md", {
		name: "About",
		mimeType: "text/markdown",
	}),
});

/** Every field these tests read off a response body. */
interface Body {
	result?: {
		resources?: Array<{ uri: string; name?: string }>;
		resourceTemplates?: Array<{ uriTemplate: string; name: string }>;
		contents?: Array<{ uri?: string; mimeType?: string; text?: string; blob?: string }>;
		capabilities?: Record<string, unknown>;
		cacheScope?: string;
	};
	error?: { code?: number; message?: string; data?: { uri?: string } };
}

/** Builds a POST carrying the headers and `_meta` this revision requires. */
function send(method: string, params: Record<string, unknown> = {}): Request {
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": method,
	};
	if (method === "resources/read" && typeof params.uri === "string") {
		headers["Mcp-Name"] = params.uri;
	}

	return new Request("https://example.com/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params: {
				...params,
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

/** A handler with both resources mapped, with options a case may override. */
function build(overrides: { onError?: () => void; hidden?: boolean } = {}) {
	let mcp = createHandler({ name: "blog", version: "1.0.0", onError: overrides.onError });

	mcp.resources.map(resourceset.article, {
		available: overrides.hidden ? () => false : undefined,
		list: () => [
			{ uri: resourceset.article.href({ slug: "remix-v3" }), name: "Remix v3" },
			{ uri: resourceset.article.href({ slug: "mcp" }), name: "MCP" },
		],
		read: (ctx) => {
			expectTypeOf(ctx.variables.slug).toEqualTypeOf<string>();
			if (ctx.variables.slug === "draft") return null;
			if (ctx.variables.slug === "broken") throw new Error("D1_ERROR: secret_internal_field");
			return `# ${ctx.variables.slug}`;
		},
	});

	mcp.resources.map(resourceset.about, { read: () => "# About" });

	return mcp;
}

/** Sends a request and reads the body. */
async function call(request: Request, mcp = build()) {
	let response = await mcp.fetch(new RequestContext(request));
	return { status: response.status, body: (await response.json()) as Body };
}

describe("resource", () => {
	test("derives the RFC 6570 template published on the wire", () => {
		expect(resourceset.article.descriptor.uriTemplate).toBe(
			"https://sergiodxa.com/articles/{slug}.md",
		);
		expect(resourceset.article.hasVariables).toBe(true);
		expect(resourceset.about.hasVariables).toBe(false);
	});

	test("converts a wildcard to a reserved expansion, which may span slashes", () => {
		let files = resource("https://example.com/files/*path", { name: "Files" });

		expect(files.descriptor.uriTemplate).toBe("https://example.com/files/{+path}");
	});

	test("builds a URI from its variables, typed", () => {
		expect(resourceset.article.href({ slug: "remix-v3" })).toBe(
			"https://sergiodxa.com/articles/remix-v3.md",
		);
	});

	test("refuses an optional group, which RFC 6570 cannot express", () => {
		expect(() => resource("https://example.com/posts/:slug(.html)", { name: "Post" })).toThrow(
			/optional group/,
		);
	});

	test("refuses a search constraint", () => {
		expect(() => resource("https://example.com/posts?draft=1", { name: "Post" })).toThrow(
			/search constraint/,
		);
	});

	test("refuses an unnamed wildcard, which has no name to publish", () => {
		expect(() => resource("https://example.com/files/*", { name: "Files" })).toThrow(
			/unnamed wildcard/,
		);
	});

	test("refuses a repeated capture name", () => {
		expect(() => resource("https://example.com/:id/:id", { name: "Thing" })).toThrow(/twice/);
	});
});

describe("resources", () => {
	test("refuses two resources sharing a name", () => {
		expect(() =>
			resources({
				a: resource("https://example.com/a", { name: "Same" }),
				b: resource("https://example.com/b", { name: "Same" }),
			}),
		).toThrow(/Duplicate resource name/);
	});
});

describe("resources/list", () => {
	test("lists what the enumerator returned", async () => {
		let { body } = await call(send("resources/list"));

		expect(body.result?.resources?.map((each) => each.uri)).toEqual([
			"https://sergiodxa.com/articles/remix-v3.md",
			"https://sergiodxa.com/articles/mcp.md",
			"https://sergiodxa.com/about.md",
		]);
	});

	test("lists a resource with no variables without needing an enumerator", async () => {
		let { body } = await call(send("resources/list"));

		expect(body.result?.resources?.at(-1)?.name).toBe("About");
	});

	test("omits a resource the caller may not use", async () => {
		let { body } = await call(send("resources/list"), build({ hidden: true }));

		expect(body.result?.resources?.map((each) => each.uri)).toEqual([
			"https://sergiodxa.com/about.md",
		]);
	});

	test("marks the list private once any resource is conditional", async () => {
		let { body } = await call(send("resources/list"), build({ hidden: true }));

		expect(body.result?.cacheScope).toBe("private");
	});
});

describe("resources/templates/list", () => {
	test("publishes only the declarations that capture something", async () => {
		let { body } = await call(send("resources/templates/list"));

		expect(body.result?.resourceTemplates).toEqual([
			expect.objectContaining({
				uriTemplate: "https://sergiodxa.com/articles/{slug}.md",
				name: "Article",
			}),
		]);
	});
});

describe("resources/read", () => {
	test("matches a URI to its declaration and reads it", async () => {
		let { body } = await call(
			send("resources/read", { uri: "https://sergiodxa.com/articles/remix-v3.md" }),
		);

		expect(body.result?.contents).toEqual([
			{
				uri: "https://sergiodxa.com/articles/remix-v3.md",
				mimeType: "text/markdown",
				text: "# remix-v3",
			},
		]);
	});

	test("reports a null read as not found, carrying the uri", async () => {
		let { body } = await call(
			send("resources/read", { uri: "https://sergiodxa.com/articles/draft.md" }),
		);

		expect(body.error?.code).toBe(ErrorCode.InvalidParams);
		expect(body.error?.message).toBe("Resource not found");
		expect(body.error?.data?.uri).toBe("https://sergiodxa.com/articles/draft.md");
	});

	test("reports a URI matching no declaration as not found", async () => {
		let { body } = await call(send("resources/read", { uri: "https://example.com/nope" }));

		expect(body.error?.code).toBe(ErrorCode.InvalidParams);
	});

	test("reports a hidden resource as not found, not as forbidden", async () => {
		let { body } = await call(
			send("resources/read", { uri: "https://sergiodxa.com/articles/remix-v3.md" }),
			build({ hidden: true }),
		);

		expect(body.error?.message).toBe("Resource not found");
	});

	/**
	 * A read has no isError channel — MCP gives resources only JSON-RPC errors — so the
	 * error message reaching the client must never leak the real failure.
	 */
	test("hides an unexpected error and reports it to onError instead", async () => {
		let onError = vi.fn();
		let { body } = await call(
			send("resources/read", { uri: "https://sergiodxa.com/articles/broken.md" }),
			build({ onError }),
		);

		expect(body.error?.code).toBe(ErrorCode.InternalError);
		expect(body.error?.message).toBe("Failed to read the resource");
		expect(JSON.stringify(body)).not.toContain("secret_internal_field");
		expect(onError).toHaveBeenCalledWith(expect.any(Error), {
			method: "resources/read",
			uri: "https://sergiodxa.com/articles/broken.md",
		});
	});

	test("refuses a Mcp-Name header that disagrees with the body uri", async () => {
		let request = send("resources/read", { uri: "https://sergiodxa.com/about.md" });
		let tampered = new Request(request, { headers: new Headers(request.headers) });
		tampered.headers.set("Mcp-Name", "https://sergiodxa.com/articles/remix-v3.md");

		let { status, body } = await call(tampered);

		expect(status).toBe(400);
		expect(body.error?.code).toBe(ErrorCode.HeaderMismatch);
	});
});

describe("server/discover", () => {
	test("advertises the resources capability once any is mapped", async () => {
		let { body } = await call(send("server/discover"));

		expect(body.result?.capabilities).toEqual({ resources: {} });
	});

	test("omits it when none is", async () => {
		let mcp = createHandler({ name: "empty", version: "1.0.0" });
		let { body } = await call(send("server/discover"), mcp);

		expect(body.result?.capabilities).toEqual({});
	});
});

describe("createResource", () => {
	test("types a read handler declared in its own file", () => {
		let action = createResource(resourceset.article, {
			read: (ctx) => {
				expectTypeOf(ctx.variables.slug).toEqualTypeOf<string>();
				return `# ${ctx.variables.slug}`;
			},
		});

		expect(typeof action.read).toBe("function");
	});
});
