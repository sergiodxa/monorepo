/**
 * The `sdxc ui` registry: the import rewrite and dependency list over a fixture package,
 * `changedIn` over a fixture git history with release tags, and the real `@sdxc/ui`, whose every
 * rewritten specifier has to be one the `@sdxc/ui` export map serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { findModuleReferences } from "@sdxc/codemod";
import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { readRegistry } from "../../packages/kit/src/ui/registry.js";

import {
	UI_REGISTRY_DIR,
	buildUIRegistry,
	earliestRelease,
	exportedNames,
	readBarrels,
	readComponents,
	registryEntry,
	releasesTouching,
	writeUIRegistry,
} from "./ui-registry.js";
import { REPO_ROOT } from "./workspace.js";

const EXEC_FILE = promisify(execFile);

/** Fixture directories created by the current test, removed after it. */
const CREATED: string[] = [];

afterEach(async () => {
	let dirs = CREATED.splice(0);
	await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The fixture `@sdxc/ui`: two components that import each other's parts and the helpers. */
const FIXTURE: Record<string, string> = {
	"packages/ui/src/components/button.tsx": [
		'import type { Handle } from "remix/component";',
		'import { bg } from "@sdxc/u/color";',
		'import { glyphEdges } from "../utils/glyph-edges.js";',
		"export function Button(handle: Handle) { return () => null; }",
		"export namespace Button { export interface Props {} }",
		"export const BUTTON_SIZES = ['sm'], other = 1;",
		"",
	].join("\n"),
	"packages/ui/src/components/button.test.tsx": [
		'import { test } from "vitest";',
		'import { Button } from "./button.js";',
		"",
	].join("\n"),
	"packages/ui/src/components/dialog.tsx": [
		'import { Button } from "./button.js";',
		'import { floatingSurface } from "../styles/floating-surface.js";',
		"type Props = {};",
		"export { type Props as DialogProps };",
		"export function Dialog() { return Button; }",
		"",
	].join("\n"),
	"packages/ui/src/components/index.ts": 'export * from "./button.js";\n',
	"packages/ui/src/components/catalog.test.tsx": 'import "./dialog.js";\n',
	"packages/ui/src/utils/index.ts": 'export * from "./glyph-edges.js";\n',
	"packages/ui/src/utils/glyph-edges.ts": "export function glyphEdges() {}\n",
	"packages/ui/src/styles/index.ts": 'export * from "./floating-surface.js";\n',
	"packages/ui/src/styles/floating-surface.ts": "export function floatingSurface() {}\n",
	"packages/ui/src/animations/index.ts": "export {};\n",
	"packages/ui/src/behaviors/index.ts": "export {};\n",
	"packages/ui/src/mixins/index.ts": "export {};\n",
};

/** Writes `files` into a fresh directory and answers it. */
async function fixture(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-ui-registry-"));
	CREATED.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Runs git in `cwd` with a fixed identity, so commits work on a machine without one. */
async function git(cwd: string, ...args: string[]): Promise<void> {
	await EXEC_FILE(
		"git",
		["-c", "user.name=Fixture", "-c", "user.email=fixture@sergiodxa.com", ...args],
		{ cwd },
	);
}

describe("registryEntry", () => {
	test("points imports at sdxc and lists the sibling components a component reaches", async () => {
		let root = await fixture(FIXTURE);
		let packageDir = join(root, "packages/ui");
		let components = unwrap(await readComponents(packageDir));
		let barrels = unwrap(await readBarrels(packageDir));
		let names = new Set(components.map((component) => component.name));

		let [button, dialog] = components.map((component) =>
			unwrap(registryEntry(component, { barrels, components: names, changedIn: "2026.10.14" })),
		);

		expect(components.map((component) => component.name)).toEqual(["button", "dialog"]);
		expect(button).toEqual({
			name: "button",
			changedIn: "2026.10.14",
			dependencies: [],
			exports: ["Button", "BUTTON_SIZES", "other"],
			source: {
				path: "button.tsx",
				content: (FIXTURE["packages/ui/src/components/button.tsx"] ?? "").replace(
					'"../utils/glyph-edges.js"',
					'"@sdxc/ui/utils"',
				),
			},
			test: {
				path: "button.test.tsx",
				content: 'import { test } from "vitest";\nimport { Button } from "@sdxc/ui/button";\n',
			},
		});
		expect(dialog?.dependencies).toEqual(["button"]);
		expect(dialog?.exports).toEqual(["DialogProps", "Dialog"]);
		expect(dialog?.test).toBeNull();
		expect(dialog?.source.content).toContain('from "@sdxc/ui/button"');
		expect(dialog?.source.content).toContain('from "@sdxc/ui/styles"');
	});

	test("fails on a helper its folder's barrel does not re-export", async () => {
		let root = await fixture({ ...FIXTURE, "packages/ui/src/utils/index.ts": "export {};\n" });
		let packageDir = join(root, "packages/ui");
		let [button] = unwrap(await readComponents(packageDir));
		let barrels = unwrap(await readBarrels(packageDir));

		let entry = registryEntry(button!, {
			barrels,
			components: new Set(["button"]),
			changedIn: "2026.10.14",
		});

		expect(entry.status).toBe("failure");
		expect(entry.status === "failure" && entry.error.message).toContain(
			"button.tsx imports what @sdxc/ui does not publish: ../utils/glyph-edges.js",
		);
	});
});

describe("exportedNames", () => {
	test("reads declarations, export lists and default exports once each", () => {
		let source = [
			"export interface A {}",
			"export type B = string;",
			"export enum C { X }",
			"export class D {}",
			"function E() {}",
			"export { E, E as F };",
			'export * from "./other.js";',
			"export default E;",
		].join("\n");

		expect(exportedNames("x.tsx", source)).toEqual(["A", "B", "C", "D", "E", "F", "default"]);
	});
});

describe("earliestRelease", () => {
	test("orders dated versions numerically and ignores other tags", () => {
		expect(earliestRelease(["v2026.10.2", "v2026.9.30", "nightly", ""])).toBe("2026.9.30");
		expect(earliestRelease(["latest"])).toBeNull();
	});
});

describe("releasesTouching", () => {
	test("answers the release that shipped each component's latest commit", async () => {
		let root = await fixture(FIXTURE);
		let components = "packages/ui/src/components";
		await git(root, "init", "--quiet");
		await git(root, "add", ".");
		await git(root, "commit", "--quiet", "-m", "first");
		await git(root, "tag", "v2026.9.4");
		await writeFile(join(root, components, "button.test.tsx"), "export {};\n");
		await git(root, "commit", "--quiet", "-am", "button test");
		await git(root, "tag", "v2026.9.10");
		await git(root, "tag", "v2026.10.1");
		await writeFile(join(root, components, "dialog.tsx"), "export {};\n");
		await git(root, "commit", "--quiet", "-am", "unreleased dialog");

		let releases = unwrap(
			await releasesTouching(
				root,
				[
					[`${components}/button.tsx`, `${components}/button.test.tsx`],
					[`${components}/dialog.tsx`],
					[`${components}/new.tsx`],
				],
				"2026.10.14",
			),
		);

		expect(releases).toEqual(["2026.9.10", "2026.10.14", "2026.10.14"]);
	});
});

describe("the @sdxc/ui registry", () => {
	test("rewrites every component to specifiers the @sdxc/ui export map serves", async () => {
		let entries = unwrap(await buildUIRegistry(REPO_ROOT, "2026.10.14"));
		let manifest = JSON.parse(
			await readFile(join(REPO_ROOT, "packages/ui/package.json"), "utf8"),
		) as { exports: Record<string, string> };
		let names = new Set(entries.map((entry) => entry.name));
		let unserved: string[] = [];

		for (let entry of entries) {
			for (let file of [entry.source, entry.test]) {
				if (file === null) continue;
				for (let { specifier } of unwrap(findModuleReferences(file.path, file.content))) {
					if (specifier.startsWith(".")) {
						unserved.push(`${entry.name}: ${specifier}`);
					} else if (
						(specifier === "@sdxc/ui" || specifier.startsWith("@sdxc/ui/")) &&
						!served(specifier, manifest.exports)
					) {
						unserved.push(`${entry.name}: ${specifier}`);
					}
				}
			}
			for (let dependency of entry.dependencies) expect(names).toContain(dependency);
		}

		expect(entries.length).toBeGreaterThan(50);
		expect(unserved).toEqual([]);
	});

	test("writes one JSON file per component, each one the sdxc CLI reads", async () => {
		let staging = await mkdtemp(join(tmpdir(), "sdxc-ui-registry-stage-"));
		CREATED.push(staging);

		unwrap(await writeUIRegistry(staging, { root: REPO_ROOT, version: "2026.10.14" }));

		let files = await readdir(join(staging, UI_REGISTRY_DIR));
		let button = JSON.parse(await readFile(join(staging, UI_REGISTRY_DIR, "button.json"), "utf8"));
		await writeFile(join(staging, "package.json"), JSON.stringify({ version: "2026.10.14" }));
		let read = unwrap(await readRegistry(staging));
		expect(files).toContain("dialog.json");
		expect(read.entries.size).toBe(files.length);
		expect(Object.keys(button)).toEqual([
			"name",
			"changedIn",
			"dependencies",
			"exports",
			"source",
			"test",
		]);
	});
});

/**
 * Whether `@sdxc/ui`'s exports resolve `specifier`: an exact key, or a `*` pattern whose target
 * file exists for the matched part.
 */
function served(specifier: string, exports: Record<string, string>): boolean {
	let subpath = `.${specifier.slice("@sdxc/ui".length)}`;
	if (subpath in exports) return true;
	return Object.entries(exports).some(([key, target]) => {
		let [prefix = "", suffix = ""] = key.split("*");
		if (!key.includes("*") || !subpath.startsWith(prefix) || !subpath.endsWith(suffix)) {
			return false;
		}
		let matched = subpath.slice(prefix.length, subpath.length - suffix.length);
		return existsSync(join(REPO_ROOT, "packages/ui", target.replace("*", matched)));
	});
}
