/**
 * `sdxc ui` end to end over a fixture project and a fixture registry: `add` with and without
 * `--with-deps`, the app-wide import rewrite, `list`, `diff`, `update` around edited files,
 * `remove`, `--dry-run`, the lock file each one leaves, and usage errors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isSuccess, wrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { run } from "../run.js";

import type { RegistryEntry } from "./registry.js";

import { hashContent } from "./commands.js";
import { REGISTRY_DIR } from "./registry.js";

import { UI_USAGE, ui } from "./index.js";

/** Directories created by the current test, removed after it. */
const CREATED: string[] = [];

afterEach(async () => {
	let created = CREATED.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

const BUTTON: RegistryEntry = {
	name: "button",
	changedIn: "2026.10.2",
	dependencies: [],
	exports: ["Button"],
	source: {
		path: "button.tsx",
		content: 'import { bg } from "sdxc/u/color";\n\nexport function Button() {\n\treturn bg;\n}\n',
	},
	test: {
		path: "button.test.tsx",
		content:
			'import { test } from "vitest";\nimport { Button } from "sdxc/ui/button";\n\ntest("renders", () => Button);\n',
	},
};

const DIALOG: RegistryEntry = {
	name: "dialog",
	changedIn: "2026.10.14",
	dependencies: ["button"],
	exports: ["Dialog"],
	source: {
		path: "dialog.tsx",
		content:
			'import { Button } from "sdxc/ui/button";\n\nexport function Dialog() {\n\treturn Button;\n}\n',
	},
	test: null,
};

const TABS: RegistryEntry = {
	...DIALOG,
	name: "tabs",
	dependencies: [],
	exports: ["Tabs"],
	source: { path: "tabs.tsx", content: "export function Tabs() {}\n" },
};

const PAGE = [
	'import { Button, Dialog, Tabs } from "sdxc/ui";',
	'import { Dialog as Modal } from "sdxc/ui/dialog";',
	"",
	"export let page = [Button, Dialog, Tabs, Modal];",
	"",
].join("\n");

/** An `sdxc` package at `release` whose registry holds `entries`. */
async function sdxcPackage(release: string, entries: RegistryEntry[]): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-ui-package-"));
	CREATED.push(root);
	await writeFile(join(root, "package.json"), JSON.stringify({ name: "sdxc", version: release }));
	await mkdir(join(root, REGISTRY_DIR), { recursive: true });
	for (let entry of entries) {
		await writeFile(join(root, REGISTRY_DIR, `${entry.name}.json`), JSON.stringify(entry));
	}
	return root;
}

/** A project with a `~/*` path alias, a page importing components, and `files`. */
async function project(files: Record<string, string> = {}): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-ui-project-"));
	CREATED.push(root);
	let all = {
		"package.json": "{}",
		"tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "~/*": ["./*"] } } }),
		"app/routes/home.tsx": PAGE,
		...files,
	};
	for (let [path, content] of Object.entries(all)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Runs `sdxc ui <argv>` in `cwd` against `packageRoot`, collecting both streams. */
async function invoke(argv: string[], cwd: string, packageRoot: string) {
	let stdout = "";
	let stderr = "";
	let code = await ui(
		argv,
		{
			cwd,
			stdout: (text) => {
				stdout += text;
			},
			stderr: (text) => {
				stderr += text;
			},
		},
		{ packageRoot },
	);
	return { code, stdout, stderr };
}

async function read(root: string, path: string): Promise<string> {
	return readFile(join(root, path), "utf8");
}

async function exists(root: string, path: string): Promise<boolean> {
	return isSuccess(await wrap(() => access(join(root, path))));
}

describe("sdxc ui add", () => {
	test("copies a component, records it, and points every import of it at the copy", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON, DIALOG, TABS]);
		let root = await project();

		let result = await invoke(["add", "dialog"], join(root, "app"), sdxc);

		expect(result).toEqual({
			code: 0,
			stdout: "Copied dialog to resources/components/ui/dialog.tsx\n",
			stderr: "",
		});
		expect(await read(root, "resources/components/ui/dialog.tsx")).toBe(DIALOG.source.content);
		expect(await read(root, "app/routes/home.tsx")).toBe(
			[
				'import { Button, Tabs } from "sdxc/ui";',
				'import { Dialog as Modal, Dialog } from "~/resources/components/ui/dialog";',
				"",
				"export let page = [Button, Dialog, Tabs, Modal];",
				"",
			].join("\n"),
		);
		expect(await read(root, ".config/sdxc.lock.jsonl")).toBe(
			`${JSON.stringify({
				kind: "ui",
				name: "dialog",
				release: "2026.10.14",
				files: { "dialog.tsx": hashContent(DIALOG.source.content) },
			})}\n`,
		);
	});

	test("with --with-deps and ui.tests, copies what a component reaches and points copies at copies", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON, DIALOG, TABS]);
		let root = await project({ ".config/sdxc.jsonc": '{ "ui": { "tests": true } }' });

		let result = await invoke(["add", "dialog", "--with-deps"], root, sdxc);

		expect(result.code).toBe(0);
		expect(await read(root, "resources/components/ui/dialog.tsx")).toContain(
			'import { Button } from "./button";',
		);
		expect(await read(root, "resources/components/ui/button.test.tsx")).toContain(
			'import { Button } from "./button";',
		);
		expect(await read(root, "app/routes/home.tsx")).toContain(
			'import { Button } from "~/resources/components/ui/button";',
		);
		let lock = (await read(root, ".config/sdxc.lock.jsonl")).split("\n");
		expect(lock[0]).toContain('"name":"button"');
		expect(lock[0]).toContain('"button.test.tsx"');
		expect(lock[1]).toContain('"name":"dialog"');
	});

	test("hashes each copy after the project's format command has run", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON]);
		let formatter = join(await project(), "format.mjs");
		await writeFile(
			formatter,
			'import { appendFileSync } from "node:fs";\nfor (let file of process.argv.slice(2)) appendFileSync(file, "// formatted\\n");\n',
		);
		let root = await project({
			".config/sdxc.jsonc": JSON.stringify({ format: [process.execPath, formatter] }),
		});

		await invoke(["add", "button"], root, sdxc);
		let listed = await invoke(["list"], root, sdxc);

		let copy = await read(root, "resources/components/ui/button.tsx");
		expect(copy.endsWith("// formatted\n")).toBe(true);
		expect(await read(root, ".config/sdxc.lock.jsonl")).toContain(hashContent(copy));
		expect(listed.stdout).toBe("button  copied from 2026.10.14\n");
	});

	test("refuses an unknown component and a file the lock does not list", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON]);
		let root = await project({ "resources/components/ui/button.tsx": "mine\n" });

		let unknown = await invoke(["add", "carousel"], root, sdxc);
		let blocked = await invoke(["add", "button"], root, sdxc);

		expect(unknown).toEqual({
			code: 1,
			stdout: "",
			stderr: "sdxc 2026.10.14 ships no component named carousel; sdxc ui list shows every one\n",
		});
		expect(blocked.stderr).toBe(
			"resources/components/ui/button.tsx already exists and the lock file does not list it; move it first\n",
		);
		expect(await exists(root, ".config/sdxc.lock.jsonl")).toBe(false);
	});

	test("--dry-run prints the diff, lock file included, and writes nothing", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON, DIALOG]);
		let root = await project();

		let result = await invoke(["add", "dialog", "--dry-run"], root, sdxc);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			'--- a/app/routes/home.tsx\n+++ b/app/routes/home.tsx\n@@ -1,4 +1,4 @@\n-import { Button, Dialog, Tabs } from "sdxc/ui";\n',
		);
		expect(result.stdout).toContain("--- /dev/null\n+++ b/resources/components/ui/dialog.tsx\n");
		expect(result.stdout).toContain("--- /dev/null\n+++ b/.config/sdxc.lock.jsonl\n");
		expect(await read(root, "app/routes/home.tsx")).toBe(PAGE);
		expect(await exists(root, "resources/components/ui/dialog.tsx")).toBe(false);
	});
});

