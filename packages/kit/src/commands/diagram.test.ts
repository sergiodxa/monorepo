/**
 * `sdxc diagram` over a fixture app: Mermaid for a person, JSON for an agent, SVG on disk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";

const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function project(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-diagram-"));
	PROJECTS.push(root);
	for (let [path, content] of Object.entries({ "package.json": "{}", ...files })) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

describe("sdxc diagram", () => {
	test("prints a Mermaid flowchart of the layer graph", async () => {
		let root = await project({
			"app/models/post.ts": `export function load() {\n\treturn 1;\n}\n`,
			"app/http/controllers/show.ts": `import { load } from "../../models/post.js";\nexport const show = load;\n`,
		});

		let result = await invoke(createSDXC(), ["diagram"], { cwd: root, interactive: false });

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("flowchart TB");
		expect(result.stdout).toContain("http");
		expect(result.stdout).toContain("models");
	});

	test("prints the graph as JSON", async () => {
		let root = await project({
			"app/models/post.ts": `export function load() {\n\treturn 1;\n}\n`,
			"app/http/controllers/show.ts": `import { load } from "../../models/post.js";\nexport const show = load;\n`,
		});

		let result = await invoke(createSDXC(), ["diagram", "--json"], {
			cwd: root,
			interactive: false,
		});

		expect(result.code).toBe(0);
		let report = JSON.parse(result.stdout) as {
			mermaid: string;
			layers: Array<{ from: string; to: string }>;
		};
		expect(report.mermaid).toContain("flowchart TB");
		expect(report.layers.some((edge) => edge.from === "http" && edge.to === "models")).toBe(true);
	});

	test("writes an SVG when --svg is set", async () => {
		let root = await project({
			"app/models/post.ts": `export function load() {\n\treturn 1;\n}\n`,
			"app/http/controllers/show.ts": `import { load } from "../../models/post.js";\nexport const show = load;\n`,
		});

		let result = await invoke(createSDXC(), ["diagram", "--svg", "architecture.svg"], {
			cwd: root,
			interactive: false,
		});

		expect(result.code).toBe(0);
		expect(result.stdout.trim()).toBe(join(root, "architecture.svg"));
		let svg = await readFile(join(root, "architecture.svg"), "utf8");
		expect(svg).toContain("<svg");
	});
});
