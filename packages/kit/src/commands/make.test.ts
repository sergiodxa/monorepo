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

import type { Exec } from "@sdxc/cli";
import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke as invokeCLI } from "@sdxc/cli/test";
import { success, unwrap } from "@sdxc/result";
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
	runCommandLine,
	testProject,
	typecheck,
} from "../testing.js";

/** The npm registry `create` and `make` pin `@sdxc/*` packages from: every one at 2026.10.14. */
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

/** A project whose router maps `routes/web.ts` and whose sitemap decides it with `fromRoutes`. */
async function sitemapProject(): Promise<string> {
	let root = await project();
	await mkdir(join(root, "routes"));
	await mkdir(join(root, "app/initializers"), { recursive: true });
	await mkdir(join(root, "app/http/controllers"), { recursive: true });
	await writeFile(
		join(root, "routes/web.ts"),
		'import { get, route } from "remix/routes";\n\nexport default route({\n\thome: get("/"),\n\tadmin: route("/admin", {}),\n});\n',
	);
	await writeFile(
		join(root, "app/initializers/router.ts"),
		'import { createRouter } from "remix/router";\n\nimport routes from "~/routes/web";\n\nexport let router = createRouter();\n',
	);
	await writeFile(
		join(root, "app/http/controllers/sitemap.ts"),
		'import { fromRoutes } from "@sdxc/sitemap/remix";\n\nimport routes from "~/routes/web";\n\nexport let sitemap = fromRoutes(routes, "https://example.com", {\n\thome: true,\n\tadmin: false,\n});\n',
	);
	return root;
}

/** Runs `sdxc make <argv>` in `cwd`, without a terminal unless `options` scripts answers. */
function invoke(argv: string[], cwd: string, options: InvokeOptions = {}) {
	return invokeCLI(createSDXC(), ["make", ...argv], { cwd, interactive: false, ...options });
}

/**
 * An exec under which the template's `format` command succeeds and leaves every file as `make`
 * wrote it, for the tests that read the exact text of a declaration or a mapping.
 */
const UNFORMATTED: Exec = async () => success({ code: 0, stdout: "", stderr: "", output: "" });

