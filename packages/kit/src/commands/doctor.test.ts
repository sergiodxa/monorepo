/**
 * `sdxc doctor` over fixture projects: a healthy one passing every check, a drifted one failing
 * each with its fix, the JSON form an agent reads, and an unreachable registry turning the
 * checks that need it into skips while the offline checks still run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
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
				"pass  pins       Every @sdxc package is at release 2026.10.1; sdxc upgrade moves them to 2026.10.14",
				"pass  installed  3 packages are installed at the versions package.json pins",
				"pass  remix      remix 3.0.0 is the peer release 2026.10.1 declares",
				"pass  env        .env.example lists every secret cloudflare.config.ts declares",
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
				"fail  pins       1 @sdxc package is behind release 2026.10.14: @sdxc/jwt 2026.9.1 -> 2026.10.1. Fix: bun add --exact --dev @sdxc/jwt@2026.10.1",
				"fail  installed  node_modules differs from package.json: @sdxc/cli 2026.9.4 is installed, package.json pins 2026.10.14; remix is not installed. Fix: bun install",
				"fail  remix      remix 3.0.0 differs from the 3.1.0 release 2026.10.14 declares: remix 3.0.0 -> 3.1.0. Fix: bun add --exact remix@3.1.0",
				"fail  env        .env.example leaves out a secret cloudflare.config.ts declares: API_KEY is declared with bindings.secret(). Fix: printf '\\nAPI_KEY=\\n' >> .env.example",
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
			"fail  pins       1 @sdxc package is behind release 2026.10.1: @sdxc/csv 2026.9.1 -> 2026.9.20 (sdxc upgrade moves it to 2026.9.20). Fix: bun add --exact @sdxc/csv@2026.9.20\n",
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
		]);
		expect(report.checks[0]).toMatchObject({
			findings: ["@sdxc/jwt latest -> 2026.9.1 (sdxc upgrade moves it to 2026.10.1)"],
			fix: "bun add --exact --dev @sdxc/jwt@2026.9.1",
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
		]);
		expect(report.checks[0]?.message).toMatch(/^Could not reach the npm registry/);
	});
});
