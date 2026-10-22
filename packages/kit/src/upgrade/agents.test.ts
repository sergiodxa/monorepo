/**
 * The sdxc section of a project's `AGENTS.md`: replaced from the release's template between its
 * markers with everything around it kept byte for byte, and left alone when the file is missing,
 * unmarked or unbalanced. The shipped template's own section is checked to be well formed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { createSDXC } from "../cli.js";
import { defaultPackageRoot } from "../create/templates.js";

import { managedSection, planAgentsFile, replaceSection, writeAgentsFile } from "./agents.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The section a fixture release ships. */
const SECTION = [
	"<!-- sdxc:start · new wording -->",
	"",
	"New rules.",
	"",
	"<!-- sdxc:end -->",
].join("\n");

/** A project's `AGENTS.md` with its own rules around an older section. */
const PROJECT = [
	"# Our agents",
	"",
	"Intro we wrote.",
	"",
	"<!-- sdxc:start · old wording -->",
	"Old rules.",
	"<!-- sdxc:end -->",
	"",
	"## Ours",
	"",
	"Keep this.",
	"",
].join("\n");

/** A fixture release whose `app` template ships `SECTION`, and a project holding `agents`. */
async function fixture(agents: string | null): Promise<{ root: string; packageRoot: string }> {
	let dir = await mkdtemp(join(tmpdir(), "sdxc-agents-"));
	DIRECTORIES.push(dir);
	let packageRoot = join(dir, "kit");
	let root = join(dir, "project");
	await mkdir(join(packageRoot, "templates/app"), { recursive: true });
	await mkdir(root);
	await writeFile(
		join(packageRoot, "package.json"),
		JSON.stringify({ name: "@sdxc/kit", version: "2026.10.14" }),
	);
	await writeFile(join(packageRoot, "changelog.jsonl"), "");
	await writeFile(join(root, "package.json"), JSON.stringify({ name: "app" }));
	await writeFile(
		join(packageRoot, "templates/app/AGENTS.md"),
		`# Template\n\n${SECTION}\n\n## Yours\n`,
	);
	if (agents !== null) await writeFile(join(root, "AGENTS.md"), agents);
	return { root, packageRoot };
}

/** Runs `sdxc upgrade --prompt` in the project at `root` against the kit at `packageRoot`. */
function prompt(root: string, packageRoot: string) {
	return invoke(createSDXC({ packageRoot }), ["upgrade", "--prompt", "--from", "2026.9.4"], {
		cwd: root,
	});
}

describe("replaceSection", () => {
	test("replaces the marked lines and keeps everything around them", () => {
		let replaced = replaceSection(PROJECT, SECTION);

		expect(replaced).toEqual({
			status: "refreshed",
			text: [
				"# Our agents",
				"",
				"Intro we wrote.",
				"",
				SECTION,
				"",
				"## Ours",
				"",
				"Keep this.",
				"",
			].join("\n"),
		});
	});

	test("reports a section already at the release as current", () => {
		let text = `Ours\n${SECTION}\n`;

		expect(replaceSection(text, SECTION)).toEqual({ status: "current", text });
	});

	test("writes the section with the file's CRLF line endings", () => {
		let replaced = replaceSection(PROJECT.replaceAll("\n", "\r\n"), SECTION);

		expect(replaced.text).toBe(replaceSection(PROJECT, SECTION).text.replaceAll("\n", "\r\n"));
	});

	test("leaves a file without markers, or with unbalanced ones, as it is", () => {
		let unmarked = "# Ours\n";
		let cases = [
			"<!-- sdxc:start -->\nno end\n",
			"<!-- sdxc:end -->\n<!-- sdxc:start -->\n",
			`${SECTION}\n${SECTION}\n`,
		];

		expect(replaceSection(unmarked, SECTION)).toEqual({ status: "unmarked", text: unmarked });
		for (let text of cases) {
			expect(replaceSection(text, SECTION)).toEqual({ status: "unbalanced", text });
		}
	});
});

