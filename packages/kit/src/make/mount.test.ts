/**
 * `sdxc make middleware --mount` end to end: the targets it reads from the project, the import
 * and the call it appends to a router's chain or a controller chain, the usage error for a target
 * the project lacks, the dry run's diff, and the edits it prints when one cannot be placed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Exec } from "@sdxc/cli";

import { invoke as invokeCLI } from "@sdxc/cli/test";
import { success, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { REGISTRY } from "../releases.js";
import { materialize, registryDocument, typecheck } from "../testing.js";

/** The npm registry `create` pins `@sdxc/*` packages from: every one at 2026.10.14. */
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

/** A page chain that imports app modules through the `~/` alias. */
const PAGE_CHAIN = [
	'import { formData } from "remix/middleware/form-data";',
	'import { createMiddleware } from "remix/router";',
	"",
	'import { assetResolver } from "~/app/initializers/assets";',
	"",
	"export default createMiddleware(",
	"\tformData(),",
	"\trender({ assets: assetResolver }),",
	");",
	"",
].join("\n");

/** A router initializer that imports app modules relatively, with `.js` extensions. */
const ROUTER = [
	'import { createRouter } from "remix/router";',
	"",
	'import serverTiming from "../http/middleware/server-timing.js";',
	"",
	"export function createWebRouter() {",
	"\treturn createRouter({",
	"\t\tmiddleware: [serverTiming()],",
	"\t});",
	"}",
	"",
].join("\n");

/** A project with `files` written at their paths, relative to its root. */
async function project(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-mount-"));
	DIRECTORIES.push(root);
	await writeFile(join(root, "package.json"), '{ "name": "@acme/blog" }\n');
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Runs `sdxc make middleware <argv>` in `cwd` without a terminal. */
function invoke(argv: string[], cwd: string, exec?: Exec) {
	return invokeCLI(createSDXC(), ["make", "middleware", ...argv], {
		cwd,
		interactive: false,
		...(exec === undefined ? {} : { exec }),
	});
}

/** An exec under which the template's `format` command succeeds and changes nothing. */
const UNFORMATTED: Exec = async () => success({ code: 0, stdout: "", stderr: "", output: "" });

/** Every file under `root`, relative to it, sorted. */
async function files(root: string): Promise<string[]> {
	let entries = await readdir(root, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1))
		.sort();
}

