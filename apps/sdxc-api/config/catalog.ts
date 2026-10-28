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
	},
	{
		id: "highlight",
		title: "Highlight source",
		description: "Tokenize source text for a named language with @sdxc/highlight.",
		package: "@sdxc/highlight",
		amount: "2000",
		priceUsd: "$0.002",
	},
	{
		id: "markdown.plain",
		title: "Markdown to plain text",
		description: "Parse Markdown and return plain text suitable for excerpts and search.",
		package: "@sdxc/markdown",
		amount: "1000",
		priceUsd: "$0.001",
	},
	{
		id: "semver.satisfies",
		title: "SemVer satisfies",
		description:
			"Ask whether one SemVer stands in a named relation to another (= != < <= > >= ~ ^).",
		package: "@sdxc/semver",
		amount: "500",
		priceUsd: "$0.0005",
	},
	{
		id: "zone-file.parse",
		title: "Parse zone file",
		description: "Parse an RFC 1035 master file into typed DNS records (requires an origin).",
		package: "@sdxc/zone-file",
		amount: "2000",
		priceUsd: "$0.002",
	},
	{
		id: "json-patch.apply",
		title: "Apply JSON Patch",
		description: "Apply an RFC 6902 JSON Patch document to a JSON value.",
		package: "@sdxc/json-patch",
		amount: "1000",
		priceUsd: "$0.001",
	},
	{
		id: "json-patch.diff",
		title: "Diff JSON",
		description: "Generate an RFC 6902 JSON Patch that transforms one JSON value into another.",
		package: "@sdxc/json-patch",
		amount: "1000",
		priceUsd: "$0.001",
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
