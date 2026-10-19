/**
 * `sdxc destroy` end to end in the app template: what `sdxc make` writes and edits for each kind
 * comes back out, every file it touched reads as before, and nothing changes without a yes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Exec } from "@sdxc/cli";
import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke } from "@sdxc/cli/test";
import { success, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { pruneImports } from "../destroy.js";
import { REGISTRY } from "../releases.js";
import { materialize, registryDocument } from "../testing.js";

/** The npm registry `make` pins packages from: every one at 2026.10.14. */
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
	await Promise.all(DIRECTORIES.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** An exec under which the template's `format` succeeds and changes nothing. */
const UNFORMATTED: Exec = async () => success({ code: 0, stdout: "", stderr: "", output: "" });

/** Runs `sdxc <argv>` in `cwd` without a terminal. */
function run(argv: string[], cwd: string, options: InvokeOptions = {}) {
	return invoke(createSDXC(), argv, { cwd, interactive: false, exec: UNFORMATTED, ...options });
}

/** The files `make` edits for the kinds the round trip covers. */
const EDITED = [
	"routes/web.ts",
	"app/initializers/router.tsx",
	"app/http/controllers/sitemap.ts",
	"app/jobs/index.ts",
	"app/initializers/dispatcher.ts",
	"app/mcp/tools/index.ts",
	"app/initializers/mcp.ts",
	"app/commands/index.ts",
	"app/initializers/cli.ts",
	"app/models/index.ts",
];

describe("destroy", () => {
	test(
		"undoes what make wrote and edited for each declared kind",
		{ timeout: 120_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));
			let read = (path: string) => readFile(join(root, path), "utf8");
			let before = await Promise.all(EDITED.map(read));
			let made = [
				["controller", "sponsors"],
				["job", "trials/expire"],
				["mcp", "get-post"],
				["command", "users/grant"],
				["model", "post", "title"],
			];
			for (let argv of made)
				expect((await run(["make", ...argv], root)).code, argv.join(" ")).toBe(0);

			for (let argv of made) {
				let destroyed = await run(["destroy", argv[0] as string, argv[1] as string, "--yes"], root);
				expect(destroyed.code, destroyed.stderr).toBe(0);
			}

			expect(await Promise.all(EDITED.map(read))).toEqual(before);
		},
	);

	test("needs --yes without a terminal, and --dry-run changes nothing", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		await run(["make", "job", "digest"], root);
		let jobs = await readFile(join(root, "app/jobs/index.ts"), "utf8");

		let refused = await run(["destroy", "job", "digest"], root);
		let dry = await run(["destroy", "job", "digest", "--dry-run"], root);

		expect(refused.code).toBe(2);
		expect(refused.stderr).toContain("Destroying files without a terminal needs --yes");
		expect(dry.code).toBe(0);
		expect(dry.stdout).toContain("Removes:\n  app/jobs/digest.ts\n  app/jobs/digest.test.ts\n");
		expect(dry.stdout).toContain("-\tdigest: job({ input: s.object({}) }),");
		expect(await readFile(join(root, "app/jobs/index.ts"), "utf8")).toBe(jobs);
	});

	test("lists what still references a removed file, and refuses a missing one", async () => {
		let root = unwrap(await materialize("app"));
		DIRECTORIES.push(dirname(root));
		await run(["make", "service", "billing/charge"], root);
		let user = "app/jobs/charge-all.ts";
		await mkdir(dirname(join(root, user)), { recursive: true });
		await writeFile(join(root, user), 'import { charge } from "~/app/services/billing/charge";\n');

		let destroyed = await run(["destroy", "service", "billing/charge", "--yes"], root);
		let missing = await run(["destroy", "service", "billing/charge", "--yes"], root);

		expect(destroyed.stdout).toContain(
			`Still referenced, to remove by hand:\n  ${user}:1: import { charge } from "~/app/services/billing/charge";\n`,
		);
		expect(missing.stderr).toBe(
			"app/services/billing/charge.ts does not exist; sdxc destroy removes what sdxc make wrote\n",
		);
	});
});

describe("pruneImports", () => {
	test("drops only the bindings whose last use the edit removed", () => {
		let before = [
			'import { createHandler, lazy } from "@sdxc/mcp";',
			'import toolset from "~/app/mcp/tools";',
			'import unused from "~/app/unused";',
			"",
			"/** The lazy server. */",
			"let mcp = createHandler({});",
			'mcp.tools.map(toolset.getPost, lazy(() => import("~/app/mcp/tools/get-post")));',
			"",
		].join("\n");
		let after = before.replace(/mcp\.tools\.map[^\n]*\n/, "");

		expect(pruneImports("mcp.ts", before, after)).toBe(
			[
				'import { createHandler } from "@sdxc/mcp";',
				'import unused from "~/app/unused";',
				"",
				"/** The lazy server. */",
				"let mcp = createHandler({});",
				"",
			].join("\n"),
		);
	});
});
