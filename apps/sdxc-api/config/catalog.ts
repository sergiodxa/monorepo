/**
 * The priced operations this Worker sells: id, human description, USDC atomic
 * amount and which `@sdxc/*` package backs them. The HTTP catalog and MCP tools
 * both read from here so a new operation is one row plus a runner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One sellable operation. */
export interface Operation {
	/** Stable id used in `/v1/*id` and as the MCP tool name. */
	id: string;
	/** Title shown in catalogs. */
	title: string;
	/** What the caller buys. */
	description: string;
	/** npm package that implements the work. */
	package: string;
	/**
	 * Price in USDC atomic units (6 decimals). `"1000"` is $0.001.
	 */
	amount: string;
	/** Dollar label for humans reading the catalog. */
	priceUsd: string;
	/** Example JSON body stamped on Bazaar discovery. */
	exampleInput: Record<string, unknown>;
	/** Example success payload stamped on Bazaar discovery. */
	exampleOutput: unknown;
}

/**
 * Every operation the Worker currently sells, in catalog order.
 */
export const OPERATIONS: readonly Operation[] = [
	{
		id: "qr.encode",
		title: "Encode QR",
		description: "Encode text as a QR Code Model 2 symbol and return its SVG path.",
		package: "@sdxc/qr",
		amount: "1000",
		priceUsd: "$0.001",
		exampleInput: { text: "https://sdxc.dev" },
		exampleOutput: { svgPath: "M0 0h1v1H0z", size: 21, viewBox: "0 0 21 21" },
	},
	{
		id: "highlight",
		title: "Highlight source",
		description: "Tokenize source text for a named language with @sdxc/highlight.",
		package: "@sdxc/highlight",
		amount: "2000",
		priceUsd: "$0.002",
		exampleInput: { source: "const x = 1;", language: "typescript" },
		exampleOutput: { language: "typescript", tokens: [] },
	},
	{
		id: "markdown.plain",
		title: "Markdown to plain text",
		description: "Parse Markdown and return plain text suitable for excerpts and search.",
		package: "@sdxc/markdown",
		amount: "1000",
		priceUsd: "$0.001",
		exampleInput: { markdown: "# Hello" },
		exampleOutput: { text: "Hello" },
	},
	{
		id: "semver.satisfies",
		title: "SemVer satisfies",
		description:
			"Ask whether one SemVer stands in a named relation to another (= != < <= > >= ~ ^).",
		package: "@sdxc/semver",
		amount: "500",
		priceUsd: "$0.0005",
		exampleInput: { version: "1.2.3", comparison: "^", against: "1.0.0" },
		exampleOutput: { satisfies: true },
	},
	{
		id: "zone-file.parse",
		title: "Parse zone file",
		description: "Parse an RFC 1035 master file into typed DNS records (requires an origin).",
		package: "@sdxc/zone-file",
		amount: "2000",
		priceUsd: "$0.002",
		exampleInput: { zone: "www 300 IN A 192.0.2.1\n", origin: "example.com" },
		exampleOutput: { records: [] },
	},
	{
		id: "json-patch.apply",
		title: "Apply JSON Patch",
		description: "Apply an RFC 6902 JSON Patch document to a JSON value.",
		package: "@sdxc/json-patch",
		amount: "1000",
		priceUsd: "$0.001",
		exampleInput: {
			document: { tags: ["a"] },
			patch: [{ op: "add", path: "/tags/-", value: "b" }],
		},
		exampleOutput: { document: { tags: ["a", "b"] } },
	},
	{
		id: "json-patch.diff",
		title: "Diff JSON",
		description: "Generate an RFC 6902 JSON Patch that transforms one JSON value into another.",
		package: "@sdxc/json-patch",
		amount: "1000",
		priceUsd: "$0.001",
		exampleInput: { before: { a: 1 }, after: { a: 2 } },
		exampleOutput: { patch: [{ op: "replace", path: "/a", value: 2 }] },
	},
	{
		id: "pdf.build",
		title: "Build PDF",
		description:
			"Build a one-page PDF from title, body text and a client-supplied TrueType font (base64, ≤ 500 KiB).",
		package: "@sdxc/pdf",
		amount: "5000",
		priceUsd: "$0.005",
		exampleInput: {
			title: "Note",
			text: "Hello from api.sdxc.dev",
			fontBase64: "<base64 .ttf ≤ 500KiB>",
		},
		exampleOutput: { mediaType: "application/pdf", encoding: "base64", bytes: "JVBERi0…" },
	},
	{
		id: "epub.build",
		title: "Build EPUB",
		description:
			"Build an EPUB 3.3 publication from metadata and XHTML chapters; returns the container as base64.",
		package: "@sdxc/epub",
		amount: "5000",
		priceUsd: "$0.005",
		exampleInput: {
			metadata: {
				identifier: "urn:uuid:5f1c2a86-3b1e-4f0c-9d55-0a4e7b1c2d3e",
				title: "A Short Book",
				language: "en",
			},
			chapters: [{ id: "one", title: "Chapter One", body: "<h1>Chapter One</h1><p>Hello.</p>" }],
		},
		exampleOutput: {
			mediaType: "application/epub+zip",
			encoding: "base64",
			bytes: "UEsDB…",
		},
	},
	{
		id: "feed.normalize",
		title: "Normalize feed",
		description:
			"Parse feed text or fetch a feed URL (≤ 1 MiB body, public hosts) into the normalized @sdxc/feed shape.",
		package: "@sdxc/feed",
		amount: "3000",
		priceUsd: "$0.003",
		exampleInput: {
			source:
				'<?xml version="1.0"?><rss version="2.0"><channel><title>Example</title><link>https://example.com/</link><description>Demo</description></channel></rss>',
		},
		exampleOutput: { format: "rss", title: "Example", items: [] },
	},
] as const;

/** Operation ids as a union of string literals. */
export type OperationId = (typeof OPERATIONS)[number]["id"];

/**
 * Looks up an operation by id.
 *
 * @param id - Catalog id
 * @returns The operation, or `undefined` when unknown
 */
export function findOperation(id: string): Operation | undefined {
	return OPERATIONS.find((operation) => operation.id === id);
}
