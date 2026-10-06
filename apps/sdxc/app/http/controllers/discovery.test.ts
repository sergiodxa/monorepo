/**
 * Tests for the surfaces nothing on the site links to as a page: the markdown twins, the
 * map at `/llms.txt`, the index the palette fetches, the sitemap, the feed and the MCP
 * endpoint. Nobody reads these by eye, so a content type that drifted or a route that
 * stopped answering would go unnoticed until an agent or a crawler hit it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { describe, expect, test } from "vitest";

import { fetchApp, ORIGIN } from "~/app/lib/test/router";
import { listGuides } from "~/app/services/docs";
import { listPackages, readPackageReadme } from "~/app/services/packages";
import { listUiPages } from "~/app/services/ui-pages";

/**
 * Posts one JSON-RPC message through the real router and reads the result back. A call
 * and a read also mirror what they address in a header, which the protocol has the server
 * check against the body.
 */
async function callMcp(method: string, params: Record<string, unknown> = {}) {
	let addressed = params.name ?? params.uri;

	let response = await fetchApp("/mcp", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json",
			"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
			"Mcp-Method": method,
			...(typeof addressed === "string" ? { "Mcp-Name": addressed } : {}),
		},
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

	return { response, body: (await response.json()) as Record<string, any> };
}

describe("GET /docs/*slug.md", () => {
	test("serves the guide's own source rather than its rendered page", async () => {
		let response = await fetchApp("/docs/releases/versioning.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body.startsWith("---")).toBe(true);
		expect(body).toContain("title: Versioning");
	});

	test("answers 404 for a slug no file owns", async () => {
		expect((await fetchApp("/docs/nothing/here.md")).status).toBe(404);
	});
});

describe("GET /api/:name.md", () => {
	test("serves the README, the same file npm and GitHub show", async () => {
		let response = await fetchApp("/api/result.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toBe(await readPackageReadme("result"));
	});

	test("every published package has one", async () => {
		for (let entry of listPackages()) {
			let response = await fetchApp(`/api/${entry.directory}.md`);
			expect(response.status, entry.directory).toBe(200);
		}
	});

	test("answers 404 for a directory that publishes nothing", async () => {
		expect((await fetchApp("/api/blog-engine.md")).status).toBe(404);
	});
});

describe("GET /api/ui/:component.md and /api/ui/:subpath/:slug.md", () => {
	test("serves a component's reference as markdown", async () => {
		let response = await fetchApp("/api/ui/badge.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body.startsWith("# Badge\n")).toBe(true);
		expect(body).toContain("## Props");
	});

	test("serves the theme contract, and an export with what it is used with", async () => {
		let theming = await (await fetchApp("/api/ui/theming.md")).text();
		let copy = await (await fetchApp("/api/ui/mixins/copy-to-clipboard.md")).text();

		expect(theming).toContain("--ui-brand-bg-solid");
		expect(copy).toContain('from "@sdxc/ui/mixins"');
		expect(copy).toContain("### CopyEvent");
	});

	test("every @sdxc/ui reference page has one", async () => {
		for (let page of await listUiPages()) {
			let response = await fetchApp(page.markdownHref);
			expect(response.status, page.markdownHref).toBe(200);
		}
	});

	test("answers 404 for a page the catalogue does not publish", async () => {
		expect((await fetchApp("/api/ui/not-a-component.md")).status).toBe(404);
		expect((await fetchApp("/api/ui/widgets/hotkey.md")).status).toBe(404);
		expect((await fetchApp("/api/ui/mixins/not-a-mixin.md")).status).toBe(404);
	});
});

describe("GET /llms.txt", () => {
	test("links every guide and every package by its markdown address", async () => {
		let response = await fetchApp("/llms.txt");
		let body = await response.text();

		expect(response.headers.get("content-type")).toContain("text/plain");

		for (let entry of listPackages()) {
			expect(body).toContain(`https://sdxc.sergiodxa.com/api/${entry.directory}.md`);
		}

		for (let section of await listGuides()) {
			for (let guide of section.guides) {
				expect(body).toContain(`https://sdxc.sergiodxa.com/docs/${guide.slug}.md`);
			}
		}
	});

	test("links every @sdxc/ui reference page under the band it is listed in", async () => {
		let body = await (await fetchApp("/llms.txt")).text();

		for (let page of await listUiPages()) {
			expect(body).toContain(`https://sdxc.sergiodxa.com${page.markdownHref}`);
		}

		expect(body).toContain("## @sdxc/ui — Components");
		expect(body).toContain("## @sdxc/ui — Mixins");
	});

	test("closes on the author: blog, X and GitHub Sponsors", async () => {
		let body = await (await fetchApp("/llms.txt")).text();
		let author = body.slice(body.indexOf("## Author"));

		expect(author).toContain("Sergio Xalambrí");
		expect(author).toContain("https://sergiodxa.com");
		expect(author).toContain("https://x.com/sergiodxa");
		expect(author).toContain("https://github.com/sponsors/sergiodxa");
	});
});

describe("GET /search.json", () => {
	test("carries one entry per page, plus the headings inside them", async () => {
		let response = await fetchApp("/search.json");
		let body = (await response.json()) as { documents: Array<{ href: string }> };

		expect(response.headers.get("content-type")).toContain("application/json");
		expect(body.documents.length).toBeGreaterThan(listPackages().length);
		expect(body.documents.some((entry) => entry.href.includes("#"))).toBe(true);
	});

	test("carries the @sdxc/ui packages and every reference page of its catalogue", async () => {
		let body = (await (await fetchApp("/search.json")).json()) as {
			documents: Array<{ href: string }>;
		};
		let hrefs = new Set(body.documents.map((entry) => entry.href));

		expect(hrefs).toContain("/api/ui");
		for (let page of await listUiPages()) expect(hrefs).toContain(page.href);
		expect([...hrefs].some((href) => href.startsWith("/api/ui#"))).toBe(false);
	});
});

describe("GET /sitemap.xml", () => {
	test("lists every page on the site's own origin, whichever host answered", async () => {
		let response = await fetchApp("/sitemap.xml");
		let body = await response.text();

		expect(response.headers.get("content-type")).toContain("xml");
		expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(body).toContain("<urlset");
		expect(body).not.toContain(ORIGIN);

		for (let entry of listPackages()) {
			expect(body).toContain(`https://sdxc.sergiodxa.com/api/${entry.directory}`);
		}

		for (let page of await listUiPages()) {
			expect(body).toContain(`https://sdxc.sergiodxa.com${page.href}<`);
		}
	});
});

describe("GET /rss.xml", () => {
	test("carries the dated guides, newest first", async () => {
		let response = await fetchApp("/rss.xml");
		let body = await response.text();

		expect(response.headers.get("content-type")).toContain("xml");
		expect(body).toContain("<rss");
		expect(body).toContain("<channel>");
		expect(body).toContain("https://sdxc.sergiodxa.com/docs/releases/versioning");
	});
});

describe("POST /mcp", () => {
	test("names the author and the sponsor link in the server's instructions", async () => {
		let { body } = await callMcp("server/discover");

		expect(body.result.instructions).toContain("Sergio Xalambrí");
		expect(body.result.instructions).toContain("https://github.com/sponsors/sergiodxa");
	});

	test("lists the four search and enumeration tools, all read-only", async () => {
		let { response, body } = await callMcp("tools/list");

		expect(response.status).toBe(200);

		let tools = body.result.tools as Array<{
			name: string;
			annotations?: { readOnlyHint?: boolean };
		}>;

		expect(tools.map((entry) => entry.name).sort()).toEqual([
			"get_package",
			"list_packages",
			"search_docs",
			"search_packages",
		]);

		for (let entry of tools) expect(entry.annotations?.readOnlyHint, entry.name).toBe(true);
	});

	test("search_packages answers with pages a client can fetch", async () => {
		let { body } = await callMcp("tools/call", {
			name: "search_packages",
			arguments: { query: "markdown" },
		});

		expect(body.result.isError).not.toBe(true);
		expect(JSON.stringify(body.result)).toContain("https://sdxc.sergiodxa.com/api/markdown.md");
	});

	test("get_package reads one in full, scope written or not", async () => {
		let { body } = await callMcp("tools/call", {
			name: "get_package",
			arguments: { name: "@sdxc/result" },
		});

		expect(JSON.stringify(body.result)).toContain("npm add @sdxc/result");
	});

	test("a name nothing publishes comes back as guidance the model can act on", async () => {
		let { body } = await callMcp("tools/call", {
			name: "get_package",
			arguments: { name: "nothing-here" },
		});

		expect(body.result.isError).toBe(true);
		expect(JSON.stringify(body.result)).toContain("search_packages");
	});

	test("every package and every guide appears in the resource picker", async () => {
		let { body } = await callMcp("resources/list");

		let uris = new Set((body.result.resources as Array<{ uri: string }>).map((entry) => entry.uri));

		for (let entry of listPackages()) {
			expect(uris).toContain(`https://sdxc.sergiodxa.com/api/${entry.directory}.md`);
		}

		for (let section of await listGuides()) {
			for (let guide of section.guides) {
				expect(uris).toContain(`https://sdxc.sergiodxa.com/docs/${guide.slug}.md`);
			}
		}
	});

	test("every @sdxc/ui reference page appears in the resource picker", async () => {
		let { body } = await callMcp("resources/list");

		let uris = new Set((body.result.resources as Array<{ uri: string }>).map((entry) => entry.uri));

		for (let page of await listUiPages()) {
			expect(uris).toContain(`https://sdxc.sergiodxa.com${page.markdownHref}`);
		}
	});

	test("reading an @sdxc/ui resource gives the same text its URL serves", async () => {
		for (let path of ["/api/ui/badge.md", "/api/ui/behaviors/toaster.md"]) {
			let { body } = await callMcp("resources/read", { uri: `https://sdxc.sergiodxa.com${path}` });
			let contents = body.result.contents as Array<{ text: string }>;

			expect(contents.at(0)?.text, path).toBe(await (await fetchApp(path)).text());
		}
	});

	test("search_docs finds a component and a mixin by name", async () => {
		let { body } = await callMcp("tools/call", {
			name: "search_docs",
			arguments: { query: "hotkey" },
		});

		expect(JSON.stringify(body.result)).toContain(
			"https://sdxc.sergiodxa.com/api/ui/mixins/hotkey",
		);
	});

	test("reading a resource gives the same text its URL serves", async () => {
		let { body } = await callMcp("resources/read", {
			uri: "https://sdxc.sergiodxa.com/api/result.md",
		});

		let contents = body.result.contents as Array<{ text: string }>;

		expect(contents.at(0)?.text).toBe(await readPackageReadme("result"));
	});
});

describe("GET /mcp", () => {
	test("renders the page a person reaches by opening the endpoint's URL", async () => {
		let response = await fetchApp("/mcp");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(body).toContain("search_packages");
	});
});

describe("SEO metadata", () => {
	test("names one origin whichever host served the request", async () => {
		let body = await (await fetchApp("/api/result")).text();

		expect(body).toContain('<link rel="canonical" href="https://sdxc.sergiodxa.com/api/result"');
		expect(body).toContain('property="og:title"');
		expect(body).toContain('property="og:site_name"');
	});
});
