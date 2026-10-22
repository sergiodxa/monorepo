/**
 * The upgrade prompt rendered end to end for a fixture project between two fixture releases:
 * a target `@sdxc/kit` package with its changelog and component registry, and a project that
 * imports some of its packages and vendors two components.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { invoke as invokeCLI } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { createSDXC } from "../cli.js";

import type { ChangelogEntry } from "./changelog.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A fresh directory holding `files`, each path relative to it. */
async function directory(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-upgrade-"));
	DIRECTORIES.push(root);
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** A changelog entry with a body naming it. */
function entry(
	release: string,
	pkg: string,
	type: string,
	title: string,
	breaking = false,
): ChangelogEntry {
	return { release, package: pkg, type, breaking, title, body: `Body of ${title}.` };
}

/** The target release, 2026.10.14, as installed: its manifest, changelog and registry. */
async function targetRelease(entries: ChangelogEntry[]): Promise<string> {
	return directory({
		"package.json": JSON.stringify({
			name: "@sdxc/kit",
			version: "2026.10.14",
			peerDependencies: { remix: "3.1.0" },
		}),
		"changelog.jsonl": entries.map((line) => `${JSON.stringify(line)}\n`).join(""),
		"registry/ui/button.json": JSON.stringify({ name: "button", changedIn: "2026.10.1" }),
		"registry/ui/dialog.json": JSON.stringify({ name: "dialog", changedIn: "2026.9.20" }),
	});
}

/** A project on bun that imports `@sdxc/jwt` and `@sdxc/auth/issuer` and vendors two components. */
async function fixtureProject(): Promise<string> {
	return directory({
		"package.json": JSON.stringify({
			scripts: { check: "vp check", test: "vitest", dev: "vite" },
			dependencies: { "@sdxc/auth": "2026.10.14", "@sdxc/jwt": "2026.10.1", remix: "3.1.0" },
		}),
		"bun.lock": "",
		"src/app.ts":
			'import { sign } from "@sdxc/jwt";\nimport type { Issuer } from "@sdxc/auth/issuer";\n',
		"node_modules/ignored/index.ts": 'import "@sdxc/markdown";\n',
		".config/sdxc.lock.jsonl": [
			'{"kind":"ui","name":"button","release":"2026.9.4","files":{"button.tsx":"sha256-a"}}',
			'{"kind":"ui","name":"dialog","release":"2026.10.1","files":{"dialog.tsx":"sha256-b"}}',
			'{"kind":"other","name":"x"}',
			"",
		].join("\n"),
	});
}

/** Runs `sdxc upgrade` with `argv` against the `@sdxc/kit` package at `packageRoot`. */
async function invoke(argv: string[], cwd: string, packageRoot: string) {
	let run = await invokeCLI(createSDXC({ packageRoot }), ["upgrade", ...argv], { cwd });
	return { code: run.code, stdout: run.stdout, stderr: run.stderr };
}

/** The prompt for the fixture project moving from 2026.9.4 to 2026.10.14 with remix 3.0.0 to 3.1.0. */
const EXPECTED = `# Upgrade the @sdxc packages from 2026.9.4 to 2026.10.14

This project now depends on the @sdxc packages of release 2026.10.14, installed. Update its code for the changes below, which are the release notes of the packages it imports for every release after 2026.9.4. Apply each breaking change's migration wherever the code uses what it changed, adopt the features and fixes where they apply, then run the verification commands and fix what they report.

Packages this project imports: \`@sdxc/auth\`, \`@sdxc/jwt\`.

## Remix

\`remix\` moved from 3.0.0 to 3.1.0, the version release 2026.10.14 requires. Read its release notes for changes the code needs: https://github.com/remix-run/remix/releases/tag/remix%403.1.0

## Breaking changes

### @sdxc/jwt: rename verify to check

Released in 2026.10.1.

Body of rename verify to check.

## Features

### @sdxc/auth: expose the issuer

Released in 2026.9.5.

Body of expose the issuer.

## Fixes

### @sdxc/jwt: reject expired tokens

Released in 2026.10.14.

Body of reject expired tokens.

## Vendored components

These copied components changed after the release they were copied from. Review each change with \`sdxc ui diff\`, and take it with \`sdxc ui update\` (an edited copy is left alone unless \`--force\`):

- \`button\`, copied from 2026.9.4, changed in 2026.10.1: \`sdxc ui diff button\`, then \`sdxc ui update button\`

## Verify

Run these after editing and fix what they report:

- \`bun run check\`
- \`bun run test\`

## Documentation

- \`@sdxc/auth\`: https://sdxc.dev/api/auth.md
- \`@sdxc/jwt\`: https://sdxc.dev/api/jwt.md
`;

describe("sdxc upgrade --prompt", () => {
	test("renders the imported packages' notes between the two releases", async () => {
		let packageRoot = await targetRelease([
			entry("2026.9.4", "@sdxc/jwt", "feat", "already installed"),
			entry("2026.9.5", "@sdxc/auth", "feat", "expose the issuer"),
			entry("2026.9.5", "@sdxc/markdown", "feat", "not imported"),
			entry("2026.10.1", "@sdxc/jwt", "refactor", "rename verify to check", true),
			entry("2026.10.1", "@sdxc/jwt", "docs", "reword the README"),
			entry("2026.10.14", "@sdxc/jwt", "fix", "reject expired tokens"),
			entry("2026.10.14", "@sdxc/kit", "feat", "add sdxc upgrade"),
		]);
		let root = await fixtureProject();
		let result = await invoke(
			["--prompt", "--from", "2026.9.4", "--remix-from", "3.0.0"],
			join(root, "src"),
			packageRoot,
		);
		expect(result).toEqual({ code: 0, stdout: EXPECTED, stderr: "" });
	});

	test("covers a lagging package from its own pin and the rest from --from", async () => {
		let packageRoot = await targetRelease([
			entry("2026.9.5", "@sdxc/auth", "feat", "expose the issuer"),
			entry("2026.10.1", "@sdxc/jwt", "refactor", "rename verify to check", true),
			entry("2026.10.14", "@sdxc/auth", "fix", "trim the issuer"),
		]);
		let root = await fixtureProject();
		let result = await invoke(
			["--prompt", "--from", "2026.10.14", "--since", "@sdxc/jwt@2026.9.4"],
			root,
			packageRoot,
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			"# Upgrade the @sdxc packages from 2026.9.4 to 2026.10.14\n\nThis project now depends on the @sdxc packages of release 2026.10.14, installed. Update its code for the changes below, which are the release notes of the packages it imports for every release after 2026.9.4.",
		);
		expect(result.stdout).toContain("### @sdxc/jwt: rename verify to check");
		expect(result.stdout).not.toContain("expose the issuer");
		expect(result.stdout).not.toContain("trim the issuer");
	});

	test("rejects a --since that names no package and release", async () => {
		let packageRoot = await targetRelease([]);
		let root = await fixtureProject();
		let result = await invoke(
			["--prompt", "--from", "2026.10.14", "--since", "@sdxc/jwt"],
			root,
			packageRoot,
		);
		expect(result.code).toBe(2);
		expect(result.stderr).toMatch(
			/^--since takes <package>@<version>, such as @sdxc\/jwt@2026\.9\.4\n/,
		);
	});

	test("writes the prompt to --output instead of stdout", async () => {
		let packageRoot = await targetRelease([]);
		let root = await fixtureProject();
		let result = await invoke(
			["--prompt", "--from", "2026.10.1", "--output", "prompt.md"],
			root,
			packageRoot,
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toBe("");
		let prompt = await readFile(join(root, "prompt.md"), "utf8");
		expect(prompt).toContain("No release in between changed a package this project imports.");
		expect(prompt).not.toContain("## Remix");
	});

	test("names the releases outside the changelog's full window", async () => {
		let packageRoot = await targetRelease([
			entry("2025.9.10", "@sdxc/jwt", "feat", "drop the legacy signer", true),
		]);
		let root = await fixtureProject();
		let result = await invoke(["--prompt", "--from", "2025.9.1"], root, packageRoot);
		expect(result.stdout).toContain(
			[
				"## Older releases",
				"Releases after 2025.9.1 and before 2025.10.14 are summarized by their breaking changes only. Their full notes are on GitHub: https://github.com/sergiodxa/monorepo/releases",
				"- 2025.9.10: https://github.com/sergiodxa/monorepo/releases/tag/v2025.9.10",
			].join("\n\n"),
		);
		expect(result.stdout).toContain("### @sdxc/jwt: drop the legacy signer");
	});

	test("needs --from", async () => {
		let packageRoot = await targetRelease([]);
		let root = await fixtureProject();
		let result = await invoke(["--prompt"], root, packageRoot);
		expect(result.code).toBe(2);
	});

	test("refuses a --from newer than the installed release", async () => {
		let packageRoot = await targetRelease([]);
		let root = await fixtureProject();
		let result = await invoke(["--prompt", "--from", "2026.11.1"], root, packageRoot);
		expect(result).toEqual({
			code: 1,
			stdout: "",
			stderr: "--from 2026.11.1 is newer than this @sdxc/kit, 2026.10.14\n",
		});
	});

	test("reads the lock file with the rules sdxc ui writes it by", async () => {
		let packageRoot = await targetRelease([]);
		let root = await fixtureProject();
		await writeFile(
			join(root, ".config/sdxc.lock.jsonl"),
			[
				'{"kind":"ui","name":"button","release":"2026.9.4","files":{"button.tsx":"sha256-a"}}',
				'{"kind":"ui","name":"button","release":"2026.9.4","files":{"button.tsx":"sha256-a"}}',
				"",
			].join("\n"),
		);
		let result = await invoke(["--prompt", "--from", "2026.9.4"], root, packageRoot);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain(".config/sdxc.lock.jsonl:2: repeats the ui entry button");
	});
});
