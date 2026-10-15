/**
 * `sdxc make` end to end in a scratch project: where each kind lands, the test beside it, the
 * stubs a project overrides, migration chains and numbering, and the refusals that keep a run
 * from writing over anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { materialize, typecheck } from "../testing.js";

import { MAKE_USAGE, make } from "./index.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** An empty project, with `config` as its `.config/sdxc.jsonc` when given. */
async function project(config?: string): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-make-"));
	DIRECTORIES.push(root);
	await writeFile(join(root, "package.json"), '{ "name": "@acme/blog" }\n');
	if (config !== undefined) {
		await mkdir(join(root, ".config"));
		await writeFile(join(root, ".config/sdxc.jsonc"), config);
	}
	return root;
}

/** Runs `make` with `argv` in `cwd` and answers the exit code and both streams. */
async function invoke(argv: string[], cwd: string) {
	let stdout = "";
	let stderr = "";
	let code = await make(argv, {
		cwd,
		stdout: (text) => {
			stdout += text;
		},
		stderr: (text) => {
			stderr += text;
		},
	});
	return { code, stdout, stderr };
}

/** Every file under `root`, relative to it, sorted, leaving out `package.json`. */
async function files(root: string): Promise<string[]> {
	let entries = await readdir(root, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1))
		.filter((path) => path !== "package.json")
		.sort();
}

