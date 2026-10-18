/**
 * `sdxc ui update` across copies: `--all` over every copy in the lock file with edited files
 * left unattended, the components a new version reaches reported or copied with `--with-deps`,
 * `--dry-run`, and the usage errors for naming copies and `--all` together or neither.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke as invokeCLI } from "@sdxc/cli/test";
import { isSuccess, wrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { RegistryEntry } from "../../ui/registry.js";

import { createSDXC } from "../../cli.js";
import { REGISTRY } from "../../releases.js";
import { registryDocument } from "../../testing.js";
import { REGISTRY_DIR } from "../../ui/registry.js";

/** The npm registry a copy's missing `@sdxc/*` packages are pinned from. */
const SERVER = setupServer(
	http.get(`${REGISTRY}/*`, ({ request }) =>
		HttpResponse.json(
			registryDocument(new URL(request.url).pathname.slice(1), ["2026.10.1", "2026.10.14"]),
		),
	),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterAll(() => SERVER.close());

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
		content: 'import { bg } from "@sdxc/u/color";\n\nexport function Button() {\n\treturn bg;\n}\n',
	},
	test: {
		path: "button.test.tsx",
		content:
			'import { test } from "vitest";\nimport { Button } from "@sdxc/ui/button";\n\ntest("renders", () => Button);\n',
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
			'import { Button } from "@sdxc/ui/button";\n\nexport function Dialog() {\n\treturn Button;\n}\n',
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
	'import { Button, Dialog, Tabs } from "@sdxc/ui";',
	'import { Dialog as Modal } from "@sdxc/ui/dialog";',
	"",
	"export let page = [Button, Dialog, Tabs, Modal];",
	"",
].join("\n");

/** An `@sdxc/kit` package at `release` whose registry holds `entries`. */
async function kitPackage(release: string, entries: RegistryEntry[]): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-ui-package-"));
	CREATED.push(root);
	await writeFile(
		join(root, "package.json"),
		JSON.stringify({ name: "@sdxc/kit", version: release }),
	);
	await mkdir(join(root, REGISTRY_DIR), { recursive: true });
	for (let entry of entries) {
		await writeFile(join(root, REGISTRY_DIR, `${entry.name}.json`), JSON.stringify(entry));
	}
	return root;
}

/**
 * A project listing `@sdxc/u` and `@sdxc/ui`, with a `~/*` path alias, a page importing
 * components, and `files`.
 */
