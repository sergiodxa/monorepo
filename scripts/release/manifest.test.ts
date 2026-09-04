/**
 * Publish-manifest generation: the staged `package.json` has to point at built output, carry
 * exact internal pins and the registry-only fields, and shed everything that only describes
 * the workspace copy. Fixtures are inline so no expectation depends on a real manifest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { PackageManifest } from "./workspace.js";

import { nonTypeScriptTargets, publishManifest, rewriteTarget } from "./manifest.js";
import { packageFromManifest } from "./workspace.js";

const OPTIONS = {
	version: "2026.9.3",
	pins: { "@sdxc/result": "2026.9.3", "@sdxc/types": "2026.9.1" },
	gitHead: "6a3d5087f2eb8475bc6e1ba511a578c590ee68f3",
	repository: {
		url: "git+https://github.com/sergiodxa/monorepo.git",
		directory: "packages/example",
	},
};

/** A private workspace manifest with the usual fields, overridden per test. */
function manifest(overrides: Partial<PackageManifest> = {}): PackageManifest {
	return {
		name: "@sdxc/example",
		version: "0.0.1",
		private: true,
		license: "MIT",
		type: "module",
		exports: { ".": "./src/index.ts" },
		scripts: { typecheck: "tsc --noEmit" },
		...overrides,
	};
}

/** The publish attempt for `manifest(overrides)` under the shared options, as a `Result`. */
function attempt(overrides: Partial<PackageManifest> = {}) {
	return publishManifest(packageFromManifest("example", manifest(overrides)), OPTIONS);
}

/** The publish manifest for `manifest(overrides)`, for the tests that expect one to come out. */
function publish(overrides: Partial<PackageManifest> = {}): PackageManifest {
	return unwrap(attempt(overrides));
}

describe("publishManifest", () => {
	test("rewrites a string export target from src to dist", () => {
		let exports = { ".": "./src/index.ts", "./algorithm": "./src/algorithm.tsx" };

		expect(publish({ exports }).exports).toEqual({
			".": "./dist/index.js",
			"./algorithm": "./dist/algorithm.js",
		});
	});

	test("rewrites every branch of a conditional export", () => {
		let exports = {
			".": "./src/index.ts",
			"./sqlite": { bun: "./src/sqlite.bun.ts", default: "./src/sqlite.node.ts" },
		};

		expect(publish({ exports }).exports).toEqual({
			".": "./dist/index.js",
			"./sqlite": { bun: "./dist/sqlite.bun.js", default: "./dist/sqlite.node.js" },
		});
	});

	test("rewrites the members of a fallback array", () => {
		let exports = { ".": ["./src/index.ts", "./fallback.css"] };

		expect(publish({ exports }).exports).toEqual({ ".": ["./dist/index.js", "./fallback.css"] });
	});

	test("keeps a wildcard pattern, moving it to dist", () => {
		let exports = { "./general/*": "./src/general/*.ts" };

		expect(publish({ exports }).exports).toEqual({ "./general/*": "./dist/general/*.js" });
	});

	test("rewrites bin targets into npm's canonical form, whether a map or a single path", () => {
		expect(publish({ bin: { spec: "./src/cli.ts" } }).bin).toEqual({ spec: "dist/cli.js" });
		expect(publish({ bin: "./src/cli.ts" }).bin).toBe("dist/cli.js");
		expect(publish({ bin: { tool: "./bin/tool.js" } }).bin).toEqual({ tool: "bin/tool.js" });
	});

	test("leaves a .css target untouched, at the package root and under src", () => {
		let exports = {
			".": "./src/index.ts",
			"./styles.css": "./styles.css",
			"./theme.css": "./src/theme.css",
		};

		expect(publish({ exports }).exports).toEqual({
			".": "./dist/index.js",
			"./styles.css": "./styles.css",
			"./theme.css": "./src/theme.css",
		});
	});

	test("refuses a TypeScript target outside src, which the build never emits", () => {
		let result = attempt({ exports: { ".": "./lib/index.ts" } });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("./lib/index.ts");
	});

	test("refuses a TypeScript bin target outside src the same way", () => {
		let result = attempt({ bin: { tool: "./bin/tool.ts" } });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("./bin/tool.ts");
	});

	test("drops private, scripts and devDependencies and keeps the rest", () => {
		let output = publish({ sideEffects: false, devDependencies: { vitest: "^4.0.0" } });

		expect(output).not.toHaveProperty("private");
		expect(output).not.toHaveProperty("scripts");
		expect(output).not.toHaveProperty("devDependencies");
		expect(output.license).toBe("MIT");
		expect(output.type).toBe("module");
		expect(output.sideEffects).toBe(false);
	});

	test("replaces workspace ranges with the exact pin and keeps external ranges", () => {
		let dependencies = {
			"@sdxc/result": "workspace:*",
			"@sdxc/types": "workspace:^",
			jose: "^6.2.10",
		};

		expect(publish({ dependencies }).dependencies).toEqual({
			"@sdxc/result": "2026.9.3",
			"@sdxc/types": "2026.9.1",
			jose: "^6.2.10",
		});
	});

	test("refuses a workspace dependency without a pin", () => {
		let result = attempt({ dependencies: { "@sdxc/duration": "workspace:*" } });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("@sdxc/duration");
	});

	test("injects version, gitHead, public access and the repository directory", () => {
		let output = publish();

		expect(output.version).toBe("2026.9.3");
		expect(output.gitHead).toBe(OPTIONS.gitHead);
		expect(output.publishConfig).toEqual({ access: "public" });
		expect(output.repository).toEqual({
			type: "git",
			url: OPTIONS.repository.url,
			directory: "packages/example",
		});
	});

	test("leaves the workspace manifest untouched", () => {
		let source = manifest({ dependencies: { "@sdxc/result": "workspace:*" } });
		let copy = structuredClone(source);

		publishManifest(packageFromManifest("example", source), OPTIONS);

		expect(source).toEqual(copy);
	});
});

describe("rewriteTarget", () => {
	test("maps src TypeScript to dist JavaScript and passes other files through", () => {
		expect(unwrap(rewriteTarget("./src/index.ts"))).toBe("./dist/index.js");
		expect(unwrap(rewriteTarget("./src/deep/view.tsx"))).toBe("./dist/deep/view.js");
		expect(unwrap(rewriteTarget("./styles.css"))).toBe("./styles.css");
	});

	test("refuses TypeScript outside src, naming the target", () => {
		let result = rewriteTarget("./scripts/run.ts");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("./scripts/run.ts");
	});
});

describe("nonTypeScriptTargets", () => {
	test("lists the export and bin targets the build copies verbatim", () => {
		let source = manifest({
			exports: {
				".": "./src/index.ts",
				"./styles.css": "./styles.css",
				"./sqlite": { bun: "./src/a.ts", default: "./src/b.ts" },
			},
			bin: { tool: "./bin/tool.js" },
		});

		expect(nonTypeScriptTargets(source)).toEqual(["./styles.css", "./bin/tool.js"]);
	});
});