describe("make", () => {
	test.each([
		["controller", "sponsors", "app/http/controllers/sponsors.tsx"],
		["middleware", "require-user", "app/http/middleware/require-user.ts"],
		["validator", "signup", "app/http/validators/signup.ts"],
		["job", "trials/expire", "app/jobs/trials/expire.ts"],
		["model", "post", "app/models/post.ts"],
		["service", "billing/charge", "app/services/billing/charge.ts"],
		["policy", "can-edit", "app/policies/can-edit.ts"],
		["initializer", "cache", "app/initializers/cache.ts"],
		["email", "welcome", "app/emails/welcome.tsx"],
		["mcp", "get-post", "app/mcp/tools/get-post.ts"],
	])("%s writes %s and its test", async (kind, name, path) => {
		let root = await project();

		let result = await invoke([kind, name], root);

		let test = path.replace(/(\.tsx?)$/, ".test$1");
		expect(result).toEqual({ code: 0, stdout: `Wrote ${path}\nWrote ${test}\n`, stderr: "" });
		expect(await files(root)).toEqual([path, test].sort());
	});

	test("factory, migration and mcp --resource write no test", async () => {
		let root = await project();

		await invoke(["factory", "post"], root);
		await invoke(["migration", "create-posts"], root);
		await invoke(["mcp", "article", "--resource", "--no-test"], root);

		expect(await files(root)).toEqual([
			"app/mcp/resources/article.ts",
			"database/factories/post.ts",
			"database/migrations/0001_CreatePosts.sql",
		]);
	});

	test("fills each placeholder, and a variant flag picks its stub", async () => {
		let root = await project();

		await invoke(["mcp", "posts/get-post", "--no-test"], root);
		await invoke(["mcp", "article", "--resource", "--no-test"], root);
		await invoke(["job", "digest", "--cron", "0 8 * * *", "--no-test"], root);

		let tool = await readFile(join(root, "app/mcp/tools/posts/get-post.ts"), "utf8");
		let resource = await readFile(join(root, "app/mcp/resources/article.ts"), "utf8");
		let job = await readFile(join(root, "app/jobs/digest.ts"), "utf8");
		expect(tool).toContain("Answers the `posts_get_post` tool");
		expect(tool).toContain('createTool(toolset.posts.getPost, () => "Get post")');
		expect(resource).toContain("Answers the `blog://article` resource");
		expect(job).toContain("The scheduled Digest job");
	});

	test("make.tests off skips tests unless --test asks for one", async () => {
		let root = await project('{ "make": { "tests": false } }');

		await invoke(["service", "charge"], root);
		await invoke(["policy", "can-edit", "--test"], root);

		expect(await files(root)).toEqual([
			".config/sdxc.jsonc",
			"app/policies/can-edit.test.ts",
			"app/policies/can-edit.ts",
			"app/services/charge.ts",
		]);
	});

	test("numbers migrations per chain and names the configured chains for an unknown one", async () => {
		let root = await project(
			'{ "make": { "migrations": { "default": "database/migrations", "tenant": "database/tenant" } } }',
		);
		await mkdir(join(root, "database/migrations"), { recursive: true });
		await writeFile(join(root, "database/migrations/0007-init.sql"), "");

		await invoke(["migration", "AddTags"], root);
		await invoke(["migration", "add-tags", "--chain", "tenant"], root);
		let unknown = await invoke(["migration", "x", "--chain", "audit"], root);

		expect(await files(root)).toContain("database/migrations/0008_AddTags.sql");
		expect(await files(root)).toContain("database/tenant/0001_AddTags.sql");
		expect(unknown).toEqual({
			code: 1,
			stdout: "",
			stderr: 'No migration chain "audit" in make.migrations; configured: default, tenant\n',
		});
	});

	test("refuses to overwrite the file or its test, writing neither", async () => {
		let root = await project();
		await mkdir(join(root, "app/services"), { recursive: true });
		await writeFile(join(root, "app/services/charge.test.ts"), "kept");

		let result = await invoke(["service", "charge"], root);

		expect(result).toEqual({
			code: 1,
			stdout: "",
			stderr: "app/services/charge.test.ts already exists; sdxc make leaves it as it is\n",
		});
		expect(await files(root)).toEqual(["app/services/charge.test.ts"]);
	});

	test("a project stub replaces the built-in one; an unknown placeholder names the stub", async () => {
		let root = await project();
		await mkdir(join(root, ".config/sdxc/stubs"), { recursive: true });
		await writeFile(join(root, ".config/sdxc/stubs/service.stub"), "export const {{key}} = 1;\n");
		await writeFile(join(root, ".config/sdxc/stubs/policy.stub"), "{{nmae}}\n");

		await invoke(["service", "charge", "--no-test"], root);
		let typo = await invoke(["policy", "can-edit", "--no-test"], root);

		expect(await readFile(join(root, "app/services/charge.ts"), "utf8")).toBe(
			"export const charge = 1;\n",
		);
		expect(typo.code).toBe(1);
		expect(typo.stderr).toMatch(
			/^\.config\/sdxc\/stubs\/policy\.stub uses \{\{nmae\}\}, which this kind does not define; it accepts \{\{name\}\}/,
		);
	});

	test("stubs copies the built-in stubs of the given kinds and keeps edited ones", async () => {
		let root = await project();
		await mkdir(join(root, ".config/sdxc/stubs"), { recursive: true });
		await writeFile(join(root, ".config/sdxc/stubs/job.stub"), "mine");

		let result = await invoke(["stubs", "job"], root);

		expect(result.stdout).toBe(
			[
				"Wrote .config/sdxc/stubs/job.cron.stub",
				"Wrote .config/sdxc/stubs/job.test.stub",
				"Kept .config/sdxc/stubs/job.stub, which already exists",
				"",
			].join("\n"),
		);
		expect(await readFile(join(root, ".config/sdxc/stubs/job.stub"), "utf8")).toBe("mine");
	});

	test("--dry-run prints the files and writes nothing", async () => {
		let root = await project();

		let result = await invoke(["migration", "init", "--dry-run"], root);

		expect(result.stdout).toBe(
			"Would write database/migrations/0001_Init.sql:\n\n-- Init: write the statements this migration applies, in order.\n\n",
		);
		expect(await files(root)).toEqual([]);
	});

	test("exits 2 for an unknown kind, a missing name or a flag of another kind", async () => {
		let root = await project();

		let none = await invoke([], root);
		let kind = await invoke(["widget", "x"], root);
		let name = await invoke(["job"], root);
		let flag = await invoke(["service", "x", "--cron", "* * * * *"], root);

		expect(none).toEqual({ code: 2, stdout: "", stderr: MAKE_USAGE });
		expect(kind.stderr).toBe(`Unknown kind: widget\n\n${MAKE_USAGE}`);
		expect(name.code).toBe(2);
		expect(flag.stderr).toBe(`--cron applies to sdxc make job\n\n${MAKE_USAGE}`);
	});
});

describe("generated files type check in the app template", () => {
	test("every kind without a declaration", { timeout: 120_000 }, async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		let runs = [
			["middleware", "require-user"],
			["validator", "signup"],
			["model", "post"],
			["factory", "post"],
			["migration", "create-posts"],
			["service", "billing/charge"],
			["policy", "can-edit"],
			["initializer", "cache"],
			["email", "welcome"],
		];
		for (let argv of runs) {
			let result = await invoke(argv, root);
			expect(result.stderr, argv.join(" ")).toBe("");
		}

		let checked = await typecheck(root);

		expect(checked.output).toBe("");
		expect(checked.code).toBe(0);
	});
});