async function project(files: Record<string, string> = {}): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-ui-project-"));
	CREATED.push(root);
	let all = {
		"package.json": JSON.stringify({
			dependencies: { "@sdxc/u": "2026.10.14", "@sdxc/ui": "2026.10.14" },
		}),
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

/**
 * Runs `sdxc ui <argv>` in `cwd` against `packageRoot`, without a terminal unless `options`
 * scripts answers.
 */
function invoke(argv: string[], cwd: string, packageRoot: string, options: InvokeOptions = {}) {
	return invokeCLI(createSDXC({ packageRoot }), ["ui", ...argv], {
		cwd,
		interactive: false,
		...options,
	});
}

async function read(root: string, path: string): Promise<string> {
	return readFile(join(root, path), "utf8");
}

async function exists(root: string, path: string): Promise<boolean> {
	return isSuccess(await wrap(() => access(join(root, path))));
}

/** `entry` as a later release ships it: changed in `release`, with `// v2` appended. */
function changed(entry: RegistryEntry, release: string, extra: Partial<RegistryEntry> = {}) {
	return {
		...entry,
		changedIn: release,
		source: { ...entry.source, content: `${entry.source.content}// v2\n` },
		...extra,
	};
}

describe("sdxc ui update --all", () => {
	test("replaces every untouched copy and leaves edited files without asking", async () => {
		let older = await kitPackage("2026.10.10", [BUTTON, TABS]);
		let newer = await kitPackage("2026.10.20", [
			changed(BUTTON, "2026.10.20"),
			changed(TABS, "2026.10.20"),
		]);
		let root = await project();
		await invoke(["add", "button", "tabs"], root, older);
		let tabs = "resources/components/ui/tabs.tsx";
		await writeFile(join(root, tabs), `${await read(root, tabs)}// mine\n`);

		let result = await invoke(["update", "--all"], root, newer, { interactive: true });
		let forced = await invoke(["update", "--all", "--force"], root, newer);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe(
			[
				"Updated 1 file of button",
				`${tabs} is edited; left as it is (--force replaces it)`,
				"Updated 0 files of tabs",
				"",
			].join("\n"),
		);
		expect(result.stderr).not.toContain("replace it with the installed version?");
		expect(forced.stdout).toBe(
			["button already matches release 2026.10.20", "Updated 1 file of tabs", ""].join("\n"),
		);
		expect(await read(root, tabs)).toBe("export function Tabs() {}\n// v2\n");
		expect((await invoke(["list"], root, newer)).stdout).toBe(
			["button  copied from 2026.10.20", "tabs    copied from 2026.10.20", ""].join("\n"),
		);
	});

	test("--dry-run prints the diff and writes nothing", async () => {
		let older = await kitPackage("2026.10.10", [BUTTON]);
		let newer = await kitPackage("2026.10.20", [changed(BUTTON, "2026.10.20")]);
		let root = await project();
		await invoke(["add", "button"], root, older);
		let button = "resources/components/ui/button.tsx";
		let before = await read(root, button);

		let result = await invoke(["update", "--all", "--dry-run"], root, newer);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(`+++ b/${button}\n`);
		expect(result.stdout).toContain("+// v2\n");
		expect(result.stderr).toBe("Updated 1 file of button\n");
		expect(await read(root, button)).toBe(before);
	});

	test("reports when nothing is copied", async () => {
		let sdxc = await kitPackage("2026.10.14", [BUTTON]);
		let root = await project();

		expect(await invoke(["update", "--all"], root, sdxc)).toMatchObject({
			code: 0,
			stdout: "No component is copied; sdxc ui add copies one\n",
		});
	});

	test("is a usage error with neither names nor --all, and with both", async () => {
		let sdxc = await kitPackage("2026.10.14", [BUTTON]);
		let root = await project();
		await invoke(["add", "button"], root, sdxc);

		let neither = await invoke(["update"], root, sdxc);
		let both = await invoke(["update", "button", "--all"], root, sdxc);

		expect(neither.code).toBe(2);
		expect(neither.stderr).toMatch(
			/^Name the copies to update, or pass --all\n\nUsage: sdxc ui update/,
		);
		expect(both.code).toBe(2);
		expect(both.stderr).toMatch(/^Name the copies to update or pass --all, not both\n/);
	});
});

describe("components a new version reaches", () => {
	/** `dialog` before and after it starts importing `button`. */
	async function releases(): Promise<{ older: string; newer: string }> {
		let older = await kitPackage("2026.10.10", [
			BUTTON,
			{
				...DIALOG,
				dependencies: [],
				source: { ...DIALOG.source, content: "export function Dialog() {}\n" },
			},
		]);
		let newer = await kitPackage("2026.10.20", [BUTTON, { ...DIALOG, changedIn: "2026.10.20" }]);
		return { older, newer };
	}

	test("are reported with the command that copies them", async () => {
		let { older, newer } = await releases();
		let root = await project();
		await invoke(["add", "dialog"], root, older);

		let result = await invoke(["update", "dialog"], root, newer);

		expect(result.stdout).toBe(
			[
				"Updated 1 file of dialog",
				"dialog now reaches button on @sdxc/ui; sdxc ui add button copies it, as does --with-deps",
				"",
			].join("\n"),
		);
		expect(await read(root, "resources/components/ui/dialog.tsx")).toContain(
			'import { Button } from "@sdxc/ui/button";',
		);
		expect(await exists(root, "resources/components/ui/button.tsx")).toBe(false);
	});

	test("are copied with --with-deps, and the update imports the copy", async () => {
		let { older, newer } = await releases();
		let root = await project();
		await invoke(["add", "dialog"], root, older);

		let result = await invoke(["update", "--all", "--with-deps"], root, newer);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe(
			["Updated 1 file of dialog", "Copied button to resources/components/ui/button.tsx", ""].join(
				"\n",
			),
		);
		expect(await read(root, "resources/components/ui/dialog.tsx")).toContain(
			'import { Button } from "./button";',
		);
		expect(await read(root, "app/routes/home.tsx")).toContain(
			'import { Button } from "~/resources/components/ui/button";',
		);
		expect((await invoke(["list"], root, newer)).stdout).toBe(
			["button  copied from 2026.10.20", "dialog  copied from 2026.10.20", ""].join("\n"),
		);
	});
});
