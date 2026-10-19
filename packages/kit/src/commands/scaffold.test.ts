/**
 * `sdxc scaffold` end to end: the files it writes and the declarations it makes in the app
 * template, which then type checks and passes its own tests, and the refusals and dry run that
 * leave a project as it was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke as invokeCLI } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { REGISTRY } from "../releases.js";
import {
	checkFormatting,
	materialize,
	projectExec,
	registryDocument,
	testProject,
	typecheck,
} from "../testing.js";

/** The npm registry `create` and `scaffold` pin `@sdxc/*` packages from: every one at 2026.10.14. */
const SERVER = setupServer(
	http.get(`${REGISTRY}/*`, ({ request }) =>
		HttpResponse.json(registryDocument(new URL(request.url).pathname.slice(1), ["2026.10.14"])),
	),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterAll(() => SERVER.close());

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Runs `sdxc scaffold <argv>` in `cwd`, without a terminal. */
function invoke(argv: string[], cwd: string, options: InvokeOptions = {}) {
	return invokeCLI(createSDXC(), ["scaffold", ...argv], { cwd, interactive: false, ...options });
}

/** Every file under `root`, relative to it, sorted, leaving out `node_modules`. */
async function files(root: string): Promise<string[]> {
	let entries = await readdir(root, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1))
		.filter((path) => !path.startsWith("node_modules/"))
		.sort();
}

