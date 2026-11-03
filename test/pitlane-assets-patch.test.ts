/**
 * Guards the repo's patch to `@pitlane/assets`: a server environment's modules list no
 * preloads, since the resolver reads a server graph for stylesheets alone and every Worker
 * parses the manifest at startup. Fails when an upgrade installs a copy the patch misses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AssetBuildEnvironment } from "@pitlane/assets/build";

import { createAssetManifest } from "@pitlane/assets/build";
import { describe, expect, test } from "vitest";

/** One environment's graph: an entry chunk that statically imports a shared chunk with a stylesheet. */
function graph(role: "client" | "server", prefix: string): AssetBuildEnvironment {
	return {
		role,
		entries: role === "client" ? { "app/entry.ts": "entry" } : {},
		assets: {},
		chunks: {
			entry: {
				file: `assets/${prefix}-entry.js`,
				modules: ["app/entry.ts"],
				imports: ["shared"],
				dynamicImports: [],
				stylesheets: [],
			},
			shared: {
				file: `assets/${prefix}-shared.js`,
				modules: ["app/shared.ts"],
				imports: [],
				dynamicImports: [],
				stylesheets: ["assets/shared.css"],
			},
		},
	};
}

describe("createAssetManifest", () => {
	let manifest = createAssetManifest({
		base: "/",
		environments: { client: graph("client", "client"), ssr: graph("server", "ssr") },
	});

	test("lists a client module's static closure as its preloads", () => {
		expect(manifest.environments.client?.modules["app/entry.ts"]?.preloads).toEqual([
			"/assets/client-entry.js",
			"/assets/client-shared.js",
		]);
	});

	test("lists no preloads for a server module and keeps its stylesheets", () => {
		expect(manifest.environments.ssr?.modules["app/entry.ts"]).toEqual({
			preloads: [],
			stylesheets: ["/assets/shared.css"],
		});
	});
});
