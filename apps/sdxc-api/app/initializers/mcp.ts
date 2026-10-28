/**
 * MCP server for the micro-APIs: every catalog operation as a paid tool.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHandler, lazy } from "@sdxc/mcp";

import toolset from "~/app/mcp/tools";

const mcp = createHandler({
	name: "sdxc-apis",
	title: "sdxc package APIs",
	version: "1.0.0",
	instructions:
		"Paid micro-APIs over @sdxc packages. Call a tool to run one capability; unpaid tools/call answers HTTP 402 with x402 payment requirements. GET /v1 lists the same operations for plain HTTP.",
	cacheScope: "public",
});

mcp.tools.map(
	toolset.qrEncode,
	lazy(() => import("~/app/mcp/tools/qr-encode")),
);
mcp.tools.map(
	toolset.highlight,
	lazy(() => import("~/app/mcp/tools/highlight")),
);
mcp.tools.map(
	toolset.markdownPlain,
	lazy(() => import("~/app/mcp/tools/markdown-plain")),
);
mcp.tools.map(
	toolset.semverSatisfies,
	lazy(() => import("~/app/mcp/tools/semver-satisfies")),
);
mcp.tools.map(
	toolset.zoneFileParse,
	lazy(() => import("~/app/mcp/tools/zone-file-parse")),
);
mcp.tools.map(
	toolset.jsonPatchApply,
	lazy(() => import("~/app/mcp/tools/json-patch-apply")),
);
mcp.tools.map(
	toolset.jsonPatchDiff,
	lazy(() => import("~/app/mcp/tools/json-patch-diff")),
);

export default mcp;
