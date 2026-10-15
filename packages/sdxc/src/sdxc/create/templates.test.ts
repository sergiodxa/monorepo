/**
 * Template specifiers and the built-in templates: what `--template` accepts, how a built-in
 * template is read, and what `create` fills in for the new project.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { renderConfig } from "../init.js";

import {
	completeBuiltin,
	defaultPackageRoot,
	parseTemplate,
	readBuiltinTemplate,
} from "./templates.js";

/** The `package.json` fields these tests read. */
interface Manifest {
	name?: string;
	version?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

/** The `sdxc` package directory these tests read templates from. */
const PACKAGE_ROOT = defaultPackageRoot();

/** A file of `tree` as text. */
function text(files: Map<string, Uint8Array>, path: string): string {
	let bytes = files.get(path);
	if (bytes === undefined) throw new Error(`${path} is missing`);
	return new TextDecoder().decode(bytes);
}

describe("parseTemplate", () => {
	test("reads a name without a slash as a built-in template", () => {
		expect(unwrap(parseTemplate("app"))).toEqual({ kind: "builtin", name: "app" });
	});

	test("reads org/repo, a folder inside it and a ref", () => {
		expect(unwrap(parseTemplate("acme/starters"))).toEqual({
			kind: "github",
			owner: "acme",
			repo: "starters",
			path: null,
			ref: null,
		});
		expect(unwrap(parseTemplate("acme/starters/workers/api#v2.1"))).toEqual({
			kind: "github",
			owner: "acme",
			repo: "starters",
			path: "workers/api",
			ref: "v2.1",
		});
	});

	test("refuses a host prefix, a climbing path and an empty ref", () => {
		let host = parseTemplate("gitlab:acme/starters");
		let climbing = parseTemplate("acme/starters/../secrets");
		let ref = parseTemplate("acme/starters#");

		expect(isFailure(host) && host.error.message).toBe(
			'Template host "gitlab:" is not supported; name a GitHub repository as org/repo',
		);
		expect(isFailure(climbing)).toBe(true);
		expect(isFailure(ref)).toBe(true);
	});
});

describe("built-in templates", () => {
	test("an unknown name lists the templates the package ships", async () => {
		let tree = await readBuiltinTemplate(PACKAGE_ROOT, "nope");

		expect(isFailure(tree) && tree.error.message).toBe(
			'No built-in template "nope"; choose one of: app',
		);
	});

	test("app is named, pinned to this release and configured as sdxc init writes it", async () => {
		let tree = unwrap(await readBuiltinTemplate(PACKAGE_ROOT, "app"));
		let own = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf8")) as Manifest;

		unwrap(await completeBuiltin(tree, "blog", PACKAGE_ROOT));

		let manifest = JSON.parse(text(tree.files, "package.json")) as Manifest;
		expect(Object.keys(manifest)[0]).toBe("name");
		expect(manifest.name).toBe("blog");
		expect(manifest.dependencies?.sdxc).toBe(own.version);
		expect(manifest.dependencies?.remix).toBe(own.peerDependencies?.remix);
		expect(text(tree.files, ".config/sdxc.jsonc")).toBe(unwrap(renderConfig()));
		expect(tree.files.has(".gitignore")).toBe(true);
		expect(tree.files.has("gitignore")).toBe(false);
	});

	test("app pins its tooling to the versions the package tests it with", async () => {
		let tree = unwrap(await readBuiltinTemplate(PACKAGE_ROOT, "app"));
		let own = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf8")) as Manifest;
		let manifest = JSON.parse(text(tree.files, "package.json")) as Manifest;

		let pinned: Record<string, string> = { ...manifest.dependencies, ...manifest.devDependencies };
		for (let [name, version] of Object.entries(own.devDependencies ?? {})) {
			if (name in pinned) expect(pinned[name], name).toBe(version);
		}
	});
});
