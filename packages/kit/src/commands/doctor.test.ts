/**
 * `sdxc doctor` over fixture projects: a healthy one passing every check, a drifted one failing
 * each with its fix, the JSON form an agent reads, and an unreachable registry turning the
 * checks that need it into skips while the offline checks still run; then the checks a project
 * defines, run in the project's runtime, each failure mode reported beside the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Exec } from "@sdxc/cli";

import { spawnExec } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { success } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { defaultPackageRoot } from "../create/templates.js";
import { registryDocument } from "../testing.js";

/** The releases the mocked npm serves as `@sdxc/kit` versions, each with its `remix` peer. */
const RELEASES: Record<string, string> = {
	"2026.9.4": "3.0.0",
	"2026.10.1": "3.0.0",
	"2026.10.14": "3.1.0",
};

/** The versions the mocked npm serves for each package the fixtures list. */
const PUBLISHED: Record<string, string[]> = {
	"@sdxc/cli": ["2026.9.4", "2026.10.14"],
	"@sdxc/jwt": ["2026.9.1", "2026.10.1"],
	"@sdxc/csv": ["2026.9.1", "2026.9.20"],
};

const SERVER = setupServer(
	http.get("https://registry.npmjs.org/*", ({ request }) => {
		let name = decodeURIComponent(new URL(request.url).pathname.slice(1));
		if (name === "@sdxc/kit") {
			return HttpResponse.json({
				name,
				"dist-tags": { latest: "2026.10.14" },
				versions: Object.fromEntries(
					Object.entries(RELEASES).map(([version, remix]) => [
						version,
						{ version, peerDependencies: { remix } },
					]),
				),
			});
		}
		let versions = PUBLISHED[name];
		if (versions === undefined) return HttpResponse.json({}, { status: 404 });
		return HttpResponse.json(registryDocument(name, versions));
	}),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => SERVER.resetHandlers());
afterAll(() => SERVER.close());

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A Worker config declaring two secrets, a text var, and a commented-out secret. */
const CONFIG = `import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		env: {
			DB: bindings.d1({ name: "app" }),
			/** Example: OLD_SECRET: bindings.secret() */
			SESSION_SECRET: bindings.secret(),
			...(mode === "production" ? {} : { API_KEY: bindings.secret() }),
			SITE_NAME: bindings.text("App"),
		},
	},
});
`;

/** What a fixture project holds, beyond the files every fixture shares. */
interface Fixture {
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
	/** The version installed in `node_modules`, by package name. */
	installed: Record<string, string>;
	envExample: string;
	/** Further project files by path, written before the Worker's generated types. */
	files?: Record<string, string>;
}

/** The project on release 2026.10.1 with every check passing. */
const HEALTHY: Fixture = {
	dependencies: { "@sdxc/cli": "2026.9.4", remix: "3.0.0" },
	devDependencies: { "@sdxc/jwt": "2026.10.1" },
	installed: { "@sdxc/cli": "2026.9.4", "@sdxc/jwt": "2026.10.1", remix: "3.0.0" },
	envExample: "# Signs the session cookie.\nSESSION_SECRET=dev\nAPI_KEY=\nSITE_NAME=Local\n",
};

/** The project on release 2026.10.14 with every check failing. */
const DRIFTED: Fixture = {
	dependencies: { "@sdxc/cli": "2026.10.14", remix: "3.0.0" },
	devDependencies: { "@sdxc/jwt": "2026.9.1" },
	installed: { "@sdxc/cli": "2026.9.4", "@sdxc/jwt": "2026.9.1" },
	envExample: "SESSION_SECRET=dev\n",
};

/** Writes a bun project holding `fixture`, `cloudflare.config.ts` and its installed packages. */
async function fixtureProject(fixture: Fixture): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-doctor-"));
	PROJECTS.push(root);
	let files: Record<string, string> = {
		"package.json": JSON.stringify({
			name: "app",
			packageManager: "bun@1.3.0",
			dependencies: fixture.dependencies,
			devDependencies: fixture.devDependencies,
		}),
		"cloudflare.config.ts": CONFIG,
		".env.example": fixture.envExample,
	};
	for (let [name, version] of Object.entries(fixture.installed)) {
		files[`node_modules/${name}/package.json`] = JSON.stringify({ name, version });
	}
	Object.assign(files, fixture.files);
	files[".cloudflare/types/index.d.ts"] = "interface Env {}\n";
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** Runs `sdxc doctor` with `argv` in `cwd`. */
function doctor(cwd: string, argv: string[] = []) {
	return invoke(createSDXC(), ["doctor", ...argv], { cwd, interactive: false });
}