describe("planAgentsFile and writeAgentsFile", () => {
	test("rewrite the project's section from the release's template", async () => {
		let { root, packageRoot } = await fixture(PROJECT);

		let plan = unwrap(await planAgentsFile(root, packageRoot));
		if (plan === null) expect.unreachable("the fixture kit ships a template");
		let before = await readFile(join(root, "AGENTS.md"), "utf8");
		unwrap(await writeAgentsFile(root, plan));

		expect(plan.status).toBe("refreshed");
		expect(before).toBe(PROJECT);
		let written = await readFile(join(root, "AGENTS.md"), "utf8");
		expect(written).toBe(replaceSection(PROJECT, SECTION).text);
		expect(unwrap(await planAgentsFile(root, packageRoot))).toEqual({
			status: "current",
			text: null,
		});
	});

	test("plan nothing to write for a missing or unmarked file", async () => {
		let missing = await fixture(null);
		let unmarked = await fixture("# Ours\n");

		expect(unwrap(await planAgentsFile(missing.root, missing.packageRoot))).toEqual({
			status: "missing",
			text: null,
		});
		expect(unwrap(await planAgentsFile(unmarked.root, unmarked.packageRoot))).toEqual({
			status: "unmarked",
			text: null,
		});
	});

	test("answer null for a kit that ships no template", async () => {
		let { root, packageRoot } = await fixture(PROJECT);
		await rm(join(packageRoot, "templates"), { recursive: true });

		expect(unwrap(await planAgentsFile(root, packageRoot))).toBeNull();
	});
});

describe("sdxc upgrade --prompt", () => {
	test("refreshes the section and says so on stderr", async () => {
		let { root, packageRoot } = await fixture(PROJECT);

		let run = await prompt(root, packageRoot);

		expect(run.code).toBe(0);
		expect(run.stderr).toBe("AGENTS.md: refreshed the sdxc section\n");
		expect(run.stdout).not.toContain("## Agent instructions");
		expect(await readFile(join(root, "AGENTS.md"), "utf8")).toContain("New rules.");
	});

	test("points an agent at the release's section when the file has none", async () => {
		let missing = await fixture(null);
		let unmarked = await fixture("# Ours\n");

		let runs = [await prompt(missing.root, missing.packageRoot)];
		runs.push(await prompt(unmarked.root, unmarked.packageRoot));

		let url = "https://unpkg.com/@sdxc/kit@2026.10.14/templates/app/AGENTS.md";
		expect(runs[0]?.stdout).toContain(
			`## Agent instructions\n\nThis project has no \`AGENTS.md\`. When this project is an app in the sdxc layout (it has \`bootstrap/worker.ts\`), add the section from ${url},`,
		);
		expect(runs[1]?.stdout).toContain("`AGENTS.md` has no sdxc section, so the upgrade left it");
		expect(await readFile(join(unmarked.root, "AGENTS.md"), "utf8")).toBe("# Ours\n");
	});

	test("asks for one pair of markers and writes nothing when they are unbalanced", async () => {
		let text = "<!-- sdxc:start -->\nno end\n";
		let { root, packageRoot } = await fixture(text);

		let run = await prompt(root, packageRoot);

		expect(run.stdout).toContain("Restore one pair around the sdxc section");
		expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe(text);
	});

	test("writes nothing when the prompt is refused", async () => {
		let { root, packageRoot } = await fixture(PROJECT);

		let run = await invoke(
			createSDXC({ packageRoot }),
			["upgrade", "--prompt", "--from", "2027.1.1"],
			{ cwd: root },
		);

		expect(run.code).toBe(1);
		expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe(PROJECT);
	});
});

describe("the app template's AGENTS.md", () => {
	test("holds one sdxc section with project room after it", async () => {
		let text = await readFile(join(defaultPackageRoot(), "templates/app/AGENTS.md"), "utf8");

		let section = unwrap(managedSection(text));

		expect(section).toMatch(/^<!-- sdxc:start .*-->\n/);
		expect(section).toMatch(/\n<!-- sdxc:end -->$/);
		expect(text.slice(text.indexOf(section) + section.length)).toContain("## This project");
	});
});
