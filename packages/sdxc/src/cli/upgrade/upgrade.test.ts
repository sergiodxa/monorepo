/**
 * `sdxc upgrade` moving a fixture project: resolving the target on a mocked npm registry,
 * bumping `sdxc` and `remix` in `package.json` byte for byte, reporting `@sdxc/*` pins, and
 * handing the install and the prompt to the project's package manager.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { success } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { bumpManifest } from "./project.js";

import type { Exec } from "./index.js";

import { upgrade } from "./index.js";

/** The registry versions the mocked npm serves, `latest` being the newest. */
const PUBLISHED: Record<string, { remix: string }> = {
	"2026.9.4": { remix: "3.0.0" },
	"2026.10.1": { remix: "3.0.0" },
	"2026.10.14": { remix: "3.1.0" },
};

const SERVER = setupServer(
	http.get("https://registry.npmjs.org/sdxc/:version", ({ params }) => {
		let version = params.version === "latest" ? "2026.10.14" : String(params.version);
		let published = PUBLISHED[version];
		if (published === undefined) return HttpResponse.json({ error: "not found" }, { status: 404 });
		return HttpResponse.json({
			name: "sdxc",
			version,
			peerDependencies: { remix: published.remix },
		});
	}),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterAll(() => SERVER.close());

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The fixture `package.json`, tab-indented with a trailing script naming sdxc. */
const MANIFEST = `{
	"name": "app",
	"scripts": {
		"sdxc": "sdxc upgrade"
	},
	"dependencies": {
		"remix": "3.0.0",
		"sdxc": "2026.9.4"
	},
	"devDependencies": {
		"@sdxc/jwt": "2026.9.4"
	}
}
`;

/** A pnpm project with sdxc 2026.9.4 installed and one file importing `@sdxc/jwt`. */
async function fixtureProject(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-upgrade-"));
	PROJECTS.push(root);
	let files: Record<string, string> = {
		"package.json": MANIFEST,
		"pnpm-lock.yaml": "",
		"node_modules/sdxc/package.json": JSON.stringify({ name: "sdxc", version: "2026.9.4" }),
		"src/token.ts": 'import { sign } from "@sdxc/jwt";\n',
	};
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Runs `sdxc upgrade` with `argv`, recording every command it hands to the package manager. */
async function invoke(argv: string[], cwd: string) {
	let stdout = "";
	let stderr = "";
	let commands: Array<{ command: string; stdout: string }> = [];
	let exec: Exec = async (command, options) => {
		commands.push({ command: command.join(" "), stdout: options.stdout });
		return success(undefined);
	};
	let code = await upgrade(
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
		{ exec },
	);
	return { code, stdout, stderr, commands };
}

describe("sdxc upgrade", () => {
	test("bumps sdxc and remix to the latest release, then installs and prompts", async () => {
		let root = await fixtureProject();
		let result = await invoke([], root);
		expect(result.code).toBe(0);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			MANIFEST.replace('"remix": "3.0.0"', '"remix": "3.1.0"').replace(
				'"sdxc": "2026.9.4"',
				'"sdxc": "2026.10.14"',
			),
		);
		expect(result.stderr).toBe(
			[
				"package.json: sdxc 2026.9.4 -> 2026.10.14",
				"package.json: remix 3.0.0 -> 3.1.0",
				"@sdxc/jwt is listed beside sdxc, which does not support it: import sdxc/jwt instead and remove it; imported by src/token.ts",
				"",
			].join("\n"),
		);
		expect(result.commands).toEqual([
			{ command: "pnpm install", stdout: "stderr" },
			{
				command: "pnpm exec sdxc upgrade --prompt --from 2026.9.4 --remix-from 3.0.0",
				stdout: "stdout",
			},
		]);
	});

	test("--no-install changes package.json only and prints the commands to run next", async () => {
		let root = await fixtureProject();
		let result = await invoke(["2026.10.1", "--no-install", "--output", "prompt.md"], root);
		expect(result.code).toBe(0);
		expect(result.commands).toEqual([]);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			MANIFEST.replace('"sdxc": "2026.9.4"', '"sdxc": "2026.10.1"'),
		);
		expect(result.stderr).toContain(
			`Run \`pnpm install\`, then \`pnpm exec sdxc upgrade --prompt --from 2026.9.4 --output ${join(root, "prompt.md")}\` for the upgrade prompt.\n`,
		);
	});

	test("reports the installed release as up to date", async () => {
		let root = await fixtureProject();
		let result = await invoke(["2026.9.4"], root);
		expect(result).toMatchObject({ code: 0, stderr: "sdxc is up to date at 2026.9.4\n" });
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(MANIFEST);
	});

	test("refuses a release older than the installed one", async () => {
		let root = await fixtureProject();
		await writeFile(
			join(root, "node_modules/sdxc/package.json"),
			JSON.stringify({ version: "2026.10.1" }),
		);
		let result = await invoke(["2026.9.4"], root);
		expect(result).toMatchObject({
			code: 1,
			stderr: "sdxc 2026.9.4 is older than the installed 2026.10.1; upgrade only moves forward\n",
		});
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(MANIFEST);
	});

	test("fails on a version npm does not have", async () => {
		let root = await fixtureProject();
		let result = await invoke(["2027.1.1"], root);
		expect(result).toMatchObject({ code: 1, stderr: "sdxc@2027.1.1 is not published on npm\n" });
	});

	test("rejects more than one version", async () => {
		let root = await fixtureProject();
		let result = await invoke(["2026.10.1", "2026.10.14"], root);
		expect(result.code).toBe(2);
	});
});

describe("bumpManifest", () => {
	test("changes only the pins inside dependency sections", () => {
		let { text, bumps } = bumpManifest(MANIFEST, { sdxc: "2026.10.14", remix: "3.0.0" });
		expect(text).toBe(MANIFEST.replace('"sdxc": "2026.9.4"', '"sdxc": "2026.10.14"'));
		expect(bumps).toEqual([{ name: "sdxc", from: "2026.9.4", to: "2026.10.14" }]);
	});
});
