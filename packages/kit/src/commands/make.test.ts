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
		["command", "users/grant", "app/commands/users/grant.ts"],
	])("%s writes %s and its test", async (kind, name, path) => {
		let root = await project();

		let result = await invoke([kind, name], root);

		let test = path.replace(/(\.tsx?)$/, ".test$1");
		expect(result.code).toBe(0);
		expect(result.stdout.startsWith(`Wrote ${path}\nWrote ${test}\n`)).toBe(true);
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
		]);
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
});

describe("declaring and mapping", () => {
	test(
		"a job, controller, tool, resource and command are declared, mapped and type check in the app template",
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
				["model", "post"],
				["factory", "post"],
				["migration", "create-posts"],
				["service", "billing/charge"],
				["policy", "can-edit"],
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
			expect(dispatcher).toContain('import jobs from "~/app/jobs";');
			expect(dispatcher).toContain(
				'dispatcher.map(jobs.trials.expire, () => import("~/app/jobs/trials/expire"));\ndispatcher.map(jobs.digest, () => import("~/app/jobs/digest"));',
			);
			expect(routes).toContain('import { get, route, form, post } from "remix/routes";');
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
			expect(handler).toContain('import { createHandler, lazy } from "@sdxc/mcp";');
			expect(handler).toContain('import toolset from "~/app/mcp/tools";');
			expect(handler).toContain(
				'mcp.tools.map(toolset.getPost, lazy(() => import("~/app/mcp/tools/get-post")));',
			);
			expect(handler).toContain(
				'mcp.resources.map(resourceset.article, lazy(() => import("~/app/mcp/resources/article")));',
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

			let checked = await typecheck(root);

			expect(checked.output).toBe("");
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

		let result = await invoke(["command", "about/more", "--no-test"], root);

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

	test("without an initializer to map on, writes the handler and prints both edits", async () => {
		let root = await project();
		await mkdir(join(root, "routes"));
		await writeFile(
			join(root, "routes/web.ts"),
			'import { route } from "remix/routes";\n\nexport default route({});\n',
		);

		let result = await invoke(["controller", "sponsors", "--no-test"], root);

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
