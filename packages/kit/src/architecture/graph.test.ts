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
});

describe("findCycles", () => {
	test("finds a two-node cycle", () => {
		expect(
			findCycles(
				["a.ts", "b.ts"],
				[
					{ from: "a.ts", to: "b.ts", specifier: "./b.js" },
					{ from: "b.ts", to: "a.ts", specifier: "./a.js" },
				],
			),
		).toEqual([["a.ts", "b.ts"]]);
	});
});