/** All `make` prints on stderr when the configured `format` command succeeds. */
const FORMATTED = /^Formatting \d+ files?\n✓ Formatting \d+ files?\n$/;

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
		["controller", "sponsors", "app/http/controllers/sponsors.tsx", "spec/sponsors.spec"],
		["middleware", "require-user", "app/http/middleware/require-user.ts", null],
		["validator", "signup", "app/http/validators/signup.ts", null],
		["job", "trials/expire", "app/jobs/trials/expire.ts", null],
		["service", "billing/charge", "app/services/billing/charge.ts", null],
		["initializer", "cache", "app/initializers/cache.ts", null],
		["email", "welcome", "app/emails/welcome.tsx", null],
		["mcp", "get-post", "app/mcp/tools/get-post.ts", "spec/mcp/get-post.spec"],
		["command", "users/grant", "app/commands/users/grant.ts", "spec/commands/users/grant.spec"],
	])("%s writes %s and its test", async (kind, name, path, spec) => {
		let root = await project();

		let result = await invoke([kind, name], root);

		let test = path.replace(/(\.tsx?)$/, ".test$1");
		let written = [path, test, ...(spec === null ? [] : [spec])];
		expect(result.code).toBe(0);
		expect(result.stdout.startsWith(written.map((file) => `Wrote ${file}\n`).join(""))).toBe(true);
		expect(await files(root)).toEqual(written.sort());
	});

	test("controller api stub pairs with an http .spec", async () => {
		let root = await project();

		let result = await invoke(["controller", "keys", "--routes", "api", "--no-test"], root);

		expect(result.code).toBe(0);
		expect(await files(root)).toEqual(["app/http/controllers/keys.tsx", "spec/keys.spec"]);
		expect(await readFile(join(root, "spec/keys.spec"), "utf8")).toContain("use http");
	});

	test("make.specs off skips the pairing .spec unless --spec asks for one", async () => {
		let root = await project('{ "make": { "specs": false } }');

		await invoke(["controller", "about", "--no-test"], root);
		expect(await files(root)).toEqual([".config/sdxc.jsonc", "app/http/controllers/about.tsx"]);

		await invoke(["controller", "contact", "--no-test", "--spec"], root);
		expect(await files(root)).toEqual([
			".config/sdxc.jsonc",
			"app/http/controllers/about.tsx",
			"app/http/controllers/contact.tsx",
			"spec/contact.spec",
		]);
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

	test("model writes the model, its test, the migration creating its table and its factory", async () => {
		let root = await project();

		let result = await invoke(["model", "post"], root);

		expect(result.code).toBe(0);
		expect(await files(root)).toEqual([
			"app/models/post.test.ts",
			"app/models/post.ts",
			"database/factories/post.ts",
			"database/migrations/0001_CreatePosts.sql",
		]);
		expect(await readFile(join(root, "app/models/post.ts"), "utf8")).toContain('name: "posts",');
		expect(
			await readFile(join(root, "database/migrations/0001_CreatePosts.sql"), "utf8"),
		).toContain('CREATE TABLE "posts" (\n  "id" TEXT PRIMARY KEY NOT NULL,');
		expect(await readFile(join(root, "database/factories/post.ts"), "utf8")).toContain(
			"defineFactory(Post, {});",
		);
	});

	test.each([[["--skip", "migration", "--skip", "factory"]], [["--skip", "migration,factory"]]])(
		"model %j writes the model alone",
		async (skip) => {
			let root = await project();

			let result = await invoke(["model", "post", "--no-test", ...skip], root);

			expect(result.code).toBe(0);
			expect(await files(root)).toEqual(["app/models/post.ts"]);
		},
	);

	test("model refuses a taken migration or factory path, writing nothing", async () => {
		let root = await project();
		await mkdir(join(root, "database/factories"), { recursive: true });
		await writeFile(join(root, "database/factories/post.ts"), "mine");

		let result = await invoke(["model", "post", "title"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("database/factories/post.ts already exists");
		expect(await files(root)).toEqual(["database/factories/post.ts"]);
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

	test("--resource guards the controller with the ability its method implies", async () => {
		let root = await project();
		await mkdir(join(root, "app/models"), { recursive: true });
		await writeFile(
			join(root, "app/models/post.ts"),
			"export type PostRow = { id: string; title: string };\n",
		);

		let show = await invoke(["controller", "posts/show", "--resource", "post"], root, {
			exec: UNFORMATTED,
		});
		await invoke(
			["controller", "posts/archive", "--resource", "post", "--method", "delete"],
			root,
			{
				exec: UNFORMATTED,
			},
		);
		await invoke(["controller", "posts/new", "--resource", "post", "--method", "form"], root, {
			exec: UNFORMATTED,
		});
		await invoke(
			[
				"controller",
				"invoices",
				"--resource",
				"billing/invoice",
				"--method",
				"put",
				"--routes",
				"api",
			],
			root,
			{ exec: UNFORMATTED },
		);

		let read = (path: string) => readFile(join(root, path), "utf8");
		let page = await read("app/http/controllers/posts/show.tsx");
		expect(page).toContain('import abilities from "~/app/policies/abilities";');
		expect(page).toContain(
			[
				"\tasync handler(ctx) {",
				"\t\tlet row = await ctx.models.post.find(ctx.params.id);",
				"\t\tif (row === null || !ctx.access.can(abilities.post.read, { post: row })) {",
				'\t\t\tlet missing = ctx.intl.t("notFound.title");',
			].join("\n"),
		);
		expect(page).toContain("\t\t\t\t{ status: 404 },\n\t\t\t);\n\t\t}\n\t\treturn ctx.render(");
		expect(show.stdout).toContain('  show: get("/posts/show/:id"),');
		expect(show.stdout).toContain(
			"app/policies/abilities.ts declares no post abilities yet; run sdxc make policy post so post.read exists\n",
		);
		expect(await read("app/http/controllers/posts/show.test.tsx")).toContain(
			'test.todo("answers the Show page");',
		);

		let archive = await read("app/http/controllers/posts/archive.tsx");
		expect(archive).toContain(
			[
				"\t\tif (row === null || !ctx.access.can(abilities.post.read, { post: row })) {",
				"\t\t\tlet missing",
			].join("\n"),
		);
		expect(archive).toContain(
			"\t\tif (!ctx.access.can(abilities.post.delete, { post: row })) {\n\t\t\treturn new Response(null, { status: 403 });\n\t\t}",
		);

		let form = await read("app/http/controllers/posts/new.tsx");
		expect(form).toContain(
			"\t\tasync index(ctx) {\n\t\t\tif (!ctx.access.can(abilities.post.create)) {\n\t\t\t\treturn new Response(null, { status: 403 });\n\t\t\t}\n",
		);
		expect(form).toContain(
			"\t\t\tasync handler(ctx) {\n\t\t\t\tif (!ctx.access.can(abilities.post.create)) {",
		);
		expect(form).not.toContain("ctx.params.id");

		let endpoint = await read("app/http/controllers/invoices.tsx");
		expect(endpoint).toContain("middleware: api,");
		expect(endpoint).toContain(
			[
				"\t\tlet row = { id: ctx.params.id };",
				"\t\tif (!ctx.access.can(abilities.billing.invoice.read, { invoice: row })) {",
				"\t\t\treturn new Response(null, { status: 404 });",
				"\t\t}",
				"\t\tif (!ctx.access.can(abilities.billing.invoice.update, { invoice: row })) {",
			].join("\n"),
		);
		expect(await read("app/http/controllers/invoices.test.tsx")).toContain(
			'test.todo("answers Invoices as JSON");',
		);
	});

	test("--resource refuses a row check on a --path without :id, writing nothing", async () => {
		let root = await project();

		let result = await invoke(
			["controller", "posts/show", "--resource", "post", "--path", "/posts/show/"],
			root,
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"--resource post checks post.read against one post, so the route needs an :id param; pass a --path holding one, such as /posts/show/:id",
		);
		expect(await files(root)).toEqual([]);
	});

	test("--resource prints no note once the catalog declares the resource", async () => {
		let root = await project();
		await mkdir(join(root, "app/policies"), { recursive: true });
		await writeFile(
			join(root, "app/policies/abilities.ts"),
			'import { abilities, ability } from "@sdxc/authz";\n\nexport default abilities({\n\tbilling: { invoice: { create: ability() } },\n});\n',
		);

		let declared = await invoke(
			[
				"controller",
				"invoices/new",
				"--resource",
				"billing/invoice",
				"--method",
				"post",
				"--dry-run",
			],
			root,
		);
		let missing = await invoke(
			["controller", "posts/new", "--resource", "post", "--method", "post", "--dry-run"],
			root,
		);

		expect(declared.code).toBe(0);
		expect(declared.stdout).toContain("if (!ctx.access.can(abilities.billing.invoice.create)) {");
		expect(declared.stdout).not.toContain("make policy");
		expect(missing.stdout).toContain("run sdxc make policy post so post.create exists");
	});

	test("make.tests off skips tests unless --test asks for one", async () => {
		let root = await project('{ "make": { "tests": false } }');

		await invoke(["service", "charge"], root);
		await invoke(["policy", "post", "--test"], root);

		expect(await files(root)).toEqual([
			".config/sdxc.jsonc",
			"app/policies/post.test.ts",
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

		expect(await files(root)).toContain("database/migrations/0008-add-tags.sql");
		expect(await files(root)).toContain("database/tenant/0001_AddTags.sql");
		expect(unknown).toMatchObject({
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

		expect(result).toMatchObject({
			code: 1,
			stdout: "",
			stderr:
				"app/services/charge.test.ts already exists; sdxc make leaves it as it is unless --force\n",
		});
		expect(await files(root)).toEqual(["app/services/charge.test.ts"]);
	});

	test("--force replaces the file and its test from the stub", async () => {
		let root = await project();
		await mkdir(join(root, "app/services"), { recursive: true });
		await writeFile(join(root, "app/services/charge.test.ts"), "edited");

		let result = await invoke(["service", "charge", "--force"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain(
			"Wrote app/services/charge.ts\nReplaced app/services/charge.test.ts\n",
		);
		expect(await readFile(join(root, "app/services/charge.test.ts"), "utf8")).not.toBe("edited");
	});

	test("--force keeps the declaration and mapping an existing controller has", async () => {
		let root = await sitemapProject();
		await invoke(["controller", "about"], root);
		let routes = await readFile(join(root, "routes/web.ts"), "utf8");
		let router = await readFile(join(root, "app/initializers/router.ts"), "utf8");
		await writeFile(join(root, "app/http/controllers/about.tsx"), "edited");

		let result = await invoke(["controller", "about", "--force"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Replaced app/http/controllers/about.tsx\n");
		expect(result.stdout).toContain("Kept the declaration, mapping and mount about already has");
		expect(await readFile(join(root, "routes/web.ts"), "utf8")).toBe(routes);
		expect(await readFile(join(root, "app/initializers/router.ts"), "utf8")).toBe(router);
		expect(await readFile(join(root, "app/http/controllers/about.tsx"), "utf8")).not.toBe("edited");
	});

	test("--force keeps the abilities and grants a policy already has", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		await invoke(["policy", "post"], root, { exec: UNFORMATTED });
		let abilities = await readFile(join(root, "app/policies/abilities.ts"), "utf8");
		let policy = await readFile(join(root, "app/policies/policy.ts"), "utf8");
		await writeFile(join(root, "app/policies/post.test.ts"), "edited");

		let result = await invoke(["policy", "post", "--force"], root, { exec: UNFORMATTED });

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Replaced app/policies/post.test.ts\n");
		expect(result.stdout).toContain("Kept the declaration, mapping and mount post already has");
		expect(result.stdout).not.toContain("by hand");
		expect(await readFile(join(root, "app/policies/abilities.ts"), "utf8")).toBe(abilities);
		expect(await readFile(join(root, "app/policies/policy.ts"), "utf8")).toBe(policy);
	});

	test("--force on an existing model writes no second migration", async () => {
		let root = await project();
		await invoke(["model", "post", "title"], root);

		let result = await invoke(["model", "post", "title", "body", "--force"], root);

		expect(result.code).toBe(0);
		let migrations = (await files(root)).filter((path) => path.startsWith("database/migrations/"));
		expect(migrations).toHaveLength(1);
		expect(await readFile(join(root, "app/models/post.ts"), "utf8")).toContain("body");
		expect(result.stdout.trimEnd().split("\n").at(-1)).toBe(
			"Wrote no migration, since the model existed; add its new columns with sdxc make migration add-<columns>-to-posts",
		);
	});

	test("a project stub replaces the built-in one; an unknown placeholder names the stub", async () => {
		let root = await project();
		await mkdir(join(root, ".config/sdxc/stubs"), { recursive: true });
		await writeFile(join(root, ".config/sdxc/stubs/service.stub"), "export const {{key}} = 1;\n");
		await writeFile(join(root, ".config/sdxc/stubs/validator.stub"), "{{nmae}}\n");

		await invoke(["service", "charge", "--no-test"], root);
		let typo = await invoke(["validator", "signup", "--no-test"], root);

		expect(await readFile(join(root, "app/services/charge.ts"), "utf8")).toBe(
			"export const charge = 1;\n",
		);
		expect(typo.code).toBe(1);
		expect(typo.stderr).toMatch(
			/^\.config\/sdxc\/stubs\/validator\.stub uses \{\{nmae\}\}, which this kind does not define; it accepts \{\{name\}\}/,
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
		let dryStubs = await invoke(["stubs", "--dry-run"], root);

		expect(none).toMatchObject({ code: 2, stdout: "" });
		expect(none.stderr).toMatch(
			/^<kind> is required when stdin is not a terminal\n<name> is required when stdin is not a terminal\n\nUsage: sdxc make <command> \[options\]/,
		);
		expect(none.stderr).toContain("  controller   A route handler in app/http/controllers");
		expect(kind.stderr).toMatch(/^Unknown command "widget" for sdxc make\n/);
		expect(name.code).toBe(2);
		expect(name.stderr).toMatch(/^<name> is required when stdin is not a terminal\n/);
		expect(flag.stderr).toMatch(
			/^--cron is not a flag of sdxc make service; sdxc make job takes it\n\n/,
		);
		expect(flag.stderr).not.toContain("Unexpected argument");
		expect(dryStubs.code).toBe(2);
		expect(await files(root)).toEqual([]);
	});

	test("reads the flags written before the kind, and a kind and name given to make alone", async () => {
		let root = await project();

		let before = await invoke(["--dry-run", "job", "digest"], root);
		let positional = await invoke(["--no-test", "--dry-run"], root, {
			interactive: true,
			answers: { kind: "model", name: "post" },
		});

		expect(before.code).toBe(0);
		expect(before.stdout).toContain("app/jobs/digest.ts");
		expect(positional.code).toBe(0);
		expect(positional.stdout).toContain("app/models/post.ts");
		expect(positional.stdout).not.toContain("post.test.ts");
		expect(await files(root)).toEqual([]);
	});

	test("on a terminal, asks for the kind, the name and a controller's method", async () => {
		let root = await project();

		let asked = await invoke([], root, {
			interactive: true,
			answers: { kind: "controller", name: "ping", method: "post" },
		});
		let named = await invoke(["job"], root, { interactive: true, answers: { name: "digest" } });
		let method = await invoke(["controller", "admin/users", "--no-test"], root, {
			interactive: true,
			answers: { method: "form" },
		});

		expect(asked.code).toBe(0);
		expect(asked.stderr).toBe(
			[
				"✓ What should sdxc make? controller",
				"✓ What should it be called? ping",
				"✓ Which method? post",
				"",
			].join("\n"),
		);
		expect(asked.stdout).toContain('  ping: post("/ping"),');
		expect(named.stderr).toBe("✓ What should the job be called? digest\n");
		expect(method.stdout).toContain('form("/admin/users")');
		expect(await files(root)).toEqual([
			"app/http/controllers/admin/users.tsx",
			"app/http/controllers/ping.test.tsx",
			"app/http/controllers/ping.tsx",
			"app/jobs/digest.test.ts",
			"app/jobs/digest.ts",
			"spec/admin/users.spec",
			"spec/ping.spec",
		]);
	});
});

describe("make controller --actions", () => {
	test("writes a page per action under the name, routed as scaffold routes them", async () => {
		let root = await sitemapProject();

		let result = await invoke(["controller", "posts", "--actions", "all"], root, {
			exec: UNFORMATTED,
		});

		expect(result.code).toBe(0);
		let pages = (await files(root)).filter(
			(path) => path.startsWith("app/http/controllers/posts/") && !path.includes(".test."),
		);
		expect(pages).toEqual(
			["destroy", "edit", "index", "new", "show"].map(
				(action) => `app/http/controllers/posts/${action}.tsx`,
			),
		);
		let routes = await readFile(join(root, "routes/web.ts"), "utf8");
		expect(routes).toContain('"/posts/:id/edit"');
		expect(routes).toContain('"/posts/:id/destroy"');
	});

	test("guards each action with the ability it needs and leaves the list to filter rows", async () => {
		let root = await sitemapProject();

		let result = await invoke(
			["controller", "posts", "--actions", "edit,destroy,index", "--resource", "post"],
			root,
			{ exec: UNFORMATTED },
		);

		expect(result.code).toBe(0);
		let read = (action: string) =>
			readFile(join(root, `app/http/controllers/posts/${action}.tsx`), "utf8");
		expect(await read("edit")).toContain("abilities.post.update");
		expect(await read("destroy")).toContain("abilities.post.delete");
		expect(await read("index")).not.toContain("abilities.post");
		expect(result.stdout).toContain("posts/index lists rows, so it checks no single one");
	});

	test("a form route with params passes them to every href, and its test passes sample ones", async () => {
		let root = await sitemapProject();

		await invoke(
			["controller", "posts/edit", "--method", "form", "--path", "/posts/:id/edit"],
			root,
			{ exec: UNFORMATTED },
		);

		let page = await readFile(join(root, "app/http/controllers/posts/edit.tsx"), "utf8");
		let test = await readFile(join(root, "app/http/controllers/posts/edit.test.tsx"), "utf8");
		expect(page).toContain("routes.posts.edit.action.href(ctx.params)");
		expect(page).toContain("routes.posts.edit.index.href(ctx.params)");
		expect(test).toContain('routes.posts.edit.action.href({ id: "1" })');
	});

	test("refuses --method or --path beside it, and an action the contract lacks", async () => {
		let root = await sitemapProject();

		let method = await invoke(
			["controller", "posts", "--actions", "all", "--method", "post"],
			root,
		);
		let api = await invoke(["controller", "posts", "--actions", "new", "--routes", "api"], root);

		expect(method.code).toBe(2);
		expect(method.stderr).toContain("drop --method and --path");
		expect(api.code).toBe(1);
		expect(api.stderr).toContain("new is not an action of the api contract");
		expect(await files(root)).not.toContain("app/http/controllers/posts/index.tsx");
	});
});

describe("field modifiers", () => {
	test("make model writes a unique column and the indexes its migration creates", async () => {
		let root = await project();

		await invoke(["model", "post", "slug:unique", "rank:index"], root);

		let model = await readFile(join(root, "app/models/post.ts"), "utf8");
		let [migration = ""] = (await files(root)).filter((path) => path.endsWith(".sql"));
		let sql = await readFile(join(root, migration), "utf8");
		expect(model).toContain("slug: c.text().unique(),");
		expect(sql).toContain('CREATE UNIQUE INDEX "posts_slug_unique" ON "posts" ("slug");');
		expect(sql).toContain('CREATE INDEX "posts_rank_index" ON "posts" ("rank");');
	});

	test("make migration adds a column with its index", async () => {
		let root = await project();
		await invoke(["migration", "create-posts", "title"], root);

		await invoke(["migration", "add-slug-to-posts", "slug?:unique", "code?:index"], root);

		let [, added = ""] = (await files(root)).filter((path) => path.endsWith(".sql"));
		let sql = await readFile(join(root, added), "utf8");
		expect(sql).toContain('ALTER TABLE "posts" ADD COLUMN "slug" TEXT;');
		expect(sql).toContain('CREATE UNIQUE INDEX "posts_slug_unique" ON "posts" ("slug");');
		expect(sql).toContain('CREATE INDEX "posts_code_index" ON "posts" ("code");');
	});
});

describe("skipped pieces", () => {
	test("make model --skip says what it left out, after every path it wrote", async () => {
		let root = await project();

		let result = await invoke(["model", "post", "title", "--skip", "migration,factory"], root);

		expect(result.code).toBe(0);
		expect(result.stdout.trimEnd().split("\n").at(-1)).toBe(
			"Wrote no migration or factory, as --skip asked",
		);
	});
});

describe("make test", () => {
	test("writes the test a kind gets beside an existing file that has none", async () => {
		let root = await project();
		await invoke(["service", "billing/charge", "--no-test"], root);

		let result = await invoke(["test", "app/services/billing/charge.ts"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Wrote app/services/billing/charge.test.ts\n");
		let written = await readFile(join(root, "app/services/billing/charge.test.ts"), "utf8");
		expect(written).toContain("~/app/services/billing/charge");
	});

	test("refuses a test that exists unless --force replaces it", async () => {
		let root = await project();
		await invoke(["validator", "signup"], root);
		await writeFile(join(root, "app/http/validators/signup.test.ts"), "edited");

		let refused = await invoke(["test", "app/http/validators/signup.ts"], root);
		let forced = await invoke(["test", "app/http/validators/signup.ts", "--force"], root);

		expect(refused).toMatchObject({ code: 1 });
		expect(refused.stderr).toContain("signup.test.ts already exists");
		expect(forced.stdout).toContain("Replaced app/http/validators/signup.test.ts\n");
		expect(await readFile(join(root, "app/http/validators/signup.test.ts"), "utf8")).not.toBe(
			"edited",
		);
	});

	test("takes a form controller's route and stub from the router that maps it", async () => {
		let root = await sitemapProject();
		await invoke(["controller", "contact", "--method", "form", "--no-test"], root, {
			exec: UNFORMATTED,
		});

		let result = await invoke(["test", "app/http/controllers/contact.tsx"], root, {
			exec: UNFORMATTED,
		});

		expect(result.code).toBe(0);
		let written = await readFile(join(root, "app/http/controllers/contact.test.tsx"), "utf8");
		expect(written).toContain("routes.contact.action.href()");
	});

	test("names why a file gets no test, and a missing file", async () => {
		let root = await project();
		await mkdir(join(root, "database/migrations"), { recursive: true });
		await writeFile(join(root, "database/migrations/0001_CreatePosts.sql"), "");
		await mkdir(join(root, "lib"), { recursive: true });
		await writeFile(join(root, "lib/odd.ts"), "");

		let migration = await invoke(["test", "database/migrations/0001_CreatePosts.sql"], root);
		let outside = await invoke(["test", "lib/odd.ts"], root);
		let missing = await invoke(["test", "app/services/nothing.ts"], root);

		expect(migration.stderr).toContain("gets no test from sdxc make test: a migration has no test");
		expect(outside.stderr).toContain("lib/odd.ts is in no folder sdxc make writes tests for");
		expect(missing.stderr).toBe(
			"app/services/nothing.ts does not exist; sdxc make test writes a test for a file\n",
		);
	});
});

describe("formatting", () => {
	test(
		"the app template's own check passes on the files make writes and edits",
		{ timeout: 120_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));
			let exec = projectExec(root);

			let controller = await invoke(["controller", "posts/show"], root, { exec });
			let tool = await invoke(["mcp", "search-posts"], root, { exec });
			let checked = await checkFormatting(root);

			expect(checked.output).not.toContain("Format issues found");
			expect(checked.code).toBe(0);
			expect(controller.stderr).toMatch(FORMATTED);
			expect(tool.stderr).toMatch(FORMATTED);
			expect(controller.exec.map((call) => call.command.slice(0, 3))).toEqual([
				["bunx", "vp", "fmt"],
			]);
		},
	);

	test("a migration alone, which the template's formatter skips, exits 0", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));

		let result = await invoke(["migration", "add-tags"], root, { exec: projectExec(root) });

		expect(result.stderr).toContain("✓ Formatting 1 file\n");
		expect(result.code).toBe(0);
	});
});

describe("declaring and mapping", () => {
	test(
		"a job, controller, tool, resource and command are declared, mapped and type check in the app template, a command reading ctx.models",
		{ timeout: 120_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));
			let runs = [
				["job", "trials/expire"],
				["job", "digest", "--cron", "0 8 * * *"],
				["controller", "sponsors"],
				["controller", "admin/users", "--method", "form"],
				["controller", "ping", "--method", "post", "--path", "/ping"],
				["controller", "api/keys", "--routes", "api"],
				["mcp", "get-post"],
				["mcp", "article", "--resource"],
				["middleware", "require-user"],
				["validator", "signup"],
				["model", "post", "title", "body", "published_at", "is_featured", "author_id?"],
				["migration", "add-slug-to-posts", "slug?", "pinned"],
				["service", "billing/charge"],
				["policy", "post"],
				["controller", "posts/show", "--resource", "post"],
				["controller", "posts/archive", "--resource", "post", "--method", "delete"],
				["controller", "posts/new", "--resource", "post", "--method", "form"],
				["controller", "api/posts", "--routes", "api", "--resource", "post", "--method", "patch"],
				["controller", "articles", "--actions", "all", "--resource", "post"],
				["controller", "api/articles", "--actions", "all", "--routes", "api", "--resource", "post"],
				["initializer", "cache"],
				["email", "welcome"],
				["command", "users/grant"],
				["command", "users/send-digest"],
				["command", "reports/daily/send"],
			];
			for (let argv of runs) {
				let result = await invoke(argv, root, { exec: UNFORMATTED });
				expect(result.stderr, argv.join(" ")).toMatch(FORMATTED);
				expect(result.stdout, argv.join(" ")).not.toContain("by hand");
			}

			let read = (path: string) => readFile(join(root, path), "utf8");
			let jobs = await read("app/jobs/index.ts");
			let dispatcher = await read("app/initializers/dispatcher.ts");
			let routes = await read("routes/web.ts");
			let api = await read("routes/api.ts");
			let router = await read("app/initializers/router.tsx");
			let tools = await read("app/mcp/tools/index.ts");
			let mcp = await read("app/mcp/resources/index.ts");
			let handler = await read("app/initializers/mcp.ts");
			expect(jobs).toContain('import * as s from "remix/data-schema";');
			expect(jobs).toContain("trials: {\n\t\texpire: job({ input: s.object({}) }),\n\t},");
			expect(jobs).toContain('digest: job({ cron: "0 8 * * *" }),');
			expect(await read("cloudflare.config.ts")).toContain(
				'triggers: [triggers.queue({ name: manifest.name }), triggers.scheduled({ schedule: "0 8 * * *" })],',
			);
			expect(dispatcher).toContain('import jobs from "~/app/jobs";');
			expect(dispatcher).toContain(
				'dispatcher.map(jobs.trials.expire, () => import("~/app/jobs/trials/expire"));\ndispatcher.map(jobs.digest, () => import("~/app/jobs/digest"));',
			);
			expect(routes).toContain('import { get, route, form, post, del } from "remix/routes";');
			expect(routes).toContain('sponsors: get("/sponsors"),');
			expect(routes).toContain('admin: {\n\t\tusers: form("/admin/users"),\n\t},');
			expect(routes).toContain('ping: post("/ping"),');
			expect(router).toContain(
				'router.map(webRoutes.admin.users, lazy(() => import("~/app/http/controllers/admin/users")));',
			);
			expect(api).toContain('keys: get("/api/keys"),');
			expect(router).toContain(
				'router.map(apiRoutes.api.keys, lazy(() => import("~/app/http/controllers/api/keys")));',
			);
			let page = await read("app/http/controllers/sponsors.tsx");
			let endpoint = await read("app/http/controllers/api/keys.tsx");
			expect(page).toContain("middleware: page,");
			expect(endpoint).toContain("middleware: api,");
			expect(endpoint).toContain("Response.json({})");
			expect(endpoint).not.toContain("DocumentLayout");
			expect(await read("app/http/controllers/api/keys.test.tsx")).toContain(
				'test.todo("answers Keys as JSON");',
			);
			expect(tools).toContain('getPost: tool("get_post", {');
			expect(mcp).toContain('article: resource("app://article", {');
			expect(handler).toContain('import { createHandler, lazy } from "@sdxc/mcp/server";');
			expect(handler).toContain('import toolset from "~/app/mcp/tools";');
			expect(handler).toContain(
				'mcp.tools.map(toolset.getPost, lazy(() => import("~/app/mcp/tools/get-post")));',
			);
			expect(handler).toContain(
				'mcp.resources.map(resourceset.article, lazy(() => import("~/app/mcp/resources/article")));',
			);

			expect(await read("app/models/index.ts")).toContain(
				'export default createModels({\n\tpost: () => import("./post"),\n});',
			);

			let catalog = await read("app/policies/abilities.ts");
			let policy = await read("app/policies/policy.ts");
			expect(catalog).toContain('import { abilities, ability, context } from "@sdxc/authz";');
			expect(catalog).toContain('import type { PostRow } from "~/app/models/post";');
			expect(catalog).toContain(
				'\tpost: {\n\t\tcreate: ability(),\n\t\tread: ability({ context: context<{ post: PostRow }>("post"), deniedAs: "notFound" }),',
			);
			expect(policy).toContain('import { definePolicy, fact, allow } from "@sdxc/authz";');
			expect(policy).toContain('everyone: [allow("post.read", { id: "post-read" })],');
			expect(policy).toContain(
				'member: [allow(["post.create", "post.update", "post.delete"], { id: "post-write" })]',
			);

			let commands = await read("app/commands/index.ts");
			let cli = await read("app/initializers/cli.ts");
			expect(commands).toContain(
				'\tusers: commands({\n\t\tgrant: command({ description: "Grant" }),\n\t\t"send-digest": command({ description: "Send digest" }),\n\t}),',
			);
			expect(commands).toContain(
				'\treports: commands({\n\t\tdaily: commands({\n\t\t\tsend: command({ description: "Send" }),\n\t\t}),\n\t}),',
			);
			expect(cli).toContain(
				'cli.map(commandset.users["send-digest"], lazy(() => import("~/app/commands/users/send-digest")));',
			);
			expect(await read("app/commands/users/send-digest.ts")).toContain(
				'createCommand(commandset.users["send-digest"],',
			);
			let ran = await runCommandLine(root, ["users", "send-digest"]);
			expect(ran.output).toMatch(/^Send digest\n/);
			expect(ran.code).toBe(0);

			expect(routes).toContain('show: get("/posts/show/:id"),');
			expect(routes).toContain('archive: del("/posts/archive/:id"),');
			expect(api).toContain('posts: patch("/api/posts/:id"),');
			expect(await read("app/http/controllers/posts/show.tsx")).toContain(
				"if (row === null || !ctx.access.can(abilities.post.read, { post: row })) {",
			);
			expect(await read("app/http/controllers/api/posts.tsx")).toContain(
				"if (!ctx.access.can(abilities.post.update, { post: row })) {",
			);
			let sitemap = await read("app/http/controllers/sitemap.ts");
			expect(sitemap).toContain("\t\t\tsponsors: true,\n");
			expect(sitemap).toContain("\t\t\tadmin: {\n\t\t\t\tusers: { index: true },\n\t\t\t},\n");
			expect(sitemap).not.toContain("ping");
			expect(sitemap).not.toContain("keys");
			await writeFile(
				join(root, "app/commands/users/grant.ts"),
				[
					'import { createCommand, success } from "@sdxc/cli";',
					'import commandset from "~/app/commands";',
					"export default createCommand(commandset.users.grant, async (ctx) => {",
					'\tlet post = await ctx.models.post.find("missing");',
					'\tctx.stdout(`${post === null ? "none" : post.title}\\n`);',
					"\treturn success();",
					"});",
					"",
				].join("\n"),
			);
			let checked = await typecheck(root);

			expect(checked.output).toContain("Found no type errors");
			expect(checked.code).toBe(0);
		},
	);

	test("a command name whose folder is already a command prints both edits", async () => {
		let root = await project();
		await mkdir(join(root, "app/commands"), { recursive: true });
		await mkdir(join(root, "app/initializers"), { recursive: true });
		await writeFile(
			join(root, "app/commands/index.ts"),
			'import { command, commands } from "@sdxc/cli";\n\nexport default commands({\n\tabout: command({}),\n});\n',
		);
		let initializer =
			'import { createCLI, lazy } from "@sdxc/cli";\n\nimport commandset from "~/app/commands";\n\nexport const cli = createCLI({ name: "blog", commands: commandset });\n';
		await writeFile(join(root, "app/initializers/cli.ts"), initializer);

		let result = await invoke(["command", "about/more", "--no-test", "--no-spec"], root);

		expect(result.stdout).toBe(
			[
				"Wrote app/commands/about/more.ts",
				"Added @sdxc/cli@2026.10.14 to package.json; run npm install",
				"Declare and map it by hand, since `about` is a command, not a group:",
				"In app/commands/index.ts, in commands({ … }), inside a commands({ … }) group for each of about:",
				'  more: command({ description: "More" }),',
				"In app/initializers/cli.ts:",
				'  cli.map(commandset.about.more, lazy(() => import("~/app/commands/about/more")));',
				"",
			].join("\n"),
		);
		expect(await readFile(join(root, "app/initializers/cli.ts"), "utf8")).toBe(initializer);
	});

	test("a policy in a project without a catalog writes its test and prints the edits to make", async () => {
		let root = await project();

		let result = await invoke(["policy", "billing/invoice"], root, { exec: UNFORMATTED });

		expect(await files(root)).toEqual(["app/policies/billing/invoice.test.ts"]);
		expect(result.stdout).toBe(
			[
				"Wrote app/policies/billing/invoice.test.ts",
				"Added @sdxc/authz@2026.10.14 to package.json; run npm install",
				"Declare and map it by hand, since app/policies/abilities.ts could not be read:",
				"In app/policies/abilities.ts, in abilities({ … }), under billing:",
				"  invoice: {",
				"  \tcreate: ability(),",
				'  \tread: ability({ context: context<{ invoice: { id: string } }>("invoice"), deniedAs: "notFound" }),',
				'  \tupdate: ability({ context: context<{ invoice: { id: string } }>("invoice") }),',
				'  \tdelete: ability({ context: context<{ invoice: { id: string } }>("invoice") }),',
				"  },",
				"In app/policies/policy.ts, in definePolicy(…)'s everyone:",
				'  allow("billing.invoice.read", { id: "billing-invoice-read" }),',
				"In app/policies/policy.ts, in definePolicy(…)'s roles.member:",
				'  allow(["billing.invoice.create", "billing.invoice.update", "billing.invoice.delete"], { id: "billing-invoice-write" }),',
				"",
			].join("\n"),
		);
	});

	test("policy --dry-run prints the catalog and policy edits and writes nothing", async () => {
		let root = await project();
		await mkdir(join(root, "app/policies"), { recursive: true });
		let catalog =
			'import { abilities, ability } from "@sdxc/authz";\n\nexport default abilities({\n\treports: { export: ability() },\n});\n';
		let policy =
			'import { definePolicy } from "@sdxc/authz";\n\nimport abilities from "./abilities";\n\nexport default definePolicy(abilities, {\n\troles: {\n\t\tmember: { inherits: [], grants: [] },\n\t},\n});\n';
		await writeFile(join(root, "app/policies/abilities.ts"), catalog);
		await writeFile(join(root, "app/policies/policy.ts"), policy);

		let result = await invoke(["policy", "post", "--dry-run"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Would write app/policies/post.test.ts:");
		expect(result.stdout).toContain('+import { abilities, ability, context } from "@sdxc/authz";');
		expect(result.stdout).toContain("+\tpost: {");
		expect(result.stdout).toContain('+import { definePolicy, allow } from "@sdxc/authz";');
		expect(result.stdout).toContain('+\teveryone: [allow("post.read", { id: "post-read" })],');
		expect(result.stdout).toContain(
			'allow(["post.create", "post.update", "post.delete"], { id: "post-write" })',
		);
		expect(await readFile(join(root, "app/policies/abilities.ts"), "utf8")).toBe(catalog);
		expect(await readFile(join(root, "app/policies/policy.ts"), "utf8")).toBe(policy);
		expect(await files(root)).toEqual(["app/policies/abilities.ts", "app/policies/policy.ts"]);
	});

	test(
		"a policy's test and its guarded controllers pass in the app template, typed by its model's row or by an id",
		{ timeout: 180_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));
			let exec = projectExec(root);

			for (let argv of [
				["model", "article", "title"],
				["policy", "article"],
				["policy", "billing/invoice"],
				["controller", "articles/show", "--resource", "article"],
				["controller", "invoices", "--resource", "billing/invoice", "--method", "put"],
			]) {
				let result = await invoke(argv, root, { exec });
				expect(result.code, argv.join(" ")).toBe(0);
				expect(result.stdout, argv.join(" ")).not.toContain("by hand");
			}

			let catalog = await readFile(join(root, "app/policies/abilities.ts"), "utf8");
			expect(catalog).toContain("context<{ article: ArticleRow }>");
			expect(catalog).toContain("context<{ invoice: { id: string } }>");
			expect(await readFile(join(root, "app/http/controllers/invoices.tsx"), "utf8")).toContain(
				"let row = { id: ctx.params.id };",
			);
			let checked = await typecheck(root);
			expect(checked.output).toContain("Found no type errors");
			let tested = await testProject(root);
			expect(tested.output).toMatch(/Tests {2}\d+ passed/);
			expect(tested.output).not.toContain("failed");
			expect(tested.code).toBe(0);
		},
	);

	test("a model in a project without a models registry prints the entry to add", async () => {
		let root = await project();

		let result = await invoke(["model", "post", "--no-test"], root);

		expect(result.stdout).toContain(
			[
				"Declare and map it by hand, since app/models/index.ts could not be read:",
				"In app/models/index.ts, in createModels({ … }):",
				'  post: () => import("./post"),',
			].join("\n"),
		);
	});

	test("lists an imported @sdxc package at the project's release, in the dry run too", async () => {
		SERVER.use(
			http.get(`${REGISTRY}/*`, ({ request }) =>
				HttpResponse.json(
					registryDocument(new URL(request.url).pathname.slice(1), [
						"2026.9.4",
						"2026.10.1",
						"2026.10.14",
					]),
				),
			),
		);
		let root = await project();
		let manifest =
			'{\n\t"name": "blog",\n\t"dependencies": {\n\t\t"@sdxc/cli": "2026.10.12"\n\t}\n}\n';
		await writeFile(join(root, "package.json"), manifest);
		await writeFile(join(root, "bun.lock"), "");

		let dry = await invoke(["job", "digest", "--no-test", "--dry-run"], root);
		let made = await invoke(["job", "digest", "--no-test"], root);

		expect(dry.stdout).toContain('+\t\t"@sdxc/jobs": "2026.10.1"');
		expect(made.stdout).toContain("Added @sdxc/jobs@2026.10.1 to package.json; run bun install\n");
		expect(JSON.parse(await readFile(join(root, "package.json"), "utf8"))).toEqual({
			name: "blog",
			dependencies: { "@sdxc/cli": "2026.10.12", "@sdxc/jobs": "2026.10.1" },
		});
	});

	test("reuses the group whose handlers already live in the folder", async () => {
		let root = await project();
		await mkdir(join(root, "app/jobs"), { recursive: true });
		await mkdir(join(root, "app/initializers"), { recursive: true });
		await writeFile(
			join(root, "app/jobs/index.ts"),
			'import { job, jobs } from "@sdxc/jobs";\n\nexport default jobs({\n\tactivityPub: {\n\t\tsend: job({ cron: "* * * * *" }),\n\t},\n});\n',
		);
		await writeFile(
			join(root, "app/initializers/dispatcher.ts"),
			'import { createJobDispatcher } from "@sdxc/jobs";\n\nimport jobs from "../jobs/index.js";\n\nexport const dispatcher = createJobDispatcher({});\n\ndispatcher.map(jobs.activityPub.send, () => import("../jobs/activitypub/send.js"));\n',
		);

		let result = await invoke(
			["job", "activitypub/receive", "--cron", "0 * * * *", "--no-test"],
			root,
		);

		expect(result.stdout).toBe(
			"Wrote app/jobs/activitypub/receive.ts\nEdited app/jobs/index.ts\nEdited app/initializers/dispatcher.ts\nAdded @sdxc/jobs@2026.10.14 to package.json; run npm install\n",
		);
		expect(await readFile(join(root, "app/jobs/index.ts"), "utf8")).toContain(
			'\t\tsend: job({ cron: "* * * * *" }),\n\t\treceive: job({ cron: "0 * * * *" }),\n',
		);
		expect(await readFile(join(root, "app/initializers/dispatcher.ts"), "utf8")).toContain(
			'dispatcher.map(jobs.activityPub.receive, () => import("../jobs/activitypub/receive.js"));\n',
		);
		expect(await readFile(join(root, "app/jobs/activitypub/receive.ts"), "utf8")).toContain(
			"createJobHandler(jobs.activityPub.receive,",
		);
	});

	test("a cron job's trigger is added once, and printed where the config takes no edit", async () => {
		let config = (triggers: string) =>
			`import { defineConfig, triggers } from "cf/config";\n\nexport default defineConfig({\n\tworker: {\n\t\tname: "blog",${triggers}\n\t},\n});\n`;
		let listed = await project();
		await writeFile(
			join(listed, "cloudflare.config.ts"),
			config('\n\t\ttriggers: [triggers.scheduled({ schedule: "0 9 * * 1-5" })],'),
		);
		let unlisted = await project();
		await writeFile(join(unlisted, "cloudflare.config.ts"), config(""));
		let wrangler = await project();
		await writeFile(join(wrangler, "wrangler.jsonc"), '{ "name": "blog" }\n');

		let added = await invoke(["job", "digest", "--cron", "0 8 * * *", "--no-test"], listed);
		let same = await invoke(["job", "weekdays", "--cron", "0 9 * * MON-FRI", "--no-test"], listed);
		let missing = await invoke(["job", "digest", "--cron", "0 8 * * *", "--no-test"], unlisted);
		let manual = await invoke(["job", "digest", "--cron", "0 8 * * *", "--no-test"], wrangler);

		expect(added.stdout).toContain("Edited cloudflare.config.ts\n");
		expect(await readFile(join(listed, "cloudflare.config.ts"), "utf8")).toBe(
			config(
				'\n\t\ttriggers: [triggers.scheduled({ schedule: "0 9 * * 1-5" }), triggers.scheduled({ schedule: "0 8 * * *" })],',
			),
		);
		expect(same.stdout).not.toContain("cloudflare.config.ts");
		expect(await readFile(join(unlisted, "cloudflare.config.ts"), "utf8")).toBe(config(""));
		expect(missing.stdout).toMatch(
			/Add its trigger by hand, since cloudflare.config.ts has no worker.triggers list:\nIn cloudflare.config.ts, in worker.triggers:\n {2}triggers.scheduled\(\{ schedule: "0 8 \* \* \*" \}\),\n$/,
		);
		expect(manual.stdout).toMatch(
			/Add its trigger by hand, since wrangler.jsonc configures the Worker:\nIn wrangler.jsonc, in triggers.crons:\n {2}"0 8 \* \* \*"\n$/,
		);
	});

	test("without an initializer to map on, writes the handler and prints both edits", async () => {
		let root = await project();
		await mkdir(join(root, "routes"));
		await writeFile(
			join(root, "routes/web.ts"),
			'import { route } from "remix/routes";\n\nexport default route({});\n',
		);

		let result = await invoke(["controller", "sponsors", "--no-test", "--no-spec"], root);

		expect(result.stdout).toBe(
			[
				"Wrote app/http/controllers/sponsors.tsx",
				"Declare and map it by hand, since no initializer in app/initializers/ imports routes/web:",
				"In routes/web.ts, in route({ … }):",
				'  sponsors: get("/sponsors"),',
				"In the initializer that maps routes/web:",
				'  router.map(routes.sponsors, lazy(() => import("~/app/http/controllers/sponsors")));',
				"",
			].join("\n"),
		);
		expect(await readFile(join(root, "routes/web.ts"), "utf8")).toBe(
			'import { route } from "remix/routes";\n\nexport default route({});\n',
		);
	});

	test("decides a new page in the sitemap: an empty list for params, and none in an excluded group", async () => {
		let root = await sitemapProject();

		await invoke(
			["controller", "posts/show", "--path", "/posts/:slug", "--no-test", "--no-spec"],
			root,
		);
		await invoke(["controller", "about", "--no-test", "--no-spec"], root);
		await invoke(["controller", "admin/users", "--no-test", "--no-spec"], root);
		await invoke(["controller", "ping", "--method", "post", "--no-test", "--no-spec"], root);

		expect(await readFile(join(root, "app/http/controllers/sitemap.ts"), "utf8")).toBe(
			[
				'import { fromRoutes } from "@sdxc/sitemap/remix";',
				"",
				'import routes from "~/routes/web";',
				"",
				'export let sitemap = fromRoutes(routes, "https://example.com", {',
				"\thome: true,",
				"\tadmin: false,",
				"\tposts: {",
				"\t\tshow: [],",
				"\t},",
				"\tabout: true,",
				"});",
				"",
			].join("\n"),
		);
	});

	test("prints the sitemap decision with the other edits when they cannot be placed", async () => {
		let root = await sitemapProject();
		await rm(join(root, "app/initializers"), { recursive: true });

		let result = await invoke(["controller", "signup", "--method", "form", "--no-test"], root);

		expect(result.stdout).toContain(
			"In app/http/controllers/sitemap.ts, in fromRoutes(…)'s decisions:\n  signup: { index: true },\n",
		);
	});

	test(
		"--dry-run prints the new files and the diff of each edit",
		{ timeout: 60_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));
			let before = await readFile(join(root, "routes/web.ts"), "utf8");

			let result = await invoke(["controller", "sponsors", "--no-test", "--dry-run"], root);

			expect(result.stdout).toContain("Would write app/http/controllers/sponsors.tsx:");
			expect(result.stdout).toContain("--- a/routes/web.ts\n+++ b/routes/web.ts\n");
			expect(result.stdout).toContain('+\tsponsors: get("/sponsors"),');
			expect(result.stdout).toContain("+++ b/app/initializers/router.tsx");
			expect(await readFile(join(root, "routes/web.ts"), "utf8")).toBe(before);
		},
	);
});
