/**
 * MCP tools mirroring the HTTP catalog: one tool per priced operation, named
 * with the same id so `Mcp-Name` matches {@link findOperation}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

export default tools({
	qrEncode: tool("qr.encode", {
		title: "Encode QR",
		description:
			"Encode text as a QR Code Model 2 symbol. Pass { text, level? }. Returns svgPath and viewBox. Paid via x402.",
		input: s.object({
			text: s.string().pipe(checks.minLength(1), checks.maxLength(4000)),
			level: s.optional(s.enum_(["L", "M", "Q", "H"])),
		}),
		annotations: READ_ONLY,
	}),

	highlight: tool("highlight", {
		title: "Highlight source",
		description: "Tokenize source for a language. Pass { source, language }. Paid via x402.",
		input: s.object({
			source: s.string().pipe(checks.minLength(1), checks.maxLength(100_000)),
			language: s.string().pipe(checks.minLength(1), checks.maxLength(40)),
		}),
		annotations: READ_ONLY,
	}),

	markdownPlain: tool("markdown.plain", {
		title: "Markdown to plain text",
		description: "Parse Markdown and return plain text. Pass { markdown, code? }. Paid via x402.",
		input: s.object({
			markdown: s.string().pipe(checks.minLength(1), checks.maxLength(200_000)),
			code: s.optional(s.boolean()),
		}),
		annotations: READ_ONLY,
	}),

	semverSatisfies: tool("semver.satisfies", {
		title: "SemVer satisfies",
		description:
			"Ask whether version stands in comparison to against. Pass { version, comparison, against }. Paid via x402.",
		input: s.object({
			version: s.string().pipe(checks.minLength(1), checks.maxLength(100)),
			comparison: s.enum_(["=", "!=", "<", "<=", ">", ">=", "~", "^"]),
			against: s.string().pipe(checks.minLength(1), checks.maxLength(100)),
		}),
		annotations: READ_ONLY,
	}),

	zoneFileParse: tool("zone-file.parse", {
		title: "Parse zone file",
		description: "Parse an RFC 1035 zone file. Pass { zone, origin }. Paid via x402.",
		input: s.object({
			zone: s.string().pipe(checks.minLength(1), checks.maxLength(500_000)),
			origin: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
		}),
		annotations: READ_ONLY,
	}),

	jsonPatchApply: tool("json-patch.apply", {
		title: "Apply JSON Patch",
		description: "Apply an RFC 6902 patch. Pass { document, patch }. Paid via x402.",
		input: s.object({
			document: s.any(),
			patch: s.array(s.any()),
		}),
		annotations: READ_ONLY,
	}),

	jsonPatchDiff: tool("json-patch.diff", {
		title: "Diff JSON",
		description:
			"Generate an RFC 6902 patch from before to after. Pass { before, after }. Paid via x402.",
		input: s.object({
			before: s.any(),
			after: s.any(),
		}),
		annotations: READ_ONLY,
	}),
});