describe("sdxc doctor", () => {
	test("passes a project whose packages, install, remix and secrets agree", async () => {
		let root = await fixtureProject(HEALTHY);

		let result = await doctor(root);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe(
			[
				"pass  pins             Every @sdxc package is at release 2026.10.1; sdxc upgrade moves them to 2026.10.14",
				"pass  installed        3 packages are installed at the versions package.json pins",
				"pass  remix            remix 3.0.0 is the peer release 2026.10.1 declares",
				"pass  env              .env.example lists every secret cloudflare.config.ts declares",
				"pass  typegen          .cloudflare/types/index.d.ts is newer than cloudflare.config.ts and the env files",
				"skip  migrations       The project has no migrations",
				"skip  layout           No app/ folder in the project",
				"skip  routes           No routes/ folder in the project",
				"skip  models           No app/models/index.ts in the project",
				"skip  emails           No app/emails/index.ts in the project",
				"skip  jsdoc            No app source to read for comments",
				"skip  complexity       No app source to measure complexity",
				"skip  module-size      No app source to measure module size",
				"skip  dependencies     No app source to check dependencies",
				"skip  fan-out          No app source to measure fan-out",
				"skip  orphans          No app source to find orphans",
				"skip  feature-scatter  Fewer than two layers use feature folders",
				"skip  duplication      No app source to scan for duplication",
				"skip  result-throws    No app source to scan for throw",
				"skip  test-ratio       No app code to compare with tests",
				"skip  crap             No coverage at coverage/coverage-final.json; run tests with coverage then re-run doctor",
				"skip  mutation         No mutation report at reports/mutation/mutation.json; run mutation tests then re-run doctor",
				"skip  ui               No @sdxc/ui component is copied",
				"",
			].join("\n"),
		);
	});

	test("fails each drift with the command that fixes it, and exits 1", async () => {
		let root = await fixtureProject(DRIFTED);

		let result = await doctor(root);

		expect(result.code).toBe(1);
		expect(result.stdout).toBe(
			[
				"fail  pins             1 @sdxc package is behind release 2026.10.14: @sdxc/jwt 2026.9.1 -> 2026.10.1. Fix: sdxc upgrade 2026.10.14",
				"fail  installed        node_modules differs from package.json: @sdxc/cli 2026.9.4 is installed, package.json pins 2026.10.14; remix is not installed. Fix: bun install",
				"fail  remix            remix 3.0.0 differs from the 3.1.0 release 2026.10.14 declares: remix 3.0.0 -> 3.1.0. Fix: sdxc upgrade 2026.10.14",
				"fail  env              .env.example leaves out a secret cloudflare.config.ts declares: API_KEY is declared with bindings.secret(). Fix: printf '\\nAPI_KEY=\\n' >> .env.example",
				"pass  typegen          .cloudflare/types/index.d.ts is newer than cloudflare.config.ts and the env files",
				"skip  migrations       The project has no migrations",
				"skip  layout           No app/ folder in the project",
				"skip  routes           No routes/ folder in the project",
				"skip  models           No app/models/index.ts in the project",
				"skip  emails           No app/emails/index.ts in the project",
				"skip  jsdoc            No app source to read for comments",
				"skip  complexity       No app source to measure complexity",
				"skip  module-size      No app source to measure module size",
				"skip  dependencies     No app source to check dependencies",
				"skip  fan-out          No app source to measure fan-out",
				"skip  orphans          No app source to find orphans",
				"skip  feature-scatter  Fewer than two layers use feature folders",
				"skip  duplication      No app source to scan for duplication",
				"skip  result-throws    No app source to scan for throw",
				"skip  test-ratio       No app code to compare with tests",
				"skip  crap             No coverage at coverage/coverage-final.json; run tests with coverage then re-run doctor",
				"skip  mutation         No mutation report at reports/mutation/mutation.json; run mutation tests then re-run doctor",
				"skip  ui               No @sdxc/ui component is copied",
				"",
			].join("\n"),
		);
	});

	test("names what sdxc upgrade moves a lagging package to when a newer release is out", async () => {
		let root = await fixtureProject({
			...HEALTHY,
			dependencies: { ...HEALTHY.dependencies, "@sdxc/csv": "2026.9.1" },
			installed: { ...HEALTHY.installed, "@sdxc/csv": "2026.9.1" },
		});

		let result = await doctor(root);

		expect(result.code).toBe(1);
		expect(result.stdout).toContain(
			"fail  pins             1 @sdxc package is behind release 2026.10.1: @sdxc/csv 2026.9.1 -> 2026.9.20 (sdxc upgrade moves it to 2026.9.20). Fix: sdxc upgrade 2026.10.1\n",
		);
	});

	test("warns on a pin that names no release and on a key no binding declares", async () => {
		let root = await fixtureProject({
			...HEALTHY,
			devDependencies: { "@sdxc/jwt": "latest" },
			envExample: `${HEALTHY.envExample}STALE_TOKEN=\n`,
		});

		let result = await doctor(root, ["--json"]);

		expect(result.code).toBe(0);
		let report = JSON.parse(result.stdout) as {
			ok: boolean;
			checks: Array<{ name: string; status: string; findings: string[]; fix: string | null }>;
		};
		expect(report.ok).toBe(true);
		expect(report.checks.map(({ name, status }) => [name, status])).toEqual([
			["pins", "warn"],
			["installed", "pass"],
			["remix", "pass"],
			["env", "warn"],
			["typegen", "pass"],
			["migrations", "skip"],
			["layout", "skip"],
			["routes", "skip"],
			["models", "skip"],
			["emails", "skip"],
			["jsdoc", "skip"],
			["complexity", "skip"],
			["module-size", "skip"],
			["dependencies", "skip"],
			["fan-out", "skip"],
			["orphans", "skip"],
			["feature-scatter", "skip"],
			["duplication", "skip"],
			["result-throws", "skip"],
			["test-ratio", "skip"],
			["crap", "skip"],
			["mutation", "skip"],
			["ui", "skip"],
		]);
		expect(report.checks[0]).toMatchObject({
			findings: ["@sdxc/jwt latest -> 2026.9.1 (sdxc upgrade moves it to 2026.10.1)"],
			fix: "sdxc upgrade 2026.9.4",
		});
		expect(report.checks[3]).toMatchObject({
			findings: ["STALE_TOKEN is in .env.example only"],
		});
	});

	test("skips the registry checks when npm cannot be reached and still runs the rest", async () => {
		SERVER.use(http.get("https://registry.npmjs.org/*", () => HttpResponse.error()));
		let root = await fixtureProject(DRIFTED);

		let result = await doctor(root, ["--json"]);

		expect(result.code).toBe(1);
		let report = JSON.parse(result.stdout) as {
			ok: boolean;
			checks: Array<{ name: string; status: string; message: string }>;
		};
		expect(report.ok).toBe(false);
		expect(report.checks.map(({ name, status }) => [name, status])).toEqual([
			["pins", "skip"],
			["installed", "fail"],
			["remix", "skip"],
			["env", "fail"],
			["typegen", "pass"],
			["migrations", "skip"],
			["layout", "skip"],
			["routes", "skip"],
			["models", "skip"],
			["emails", "skip"],
			["jsdoc", "skip"],
			["complexity", "skip"],
			["module-size", "skip"],
			["dependencies", "skip"],
			["fan-out", "skip"],
			["orphans", "skip"],
			["feature-scatter", "skip"],
			["duplication", "skip"],
			["result-throws", "skip"],
			["test-ratio", "skip"],
			["crap", "skip"],
			["mutation", "skip"],
			["ui", "skip"],
		]);
		expect(report.checks[0]?.message).toMatch(/^Could not reach the npm registry/);
	});
});

