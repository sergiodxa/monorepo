/**
 * Who generated files credit and how: package.json `author` in both npm forms, the git user when
 * no manifest names one, no tags when neither does, and the tags landing in `make`'s stubs and
 * the built-in template's modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { unwrap } from "@sdxc/result";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { addHeaderTags, headerTags, parseAuthor, resolveAuthor } from "./author.js";
import { parseConfig } from "./config.js";
import { creditTemplate, defaultPackageRoot } from "./create/templates.js";
import { plan } from "./make/generate.js";
import { parseName } from "./make/names.js";

/** The UTC year every `@copyright` tag is written with. */
const YEAR = new Date().getUTCFullYear();

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

/** A fresh scratch directory, removed after the test. */
async function scratch(): Promise<string> {
	let directory = await mkdtemp(join(tmpdir(), "sdxc-author-"));
	DIRECTORIES.push(directory);
	return directory;
}

/** Runs git in `cwd`, so a fixture repository has the local configuration a test sets. */
async function git(cwd: string, ...args: string[]): Promise<void> {
	await promisify(execFile)("git", args, { cwd });
}

/**
 * Points git at an empty global configuration and no system one, so the machine's own
 * `user.name` never reaches a test.
 */
beforeEach(async () => {
	let home = await scratch();
	await writeFile(join(home, "gitconfig"), "");
	vi.stubEnv("GIT_CONFIG_GLOBAL", join(home, "gitconfig"));
	vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
});

