/**
 * Import graph: relative edges, layer aggregation, cycles and dependency-rule breaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { findCycles, projectGraph, resolveSpecifier } from "./graph.js";

const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function project(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-graph-"));
	PROJECTS.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

describe("resolveSpecifier", () => {
	test("resolves relative and ~/ paths", () => {
		expect(resolveSpecifier("./b.js", "app/models/a.ts")).toBe("app/models/b.js");
		expect(resolveSpecifier("~/app/services/x", "app/http/c.ts")).toBe("app/services/x");
		expect(resolveSpecifier("@sdxc/result", "app/models/a.ts")).toBeNull();
	});
});

describe("projectGraph", () => {
	test("records an inward edge and a breach", async () => {
		let root = await project({
			"app/http/controllers/show.ts": `import { load } from "../../models/post.js";\nexport const show = load;\n`,
			"app/models/post.ts": `import { show } from "../http/controllers/show.js";\nexport function load() { return show; }\n`,
		});

		let graph = await projectGraph(root);

		expect(graph.edges).toHaveLength(2);
		expect(graph.violations.map((edge) => edge.from)).toEqual(["app/models/post.ts"]);
		expect(graph.cycles.length).toBeGreaterThanOrEqual(1);
	});

	test("marks a dynamic import deferred and leaves it out of cycles and breaches", async () => {
		let root = await project({
			"app/initializers/router.ts":
				'import { health } from "./health.js";\nexport let routes = [health, () => import("~/app/http/controllers/health")];\n',
			"app/initializers/health.ts":
				'import type { routes } from "./router.js";\nexport let health: typeof routes | null = null;\n',
			"app/http/controllers/health.ts":
				'import { health } from "~/app/initializers/health";\nexport default health;\n',
		});

		let graph = await projectGraph(root);

		expect(graph.edges.filter((edge) => edge.deferred).map((edge) => edge.to)).toEqual([
			"app/http/controllers/health.ts",
		]);
		expect(graph.violations).toEqual([]);
		expect(graph.cycles).toEqual([["app/initializers/health.ts", "app/initializers/router.ts"]]);
	});

	test("keeps a test file's imports apart from the app's edges", async () => {
		let root = await project({
			"app/test/database.ts": "export function migrate() {}\n",
			"app/models/post.test.ts": 'import { migrate } from "~/app/test/database";\nmigrate();\n',
		});

		let graph = await projectGraph(root);

		expect(graph.modules).toEqual(["app/test/database.ts"]);
		expect(graph.edges).toEqual([]);
		expect(graph.testEdges.map((edge) => [edge.from, edge.to])).toEqual([
			["app/models/post.test.ts", "app/test/database.ts"],
		]);
	});
});

describe("findCycles", () => {
	test("finds a two-node cycle", () => {
		expect(
			findCycles(
				["a.ts", "b.ts"],
				[
					{ from: "a.ts", to: "b.ts", specifier: "./b.js", deferred: false },
					{ from: "b.ts", to: "a.ts", specifier: "./a.js", deferred: false },
				],
			),
		).toEqual([["a.ts", "b.ts"]]);
	});
});