describe("sdxc ui list, diff and update", () => {
	test("marks copies that are edited or behind, and updates only untouched files", async () => {
		let older = await sdxcPackage("2026.10.10", [BUTTON, DIALOG]);
		let newer = await sdxcPackage("2026.10.20", [
			{
				...BUTTON,
				changedIn: "2026.10.20",
				source: { ...BUTTON.source, content: `${BUTTON.source.content}// v2\n` },
			},
			{
				...DIALOG,
				changedIn: "2026.10.20",
				source: { ...DIALOG.source, content: `${DIALOG.source.content}// v2\n` },
			},
		]);
		let root = await project();
		await invoke(["add", "button", "dialog"], root, older);
		let dialog = "resources/components/ui/dialog.tsx";
		await writeFile(join(root, dialog), `${await read(root, dialog)}// mine\n`);

		let listed = await invoke(["list"], root, newer);
		let diff = await invoke(["diff", "dialog"], root, newer);
		let updated = await invoke(["update", "button", "dialog"], root, newer);
		let forced = await invoke(["update", "dialog", "--force"], root, newer);

		expect(listed.stdout).toBe(
			[
				"button  copied from 2026.10.10, behind, changed in 2026.10.20",
				"dialog  copied from 2026.10.10, edited, behind, changed in 2026.10.20",
				"",
			].join("\n"),
		);
		expect(diff.stdout).toBe(
			[
				`--- a/${dialog}`,
				`+++ b/${dialog}`,
				"@@ -3,4 +3,4 @@",
				" export function Dialog() {",
				" \treturn Button;",
				" }",
				"-// v2",
				"+// mine",
				"",
			].join("\n"),
		);
		expect(updated.stdout).toBe(
			[
				"Updated 1 file of button",
				`${dialog} is edited; left as it is (--force replaces it)`,
				"Updated 0 files of dialog",
				"",
			].join("\n"),
		);
		expect(await read(root, "resources/components/ui/button.tsx")).toContain("// v2");
		expect(forced.stdout).toBe("Updated 1 file of dialog\n");
		expect(await read(root, dialog)).toBe(
			'import { Button } from "./button";\n\nexport function Dialog() {\n\treturn Button;\n}\n// v2\n',
		);
		expect((await invoke(["list"], root, newer)).stdout).toBe(
			["button  copied from 2026.10.20", "dialog  copied from 2026.10.20", ""].join("\n"),
		);
	});

	test("diff reports a copy that matches the installed version", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON]);
		let root = await project();
		await invoke(["add", "button"], root, sdxc);

		expect(await invoke(["diff", "button"], root, sdxc)).toEqual({
			code: 0,
			stdout: "button matches sdxc 2026.10.14\n",
			stderr: "",
		});
	});
});