afterEach(async () => {
	vi.unstubAllEnvs();
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("parseAuthor", () => {
	test("reads the string form with and without its email and url", () => {
		expect(parseAuthor("Ada Lovelace <ada@example.com> (https://ada.dev)")).toEqual({
			name: "Ada Lovelace",
			url: "https://ada.dev",
		});
		expect(parseAuthor("Ada Lovelace (https://ada.dev)")).toEqual({
			name: "Ada Lovelace",
			url: "https://ada.dev",
		});
		expect(parseAuthor("Ada Lovelace <ada@example.com>")).toEqual({
			name: "Ada Lovelace",
			url: null,
		});
	});

	test("reads the object form", () => {
		expect(parseAuthor({ name: "Ada Lovelace", email: "ada@example.com" })).toEqual({
			name: "Ada Lovelace",
			url: null,
		});
		expect(parseAuthor({ name: "Ada Lovelace", url: "https://ada.dev" })).toEqual({
			name: "Ada Lovelace",
			url: "https://ada.dev",
		});
	});

	test("answers null for an author without a name", () => {
		expect(parseAuthor("")).toBeNull();
		expect(parseAuthor("<ada@example.com>")).toBeNull();
		expect(parseAuthor({ email: "ada@example.com" })).toBeNull();
		expect(parseAuthor(42)).toBeNull();
	});
});

describe("headerTags", () => {
	test("links the author when there is a url and writes the name alone otherwise", () => {
		expect(headerTags({ name: "Ada", url: "https://ada.dev" }, 2026)).toBe(
			"\n *\n * @author [Ada](https://ada.dev)\n * @copyright Ada 2026",
		);
		expect(headerTags({ name: "Ada", url: null }, 2026)).toBe(
			"\n *\n * @author Ada\n * @copyright Ada 2026",
		);
	});

	test("is empty without an author", () => {
		expect(headerTags(null)).toBe("");
	});
});

describe("addHeaderTags", () => {
	let tags = headerTags({ name: "Ada", url: null }, 2026);

	test("closes the opening JSDoc with the tags", () => {
		expect(addHeaderTags("/**\n * The module.\n */\n\nexport {};\n", tags)).toBe(
			"/**\n * The module.\n *\n * @author Ada\n * @copyright Ada 2026\n */\n\nexport {};\n",
		);
	});

	test("reads past a shebang", () => {
		expect(addHeaderTags("#!/usr/bin/env bun\n/**\n * The CLI.\n */\n", tags)).toBe(
			"#!/usr/bin/env bun\n/**\n * The CLI.\n *\n * @author Ada\n * @copyright Ada 2026\n */\n",
		);
	});

	test("keeps a file already credited or opening with no JSDoc as it is", () => {
		let credited = "/**\n * The module.\n *\n * @author Grace\n */\n";
		expect(addHeaderTags(credited, tags)).toBe(credited);
		expect(addHeaderTags("export {};\n", tags)).toBe("export {};\n");
	});
});

describe("resolveAuthor", () => {
	test("takes the nearest package.json author, walking up from a folder not written yet", async () => {
		let repository = await scratch();
		await mkdir(join(repository, ".git"));
		await writeFile(
			join(repository, "package.json"),
			JSON.stringify({ author: "Ada Lovelace <ada@example.com> (https://ada.dev)" }),
		);
		await mkdir(join(repository, "apps/blog"), { recursive: true });
		await writeFile(join(repository, "apps/blog/package.json"), '{ "name": "blog" }');

		expect(await resolveAuthor(join(repository, "apps/blog/app/services"))).toEqual({
			name: "Ada Lovelace",
			url: "https://ada.dev",
		});
	});

	test("stops at the repository root and falls back to the git user", async () => {
		let outside = await scratch();
		await writeFile(join(outside, "package.json"), JSON.stringify({ author: "Someone Else" }));
		let repository = join(outside, "project");
		await mkdir(repository);
		await git(repository, "init", "--quiet");
		await git(repository, "config", "user.name", "Grace Hopper");

		expect(await resolveAuthor(join(repository, "app/jobs"))).toEqual({
			name: "Grace Hopper",
			url: null,
		});
	});

	test("answers null when neither a manifest nor git names anyone", async () => {
		let project = await scratch();
		await writeFile(join(project, "package.json"), '{ "name": "blog" }');

		expect(await resolveAuthor(project)).toBeNull();
	});
});

describe("generated files", () => {
	test("make credits the project's author in the stub's module JSDoc", async () => {
		let root = await scratch();
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ name: "blog", author: { name: "Ada", url: "https://ada.dev" } }),
		);
		let config = unwrap(parseConfig({}, root, null)).config;
		let request = {
			kind: "service" as const,
			name: unwrap(parseName("charge")),
			variant: null,
			tests: true,
			routes: "web",
		};

		let planned = unwrap(await plan(request, root, config, defaultPackageRoot()));

		for (let file of planned.files) {
			expect(file.content).toContain(
				`\n *\n * @author [Ada](https://ada.dev)\n * @copyright Ada ${YEAR}\n */\n`,
			);
		}
	});

	test("make writes no tags when no author is found", async () => {
		let root = await scratch();
		await writeFile(join(root, "package.json"), '{ "name": "blog" }');
		let config = unwrap(parseConfig({}, root, null)).config;
		let request = {
			kind: "service" as const,
			name: unwrap(parseName("charge")),
			variant: null,
			tests: false,
			routes: "web",
		};

		let planned = unwrap(await plan(request, root, config, defaultPackageRoot()));

		expect(planned.files[0]?.content).toMatch(/^\/\*\*\n \* Charge: [^@]*?succeeds\.\n \*\/\n/);
	});

	test("a built-in template's modules credit the author and other files stay as they are", () => {
		let encode = (text: string) => new TextEncoder().encode(text);
		let tree = {
			files: new Map([
				["app/initializers/logger.ts", encode("/**\n * The logger.\n */\n")],
				["README.md", encode("/**\n * Not a module.\n */\n")],
			]),
			directories: new Set<string>(),
		};

		creditTemplate(tree, headerTags({ name: "Ada", url: null }, 2026));

		let read = (path: string) => new TextDecoder().decode(tree.files.get(path));
		expect(read("app/initializers/logger.ts")).toBe(
			"/**\n * The logger.\n *\n * @author Ada\n * @copyright Ada 2026\n */\n",
		);
		expect(read("README.md")).toBe("/**\n * Not a module.\n */\n");
	});
});