describe("scaffold", () => {
	test(
		"writes a resource the app template type checks, formats and tests green",
		{ timeout: 300_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));

			let result = await invoke(
				[
					"post",
					"title",
					"body",
					"views:integer",
					"published",
					"publishedOn",
					"starts_at",
					"contact_email",
					"website",
					"subtitle?",
					"rating?:integer",
					"ends_at?",
					"--mcp",
					"--command",
				],
				root,
				{ exec: projectExec(root) },
			);

			expect(result.stderr).toMatch(/Formatting \d+ files/);
			expect(result.code).toBe(0);
			expect(result.stdout).not.toContain("by hand");
			let read = (path: string) => readFile(join(root, path), "utf8");
			expect(await files(join(root, "app/http/controllers/posts"))).toEqual([
				"destroy.test.tsx",
				"destroy.tsx",
				"edit.test.tsx",
				"edit.tsx",
				"index.test.tsx",
				"index.tsx",
				"new.test.tsx",
				"new.tsx",
				"show.test.tsx",
				"show.tsx",
			]);
			expect(await read("database/migrations/0001_CreatePosts.sql")).toContain(
				'CREATE TABLE "posts" (',
			);
			expect(await read("app/models/index.ts")).toContain('post: () => import("./post"),');
			let routes = await read("routes/web.ts");
			expect(routes).toContain('index: get("/posts"),');
			expect(routes).toContain('new: form("/posts/new"),');
			expect(routes).toContain('show: get("/posts/:id"),');
			expect(routes).toContain('edit: form("/posts/:id/edit"),');
			expect(routes).toContain('destroy: post("/posts/:id/destroy"),');
			let sitemap = await read("app/http/controllers/sitemap.ts");
			expect(sitemap).toMatch(
				/posts: \{\s+index: true,\s+new: false,\s+show: \[\],\s+edit: false,/,
			);
			let tools = await read("app/mcp/tools/index.ts");
			expect(tools).toContain('create: tool("create_post", {');
			expect(tools).toContain("title: s.optional(s.string()),");
			expect(tools).toContain("subtitle: s.nullable(s.string()),");
			let commands = await read("app/commands/index.ts");
			expect(commands).toContain('show: command({\n\t\t\tdescription: "Print one post as JSON",');
			expect(commands).toContain(
				'publishedOn: flag.string("published-on", { required: true, description: "Published on" }),',
			);
			expect(commands).toContain('startsAt: flag.number("starts-at", {');
			expect(commands).toContain('subtitle: flag.string("subtitle", { description: "Subtitle" }),');
			let form = await read("resources/views/posts/form.tsx");
			expect(form).toContain('type="datetime-local"');
			expect(form).toContain('type="email"');
			expect(form).toContain('type="url"');
			let locale = JSON.parse(await read("resources/locales/en.json")) as Record<string, unknown>;
			expect(locale.posts).toMatchObject({ index: { title: "Posts" }, fields: { body: "Body" } });

			let checked = await typecheck(root);
			expect(checked.output).toContain("Found no type errors");
			expect(checked.code).toBe(0);
			let formatted = await checkFormatting(root);
			expect(formatted.output).not.toContain("Format issues found");
			let tested = await testProject(root);
			expect(tested.output).toMatch(/Tests {2}\d+ passed \(\d+\)/);
			expect(tested.code).toBe(0);
		},
	);

	test("--dry-run prints every file and edit and writes nothing", { timeout: 60_000 }, async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		let before = await files(root);

		let result = await invoke(["post", "title", "--dry-run"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Would write app/models/post.ts:");
		expect(result.stdout).toContain("Would write app/http/controllers/posts/edit.tsx:");
		expect(result.stdout).toContain('+\t\tindex: get("/posts"),');
		expect(result.stdout).toContain("+++ b/resources/locales/en.json");
		expect(await files(root)).toEqual(before);
	});

	test("refuses a taken name, writing nothing", { timeout: 60_000 }, async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		await mkdir(join(root, "app/http/validators"), { recursive: true });
		await writeFile(join(root, "app/http/validators/post.ts"), "export {};\n");
		let before = await files(root);
		let routes = await readFile(join(root, "routes/web.ts"), "utf8");

		let result = await invoke(["post", "title"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("app/http/validators/post.ts already exists");
		expect(await files(root)).toEqual(before);
		expect(await readFile(join(root, "routes/web.ts"), "utf8")).toBe(routes);
	});

	test("make stubs scaffold copies its stubs, and a project stub replaces the built-in one", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-scaffold-"));
		DIRECTORIES.push(root);
		await writeFile(join(root, "package.json"), '{ "name": "blog" }\n');

		let copied = await invokeCLI(createSDXC(), ["make", "stubs", "scaffold"], {
			cwd: root,
			interactive: false,
		});
		await writeFile(join(root, ".config/sdxc/stubs/scaffold.policy.stub"), "{{nope}}\n");
		let result = await invoke(["post", "title"], root);

		expect(copied.code).toBe(0);
		expect(copied.stdout).toContain("Wrote .config/sdxc/stubs/scaffold.controller.index.stub");
		expect(copied.stdout).not.toContain("stubs/model.stub");
		expect(result.code).toBe(1);
		expect(result.stderr).toContain(".config/sdxc/stubs/scaffold.policy.stub uses {{nope}}");
		expect((await files(root)).filter((path) => !path.startsWith(".config/"))).toEqual([
			"package.json",
		]);
	});

	test("refuses an unknown field type, a name with folders, a reference and only optional fields", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-scaffold-"));
		DIRECTORIES.push(root);
		await writeFile(join(root, "package.json"), '{ "name": "blog" }\n');

		let unknown = await invoke(["post", "title:varchar"], root);
		let nested = await invoke(["admin/post", "title"], root);
		let empty = await invoke(["post"], root);
		let reference = await invoke(["comment", "post_id", "body"], root);
		let optional = await invoke(["post", "subtitle?"], root);

		expect(unknown.code).toBe(1);
		expect(unknown.stderr).toContain('"varchar" in "title:varchar" is not a field type');
		expect(nested.stderr).toContain("A scaffold name cannot hold folders: admin/post");
		expect(empty.stderr).toContain("at least one field");
		expect(reference.stderr).toContain("post_id is a reference");
		expect(optional.stderr).toContain("at least one field without ?");
		expect(await files(root)).toEqual(["package.json"]);
	});
});
