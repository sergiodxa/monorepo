/**
 * The workspace graph walks a release relies on: reaching private packages with the chain
 * that reaches them, closing a set over its dependents, ordering dependencies first, and
 * collecting the targets a manifest exports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { DependencyNode, Package } from "./workspace.js";

import {
	closeOverDependents,
	collectExportTargets,
	formatPrivateDependency,
	packageFromManifest,
	privateDependencies,
	readPackages,
	topologicalOrder,
} from "./workspace.js";

const ROOT = join(import.meta.dirname, "../..");

/** A graph node named `@sdxc/<name>`, private when asked. */
function node(name: string, dependencies: string[] = [], isPrivate = false): DependencyNode {
	return {
		name: `@sdxc/${name}`,
		isPrivate,
		dependencies: dependencies.map((dependency) => `@sdxc/${dependency}`),
	};
}

/** A workspace package named `@sdxc/<dir>` whose internal dependencies are the given dirs. */
function pkg(dir: string, dependencies: string[] = [], isPrivate = false): Package {
	return packageFromManifest(dir, {
		name: `@sdxc/${dir}`,
		...(isPrivate ? { private: true } : {}),
		exports: { ".": "./src/index.ts" },
		dependencies: Object.fromEntries(dependencies.map((name) => [`@sdxc/${name}`, "workspace:*"])),
	});
}

/** The eight starter packages exactly as they depend on one another. */
const STARTER = [
	pkg("types"),
	pkg("result", ["types"]),
	pkg("duration", ["result"]),
	pkg("dates", ["duration", "result"]),
	pkg("crypto", ["result"]),
	pkg("jwt", ["duration"]),
	pkg("sample", ["crypto", "dates", "duration", "jwt"]),
	pkg("spec", ["duration", "result", "sample"]),
];

describe("privateDependencies", () => {
	test("reports every private package reached, with the chain that reaches it", () => {
		let graph = [
			node("spec", ["sample", "bar"]),
			node("sample", ["foo"]),
			node("foo", ["deep"], true),
			node("deep", [], true),
			node("bar", [], true),
		];
		let spec = graph[0];

		expect(spec).toBeDefined();
		if (!spec) return;
		expect(privateDependencies(spec, graph)).toEqual([
			{ package: "@sdxc/spec", dependency: "@sdxc/bar", via: [] },
			{ package: "@sdxc/spec", dependency: "@sdxc/foo", via: ["@sdxc/sample"] },
			{ package: "@sdxc/spec", dependency: "@sdxc/deep", via: ["@sdxc/sample", "@sdxc/foo"] },
		]);
	});

	test("reports nothing for a tree of public packages", () => {
		let spec = STARTER.at(-1);

		expect(spec).toBeDefined();
		if (!spec) return;
		expect(privateDependencies(spec, STARTER)).toEqual([]);
	});

	test("formats a row as one line naming the chain when there is one", () => {
		expect(
			formatPrivateDependency({ package: "@sdxc/spec", dependency: "@sdxc/foo", via: [] }),
		).toBe("@sdxc/spec depends on private @sdxc/foo");
		expect(
			formatPrivateDependency({
				package: "@sdxc/spec",
				dependency: "@sdxc/foo",
				via: ["@sdxc/sample"],
			}),
		).toBe("@sdxc/spec depends on private @sdxc/foo (via @sdxc/sample)");
		expect(
			formatPrivateDependency({
				package: "@sdxc/spec",
				dependency: "@sdxc/deep",
				via: ["@sdxc/sample", "@sdxc/foo"],
			}),
		).toBe("@sdxc/spec depends on private @sdxc/deep (via @sdxc/sample → @sdxc/foo)");
	});
});

describe("closeOverDependents", () => {
	test("adds every transitive public dependent and drops private ones", () => {
		let graph = [...STARTER, pkg("internal", ["result"], true)];

		expect([...closeOverDependents(["@sdxc/duration"], graph)].sort()).toEqual([
			"@sdxc/dates",
			"@sdxc/duration",
			"@sdxc/jwt",
			"@sdxc/sample",
			"@sdxc/spec",
		]);
		expect(closeOverDependents(["@sdxc/result"], graph).has("@sdxc/internal")).toBe(false);
	});

	test("keeps the seeds themselves, except private ones", () => {
		let graph = [...STARTER, pkg("internal", [], true)];

		expect([...closeOverDependents(["@sdxc/spec", "@sdxc/internal"], graph)]).toEqual([
			"@sdxc/spec",
		]);
	});
});