describe("sdxc ui remove", () => {
	test("deletes the copies, drops the lock line and points imports back at sdxc/ui", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON, DIALOG, TABS]);
		let root = await project();
		await invoke(["add", "dialog", "button"], root, sdxc);

		let result = await invoke(["remove", "dialog"], root, sdxc);

		expect(result).toEqual({ code: 0, stdout: "Removed dialog\n", stderr: "" });
		expect(await exists(root, "resources/components/ui/dialog.tsx")).toBe(false);
		expect(await read(root, "app/routes/home.tsx")).toBe(
			[
				'import { Tabs, Dialog as Modal, Dialog } from "sdxc/ui";',
				'import { Button } from "~/resources/components/ui/button";',
				"",
				"export let page = [Button, Dialog, Tabs, Modal];",
				"",
			].join("\n"),
		);
		expect(await read(root, ".config/sdxc.lock.jsonl")).not.toContain("dialog");
	});
});

describe("usage", () => {
	test("exits 2 with the usage for a missing command, an unknown one, or a misplaced flag", async () => {
		let sdxc = await sdxcPackage("2026.10.14", [BUTTON]);
		let root = await project();

		expect(await invoke([], root, sdxc)).toEqual({ code: 2, stdout: "", stderr: UI_USAGE });
		expect((await invoke(["publish"], root, sdxc)).stderr).toBe(
			`Unknown ui command: publish\n\n${UI_USAGE}`,
		);
		expect((await invoke(["list", "--force"], root, sdxc)).stderr).toBe(
			`sdxc ui list takes no --force\n\n${UI_USAGE}`,
		);
		expect((await invoke(["add"], root, sdxc)).code).toBe(2);
		expect((await invoke(["remove", "button"], root, sdxc)).stderr).toBe(
			"Not copied: button; sdxc ui list shows the copies\n",
		);
	});

	test("sdxc dispatches ui with the arguments after it", async () => {
		let stdout = "";
		let code = await run(["ui", "--help"], {
			cwd: await project(),
			stdout: (text) => {
				stdout += text;
			},
			stderr: () => undefined,
		});

		expect({ code, stdout }).toEqual({ code: 0, stdout: UI_USAGE });
	});
});