/** Runs the project's runtime for real and answers every other command as a silent success. */
const EXEC: Exec = async (command, request) => {
	if (command[0] === "bun" || command[0] === "node") return spawnExec(command, request);
	return success({ code: 0, stdout: "", stderr: "", output: "" });
};

/** The healthy project with `checks` in `.config/sdxc/checks/`, by file name. */
async function projectWithChecks(checks: Record<string, string>): Promise<string> {
	let files: Record<string, string> = { "README.md": "# App\n" };
	for (let [name, source] of Object.entries(checks)) files[`.config/sdxc/checks/${name}`] = source;
	return fixtureProject({ ...HEALTHY, files });
}

/** Runs `sdxc doctor` with `argv` in `cwd`, loading project checks with the real runtime. */
function doctorWithChecks(cwd: string, argv: string[]) {
	return invoke(createSDXC(), ["doctor", ...argv], {
		cwd,
		interactive: false,
		env: { PATH: process.env.PATH ?? "" },
		exec: EXEC,
	});
}

/** A check that passes when README.md exists and warns otherwise. */
const README_CHECK = `export default {
	name: "readme",
	async run(ctx) {
		let text = await ctx.readFile("README.md");
		if (text === null) return { status: "warn", message: "No README.md", fix: "touch README.md" };
		return { status: "pass", message: "README.md starts with " + text.split("\\n")[0] };
	},
};
`;