describe("make middleware --mount", () => {
	test("appends the middleware to a controller chain's arguments, importing it like its siblings", async () => {
		let root = await project({ "app/http/middleware/page.ts": PAGE_CHAIN });

		let result = await invoke(["auth/require-user", "--mount", "page", "--no-test"], root);

		expect(result).toMatchObject({
			code: 0,
			stdout:
				"Wrote app/http/middleware/auth/require-user.ts\nEdited app/http/middleware/page.ts\n",
		});
		expect(await readFile(join(root, "app/http/middleware/page.ts"), "utf8")).toBe(
			PAGE_CHAIN.replace(
				'"~/app/initializers/assets";\n',
				'"~/app/initializers/assets";\nimport requireUser from "~/app/http/middleware/auth/require-user";\n',
			).replace("\trender({ assets: assetResolver }),\n", "$&\trequireUser(),\n"),
		);
	});

	test("appends the middleware to a router's middleware array", async () => {
		let root = await project({ "app/initializers/router.ts": ROUTER });

		let result = await invoke(["request-id", "--mount", "router", "--no-test"], root);

		expect(result.code).toBe(0);
		expect(await readFile(join(root, "app/initializers/router.ts"), "utf8")).toBe(
			ROUTER.replace(
				'server-timing.js";\n',
				'server-timing.js";\nimport requestId from "../http/middleware/request-id.js";\n',
			).replace("[serverTiming()]", "[serverTiming(), requestId()]"),
		);
	});

	test("names the project's targets for one it lacks, and writes nothing", async () => {
		let root = await project({
			"app/initializers/router.ts": ROUTER,
			"app/http/middleware/page.ts": PAGE_CHAIN,
			"app/http/middleware/admin/page.ts": PAGE_CHAIN,
			"app/http/middleware/server-timing.ts": "export default function serverTiming() {}\n",
		});
		let before = await files(root);

		let result = await invoke(["require-user", "--mount", "admin"], root);

		expect(result.code).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toMatch(
			/^No middleware chain "admin" to mount on; this project has: router, admin\/page, page\n/,
		);
		expect(await files(root)).toEqual(before);
	});

	test("--dry-run prints the file and the chain's diff, and writes nothing", async () => {
		let root = await project({ "app/http/middleware/page.ts": PAGE_CHAIN });

		let result = await invoke(["require-user", "--mount", "page", "--dry-run"], root);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Would write app/http/middleware/require-user.ts:");
		expect(result.stdout).toContain(
			'+import requireUser from "~/app/http/middleware/require-user";',
		);
		expect(result.stdout).toContain("+\trequireUser(),");
		expect(await files(root)).toEqual(["app/http/middleware/page.ts", "package.json"]);
	});

	test("writes the middleware and prints the edit when the router has no middleware array", async () => {
		let source =
			'import { createRouter } from "remix/router";\n\nexport let router = createRouter();\n';
		let root = await project({ "app/initializers/router.ts": source });

		let result = await invoke(["request-id", "--mount", "router", "--no-test"], root);

		expect(result.stdout).toBe(
			[
				"Wrote app/http/middleware/request-id.ts",
				"Mount it by hand, since app/initializers/router.ts: no call to `createRouter` with an array literal at `middleware`:",
				"In app/initializers/router.ts, import it and call it last in the chain:",
				'  import requestId from "../http/middleware/request-id";',
				"  createRouter({ middleware: [ …, requestId() ] })",
				"",
			].join("\n"),
		);
		expect(await readFile(join(root, "app/initializers/router.ts"), "utf8")).toBe(source);
	});

	test("leaves a chain that already binds the middleware's name untouched", async () => {
		let source = PAGE_CHAIN.replace(
			'import { createMiddleware } from "remix/router";',
			'import { createMiddleware } from "remix/router";\nimport { requireUser } from "~/app/policies/users";',
		);
		let root = await project({ "app/http/middleware/page.ts": source });

		let result = await invoke(["require-user", "--mount", "page", "--no-test"], root);

		expect(result.stdout).toContain(
			"Mount it by hand, since app/http/middleware/page.ts already binds requireUser:",
		);
		expect(result.stdout).toContain("  createMiddleware(…, requireUser())");
		expect(await readFile(join(root, "app/http/middleware/page.ts"), "utf8")).toBe(source);
	});

	test(
		"mounts on the app template's router, page and API chains, which then type check",
		{ timeout: 120_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));

			for (let [name, target] of [
				["request-id", "router"],
				["require-user", "page"],
				["api-key", "api"],
			] as const) {
				let result = await invoke([name, "--mount", target], root, UNFORMATTED);
				expect(result.stdout, target).not.toContain("by hand");
				expect(result.code, target).toBe(0);
			}

			let read = (path: string) => readFile(join(root, path), "utf8");
			expect(await read("app/initializers/router.tsx")).toContain(
				"\t\t\tmail({ transport, from: MAIL_FROM }),\n\t\t\trequestId(),\n\t\t],",
			);
			expect(await read("app/http/middleware/page.ts")).toContain(
				'import requireUser from "~/app/http/middleware/require-user";',
			);
			expect(await read("app/http/middleware/api.ts")).toContain(
				"createMiddleware(cors(), access(policy, { load: [abilities] }), apiKey());",
			);
			let checked = await typecheck(root);

			expect(checked.output).toContain("Found no type errors");
			expect(checked.code).toBe(0);
		},
	);
});
