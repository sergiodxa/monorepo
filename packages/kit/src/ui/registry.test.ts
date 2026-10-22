/**
 * Reading the registry a release ships: the release from the package's own manifest, entries
 * validated against their schema and file name, and the transitive closure `--with-deps` copies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vite-plus/test";

import type { RegistryEntry } from "./registry.js";

import { REGISTRY_DIR, readRegistry, withDependencies } from "./registry.js";

/** Fixture packages created by the current test, removed after it. */
const PACKAGES: string[] = [];

afterEach(async () => {
	let created = PACKAGES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A registry entry for `name` reaching `dependencies`. */
function entry(name: string, dependencies: string[] = []): RegistryEntry {
	return {
		name,
		changedIn: "2026.10.14",
		dependencies,
		exports: [name.toUpperCase()],
		source: { path: `${name}.tsx`, content: `export function ${name.toUpperCase()}() {}\n` },
		test: null,
	};
}

/** An `@sdxc/kit` package root at `version` whose registry holds `files`. */
async function kitPackage(version: string | null, files: Record<string, string>) {
	let root = await mkdtemp(join(tmpdir(), "sdxc-ui-registry-"));
	PACKAGES.push(root);
	await writeFile(join(root, "package.json"), JSON.stringify(version === null ? {} : { version }));
	await mkdir(join(root, REGISTRY_DIR), { recursive: true });
	for (let [file, content] of Object.entries(files)) {
		await writeFile(join(root, REGISTRY_DIR, file), content);
	}
	return root;
}

describe("readRegistry", () => {
	test("reads every entry with the release the package declares", async () => {
		let root = await kitPackage("2026.10.14", {
			"button.json": JSON.stringify(entry("button")),
			"dialog.json": JSON.stringify(entry("dialog", ["button"])),
		});

		let registry = unwrap(await readRegistry(root));

		expect(registry.release).toBe("2026.10.14");
		expect([...registry.entries.keys()]).toEqual(["button", "dialog"]);
	});

	test("fails on a package without a registry and on an entry under another name", async () => {
		let empty = await mkdtemp(join(tmpdir(), "sdxc-ui-registry-"));
		PACKAGES.push(empty);
		await writeFile(join(empty, "package.json"), '{"version":"0.0.1"}');
		let misnamed = await kitPackage("1", { "tabs.json": JSON.stringify(entry("button")) });

		let missing = await readRegistry(empty);
		let invalid = await readRegistry(misnamed);

		expect(missing.status === "failure" && missing.error.message).toContain(
			"This @sdxc/kit has no component registry",
		);
		expect(invalid.status === "failure" && invalid.error.message).toBe(
			"registry/ui/tabs.json is not a registry entry",
		);
	});
});

describe("withDependencies", () => {
	test("reaches components through other components, each once", async () => {
		let root = await kitPackage("1", {
			"a.json": JSON.stringify(entry("a", ["b"])),
			"b.json": JSON.stringify(entry("b", ["c", "a"])),
			"c.json": JSON.stringify(entry("c")),
			"d.json": JSON.stringify(entry("d")),
		});
		let registry = unwrap(await readRegistry(root));

		expect(withDependencies(registry, ["a"])).toEqual(["a", "b", "c"]);
		expect(withDependencies(registry, ["d", "c"])).toEqual(["d", "c"]);
	});
});