describe("topologicalOrder", () => {
	test("places every dependency before its dependents across the starter shape", () => {
		let order = unwrap(
			topologicalOrder(
				STARTER.map((member) => member.name),
				STARTER,
			),
		);
		let position = new Map(order.map((name, index) => [name, index]));

		expect(order).toHaveLength(8);
		expect(order[0]).toBe("@sdxc/types");
		expect(order.at(-1)).toBe("@sdxc/spec");
		for (let member of STARTER) {
			for (let dependency of member.dependencies) {
				expect(position.get(dependency)).toBeLessThan(position.get(member.name) ?? -1);
			}
		}
	});

	test("orders only the requested names, ignoring edges to outsiders", () => {
		expect(unwrap(topologicalOrder(["@sdxc/spec", "@sdxc/sample"], STARTER))).toEqual([
			"@sdxc/sample",
			"@sdxc/spec",
		]);
	});

	test("names the cycle it refuses", () => {
		let graph = [node("a", ["b"]), node("b", ["c"]), node("c", ["a"]), node("d")];
		let result = topologicalOrder(["@sdxc/a", "@sdxc/b", "@sdxc/c", "@sdxc/d"], graph);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe(
				"Dependency cycle: @sdxc/a -> @sdxc/b -> @sdxc/c -> @sdxc/a",
			);
		}
	});
});

describe("collectExportTargets", () => {
	test("finds every string target across subpaths, conditions, arrays, patterns and bin", () => {
		let targets = collectExportTargets({
			name: "@sdxc/example",
			exports: {
				".": "./src/index.ts",
				"./sqlite": { bun: "./src/sqlite.bun.ts", default: "./src/sqlite.node.ts" },
				"./general/*": "./src/general/*.ts",
				"./styles.css": "./styles.css",
				"./blocked": null,
				"./either": ["./src/a.ts", "./fallback.css"],
			},
			bin: { spec: "./src/cli.ts" },
		});

		expect(targets).toEqual([
			"./src/index.ts",
			"./src/sqlite.bun.ts",
			"./src/sqlite.node.ts",
			"./src/general/*.ts",
			"./styles.css",
			"./src/a.ts",
			"./fallback.css",
			"./src/cli.ts",
		]);
	});

	test("accepts a bare string exports field and a string bin", () => {
		expect(
			collectExportTargets({
				name: "@sdxc/example",
				exports: "./src/index.ts",
				bin: "./src/cli.ts",
			}),
		).toEqual(["./src/index.ts", "./src/cli.ts"]);
	});
});

describe("packageFromManifest", () => {
	test("derives the shipped paths and the internal dependencies", () => {
		let example = packageFromManifest("highlight", {
			name: "@sdxc/highlight",
			exports: { ".": "./src/index.ts", "./styles.css": "./styles.css" },
			dependencies: { "@sdxc/result": "workspace:*", "@markdoc/markdoc": "^0.5.9" },
			devDependencies: { "@sdxc/types": "workspace:*" },
		});

		expect(example.dir).toBe("highlight");
		expect(example.isPrivate).toBe(false);
		expect(example.dependencies).toEqual(["@sdxc/result"]);
		expect(example.shippedPaths).toEqual([
			"packages/highlight/src",
			"packages/highlight/package.json",
			"packages/highlight/tsconfig.json",
			"packages/highlight/README.md",
			"packages/highlight/LICENSE.md",
			"packages/highlight/styles.css",
		]);
	});
});

describe("readPackages", () => {
	let fixtureRoot = "";

	beforeAll(async () => {
		fixtureRoot = await mkdtemp(join(tmpdir(), "sdxc-workspace-"));
	});

	afterAll(async () => {
		await rm(fixtureRoot, { recursive: true, force: true });
	});

	test("reads every packages/* manifest in the repo", async () => {
		let packages = await unwrap(readPackages(ROOT));
		let spec = packages.find((member) => member.name === "@sdxc/spec");

		expect(packages.length).toBeGreaterThan(40);
		expect(spec?.dir).toBe("spec");
		expect(spec?.dependencies).toEqual(["@sdxc/duration", "@sdxc/result", "@sdxc/sample"]);
		expect(spec?.shippedPaths).toContain("packages/spec/src");
	});

	test("skips a directory without a manifest", async () => {
		await mkdir(join(fixtureRoot, "packages/empty"), { recursive: true });
		await mkdir(join(fixtureRoot, "packages/typed"), { recursive: true });
		await writeFile(join(fixtureRoot, "packages/typed/package.json"), '{"name":"@sdxc/typed"}');

		let packages = await unwrap(readPackages(fixtureRoot));

		expect(packages.map((member) => member.name)).toEqual(["@sdxc/typed"]);
	});

	test("fails naming a manifest it cannot parse", async () => {
		let brokenManifest = join(fixtureRoot, "packages/broken/package.json");
		await mkdir(dirname(brokenManifest), { recursive: true });
		await writeFile(brokenManifest, "{");

		let result = await readPackages(fixtureRoot);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain(brokenManifest);
	});

	test("fails when the packages directory itself is missing", async () => {
		let result = await readPackages(join(fixtureRoot, "nowhere"));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("ENOENT");
	});
});