describe("sdxc doctor with project checks", () => {
	test("runs each check module beside the built-in checks, filling in what a result leaves out", async () => {
		let root = await projectWithChecks({
			"readme.ts": README_CHECK,
			"pair.ts": `export default [
	{ name: "has-license", run: async (ctx) => ({ status: (await ctx.exists("LICENSE")) ? "pass" : "warn", message: "LICENSE", findings: ["LICENSE is missing"] }) },
	{ name: "config", run: (ctx) => ({ status: "pass", message: "checks live in " + ctx.config.doctor.checks + "; " + ctx.manifest.name }) },
];
`,
			"pair.test.ts": "throw new Error('a test file is never loaded');\n",
		});

		let result = await doctorWithChecks(root, ["--skip", "pins,installed,remix"]);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe(
			[
				"pass  env              .env.example lists every secret cloudflare.config.ts declares",
				"pass  typegen          .cloudflare/types/index.d.ts is newer than cloudflare.config.ts and the env files",
				"skip  migrations       The project has no migrations",
				"skip  layout           No app/ folder in the project",
				"skip  routes           No routes/ folder in the project",
				"skip  models           No app/models/index.ts in the project",
				"skip  emails           No app/emails/index.ts in the project",
				"skip  jsdoc            No app source to read for comments",
				"skip  complexity       No app source to measure complexity",
				"skip  module-size      No app source to measure module size",
				"skip  dependencies     No app source to check dependencies",
				"skip  fan-out          No app source to measure fan-out",
				"skip  orphans          No app source to find orphans",
				"skip  feature-scatter  Fewer than two layers use feature folders",
				"skip  duplication      No app source to scan for duplication",
				"skip  result-throws    No app source to scan for throw",
				"skip  test-ratio       No app code to compare with tests",
				"skip  crap             No coverage at coverage/coverage-final.json; run tests with coverage then re-run doctor",
				"skip  mutation         No mutation report at reports/mutation/mutation.json; run mutation tests then re-run doctor",
				"skip  ui               No @sdxc/ui component is copied",
				"warn  has-license      LICENSE: LICENSE is missing",
				"pass  config           checks live in .config/sdxc/checks; app",
				"pass  readme           README.md starts with # App",
				"",
			].join("\n"),
		);
	});

	test("reports a check that throws, answers nothing usable or reads outside the project as failed", async () => {
		let root = await projectWithChecks({
			"a-throws.ts": `export default { name: "throws", run() { throw new Error("database unreachable"); } };\n`,
			"b-shape.ts": `export default { name: "shape", run: () => ({ status: "ok" }) };\n`,
			"c-outside.ts": `export default { name: "outside", run: (ctx) => ctx.readFile("../secrets.txt") };\n`,
			"d-taken.ts": `export default { name: "pins", run: () => ({ status: "pass", message: "mine" }) };\n`,
			"readme.ts": README_CHECK,
		});

		let result = await doctorWithChecks(root, [
			"--json",
			"--only",
			"throws,shape,outside,pins,readme",
		]);

		expect(result.code).toBe(1);
		let report = JSON.parse(result.stdout) as {
			ok: boolean;
			checks: Array<{
				name: string;
				status: string;
				message: string;
				findings: string[];
				fix: string | null;
			}>;
		};
		expect(report.ok).toBe(false);
		expect(report.checks.map(({ name, status }) => [name, status])).toEqual([
			["pins", "pass"],
			["throws", "fail"],
			["shape", "fail"],
			["outside", "fail"],
			["pins", "fail"],
			["readme", "pass"],
		]);
		expect(report.checks[1]).toEqual({
			name: "throws",
			status: "fail",
			message: "throws failed to run",
			findings: ["Error: database unreachable"],
			fix: "Fix .config/sdxc/checks/a-throws.ts",
		});
		expect(report.checks[2]?.message).toBe("shape answered no result sdxc doctor reads");
		expect(report.checks[3]?.findings[0]).toMatch(/\.\.\/secrets\.txt is outside the project/);
		expect(report.checks[4]?.findings).toEqual(["The name pins is taken by a built-in check"]);
	});

	test("reports a module that fails to load under its path and still runs the others", async () => {
		let root = await projectWithChecks({
			"broken.ts": "export default {\n",
			"empty.ts": "export const unrelated = 1;\n",
			"readme.ts": README_CHECK,
		});

		let result = await doctorWithChecks(root, [
			"--skip",
			"pins,installed,remix,env,typegen,migrations,layout,routes,models,emails,jsdoc,complexity,module-size,dependencies,fan-out,orphans,feature-scatter,duplication,result-throws,test-ratio,crap,mutation,ui",
		]);

		expect(result.code).toBe(1);
		let lines = result.stdout.trimEnd().split("\n");
		expect(lines).toHaveLength(3);
		expect(lines[0]).toMatch(
			/^fail {2}\.config\/sdxc\/checks\/broken\.ts {2}\.config\/sdxc\/checks\/broken\.ts is not a check module: Could not load \.config\/sdxc\/checks\/broken\.ts: .+\. Fix: Fix \.config\/sdxc\/checks\/broken\.ts$/,
		);
		expect(lines[1]).toBe(
			"fail  .config/sdxc/checks/empty.ts   .config/sdxc/checks/empty.ts is not a check module: .config/sdxc/checks/empty.ts default-exports no check; export defineCheck({ name, run }) or a list of them. Fix: Fix .config/sdxc/checks/empty.ts",
		);
		expect(lines[2]).toBe("pass  readme                         README.md starts with # App");
	});

	test("loads a check written with defineCheck from @sdxc/kit/doctor", async () => {
		let root = await projectWithChecks({
			"routes.ts": `import { defineCheck } from "@sdxc/kit/doctor";

export default defineCheck({
	name: "route-count",
	run: (ctx) => ({ status: "pass", message: ctx.routes.length + " routes" }),
});
`,
		});
		await mkdir(join(root, "node_modules/@sdxc"), { recursive: true });
		await symlink(defaultPackageRoot(), join(root, "node_modules/@sdxc/kit"), "dir");

		let result = await doctorWithChecks(root, ["--only", "route-count"]);

		expect(result.stdout).toBe("pass  route-count  0 routes\n");
		expect(result.code).toBe(0);
	});

	test("lists a folder's files past a node_modules symlink loop", async () => {
		let root = await projectWithChecks({
			"count.ts": `export default {
	name: "count",
	run: async (ctx) => ({ status: "pass", message: (await ctx.files("apps")).join(",") }),
};
`,
		});
		await mkdir(join(root, "apps/web/node_modules/@sdxc"), { recursive: true });
		await mkdir(join(root, "apps/web/.cache"), { recursive: true });
		await writeFile(join(root, "apps/web/.cache/hidden.ts"), "");
		await writeFile(join(root, "apps/web/index.ts"), "");
		await symlink(join(root, "apps/web"), join(root, "apps/web/node_modules/@sdxc/web"), "dir");

		let result = await doctorWithChecks(root, ["--only", "count"]);

		expect(result.stdout).toBe("pass  count  apps/web/index.ts\n");
	});

	test("stops on a name in --only that no check has, listing the names there are", async () => {
		let root = await projectWithChecks({ "readme.ts": README_CHECK });

		let result = await doctorWithChecks(root, ["--only", "readme,nope"]);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"No check is named nope; sdxc doctor runs pins, installed, remix, env, typegen, migrations, layout, routes, models, emails, jsdoc, complexity, module-size, dependencies, fan-out, orphans, feature-scatter, duplication, result-throws, test-ratio, crap, mutation, ui, readme",
		);
	});
});
