/**
 * `sdxc upgrade` moving a fixture project: resolving the target on a mocked npm registry,
 * asking before a breaking release, bumping `sdxc` and `remix` in `package.json` byte for byte,
 * reporting `@sdxc/*` pins, and handing the install and the prompt to the package manager.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { bumpManifest } from "../upgrade/project.js";

/** The registry versions the mocked npm serves, `latest` being the newest. */
const PUBLISHED: Record<string, { remix: string }> = {
	"2026.9.4": { remix: "3.0.0" },
	"2026.10.1": { remix: "3.0.0" },
	"2026.10.14": { remix: "3.1.0" },
};

/** The changelog every mocked release ships: one breaking change, to a package the fixture imports. */
const CHANGELOG = [
	{
		release: "2026.10.14",
		package: "@sdxc/jwt",
		type: "feat",
		breaking: true,
		title: "sign() takes the key first",
		body: "",
	},
	{
		release: "2026.10.14",
		package: "@sdxc/csv",
		type: "fix",
		breaking: true,
		title: "parse() trims cells",
		body: "",
	},
]
	.map((entry) => JSON.stringify(entry))
	.join("\n");

const SERVER = setupServer(
	http.get("https://registry.npmjs.org/sdxc/:version", ({ params }) => {
		let version = params.version === "latest" ? "2026.10.14" : String(params.version);
		let published = PUBLISHED[version];
		if (published === undefined) return HttpResponse.json({ error: "not found" }, { status: 404 });
		return HttpResponse.json({
			name: "sdxc",
			version,
			peerDependencies: { remix: published.remix },
		});
	}),
	http.get("https://unpkg.com/@sdxc/:release/changelog.jsonl", ({ params }) =>
		String(params.release).startsWith("kit@")
			? HttpResponse.text(CHANGELOG)
			: new HttpResponse(null, { status: 404 }),
	),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterAll(() => SERVER.close());

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The fixture `package.json`, tab-indented with a trailing script naming sdxc. */
const MANIFEST = `{
	"name": "app",
	"scripts": {
		"sdxc": "sdxc upgrade"
	},
	"dependencies": {
		"remix": "3.0.0",
		"sdxc": "2026.9.4"
	},
	"devDependencies": {
		"@sdxc/jwt": "2026.9.4"
	}
}
`;

/** The lines the run prints about the breaking change the fixture imports. */
const BREAKING = [
	"sdxc 2026.10.14 brings 1 breaking change to packages this project imports:",
	"  2026.10.14 @sdxc/jwt: sign() takes the key first",
];

/** A pnpm project with sdxc 2026.9.4 installed and one file importing `@sdxc/jwt`. */
async function fixtureProject(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-upgrade-"));
	PROJECTS.push(root);
	let files: Record<string, string> = {
		"package.json": MANIFEST,
		"pnpm-lock.yaml": "",
		"node_modules/sdxc/package.json": JSON.stringify({ name: "sdxc", version: "2026.9.4" }),
		"src/token.ts": 'import { sign } from "@sdxc/jwt";\n',
	};
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** The commands the package manager is handed, answered with exit 0. */
const EXEC = {
	"pnpm install": {},
	"pnpm exec sdxc upgrade --prompt --from 2026.9.4 --remix-from 3.0.0": {},
};

/** Runs `sdxc upgrade` with `argv` in `cwd`, without a terminal unless `options` says so. */
function upgrade(argv: string[], cwd: string, options: InvokeOptions = {}) {
	return invoke(createSDXC(), ["upgrade", ...argv], {
		cwd,
		interactive: false,
		exec: EXEC,
		...options,
	});
}

describe("sdxc upgrade", () => {
	test("bumps sdxc and remix to the latest release, then installs and prompts", async () => {
		let root = await fixtureProject();
		let result = await upgrade([], root);
		expect(result.code).toBe(0);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			MANIFEST.replace('"remix": "3.0.0"', '"remix": "3.1.0"').replace(
				'"sdxc": "2026.9.4"',
				'"sdxc": "2026.10.14"',
			),
		);
		expect(result.stderr).toBe(
			[
				"Looking up sdxc@latest",
				"✓ Found sdxc 2026.10.14",
				...BREAKING,
				"package.json: sdxc 2026.9.4 -> 2026.10.14",
				"package.json: remix 3.0.0 -> 3.1.0",
				"@sdxc/jwt is listed beside sdxc, which does not support it: import sdxc/jwt instead and remove it; imported by src/token.ts",
				"Installing with pnpm",
				"✓ Installing with pnpm",
				"",
			].join("\n"),
		);
		expect(result.exec.map(({ command, cwd, stdio }) => [command.join(" "), cwd, stdio])).toEqual([
			["pnpm install", root, "stderr"],
			["pnpm exec sdxc upgrade --prompt --from 2026.9.4 --remix-from 3.0.0", root, "inherit"],
		]);
	});

	test("asks before crossing a breaking release, and leaves package.json on no", async () => {
		let root = await fixtureProject();

		let declined = await upgrade([], root, { interactive: true, answers: { breaking: false } });

		expect(declined.code).toBe(0);
		expect(declined.stderr).toBe(
			[
				"Looking up sdxc@latest",
				"✓ Found sdxc 2026.10.14",
				...BREAKING,
				"✓ Upgrade to sdxc 2026.10.14? No",
				"Kept sdxc at 2026.9.4; package.json is unchanged",
				"",
			].join("\n"),
		);
		expect(declined.exec).toEqual([]);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(MANIFEST);

		let accepted = await upgrade([], root, { interactive: true, answers: { breaking: true } });

		expect(accepted.code).toBe(0);
		expect(accepted.stderr).toContain("✓ Upgrade to sdxc 2026.10.14? Yes\n");
		expect(await readFile(join(root, "package.json"), "utf8")).toContain('"sdxc": "2026.10.14"');
	});

	test("upgrades without asking when the changelog cannot be read", async () => {
		let root = await fixtureProject();
		SERVER.use(
			http.get(
				"https://unpkg.com/@sdxc/:release/changelog.jsonl",
				() => new HttpResponse(null, { status: 503 }),
				{ once: true },
			),
		);

		let result = await upgrade(["--no-install"], root, { interactive: true, answers: [] });

		expect(result.code).toBe(0);
		expect(result.stderr).not.toContain("breaking");
	});

	test("--no-install changes package.json only and prints the commands to run next", async () => {
		let root = await fixtureProject();
		let result = await upgrade(["2026.10.1", "--no-install", "--output", "prompt.md"], root);
		expect(result.code).toBe(0);
		expect(result.exec).toEqual([]);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			MANIFEST.replace('"sdxc": "2026.9.4"', '"sdxc": "2026.10.1"'),
		);
		expect(result.stderr).toContain(
			`Run \`pnpm install\`, then \`pnpm exec sdxc upgrade --prompt --from 2026.9.4 --output ${join(root, "prompt.md")}\` for the upgrade prompt.\n`,
		);
	});

	test("names the install that failed and the command to finish with", async () => {
		let root = await fixtureProject();

		let result = await upgrade([], root, {
			exec: { ...EXEC, "pnpm install": { code: 1, stderr: "ERR_PNPM_FETCH\n" } },
		});

		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"✗ Installing with pnpm\npnpm install exited with 1\nFix the install and run it again, then `pnpm exec sdxc upgrade --prompt --from 2026.9.4 --remix-from 3.0.0` for the upgrade prompt.\n",
		);
	});

	test("reports the installed release as up to date", async () => {
		let root = await fixtureProject();
		let result = await upgrade(["2026.9.4"], root);
		expect(result).toMatchObject({
			code: 0,
			stderr: "Looking up sdxc@2026.9.4\n✓ Found sdxc 2026.9.4\nsdxc is up to date at 2026.9.4\n",
		});
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(MANIFEST);
	});

	test("refuses a release older than the installed one", async () => {
		let root = await fixtureProject();
		await writeFile(
			join(root, "node_modules/sdxc/package.json"),
			JSON.stringify({ version: "2026.10.1" }),
		);
		let result = await upgrade(["2026.9.4"], root);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"sdxc 2026.9.4 is older than the installed 2026.10.1; upgrade only moves forward\n",
		);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(MANIFEST);
	});

	test("fails on a version npm does not have", async () => {
		let root = await fixtureProject();
		let result = await upgrade(["2027.1.1"], root);
		expect(result).toMatchObject({
			code: 1,
			stderr:
				"Looking up sdxc@2027.1.1\n✗ Looking up sdxc@2027.1.1\nsdxc@2027.1.1 is not published on npm\n",
		});
	});

	test("rejects more than one version, and --prompt without --from", async () => {
		let root = await fixtureProject();
		let two = await upgrade(["2026.10.1", "2026.10.14"], root);
		let prompt = await upgrade(["--prompt"], root);
		expect(two.code).toBe(2);
		expect(prompt.code).toBe(2);
		expect(prompt.stderr).toMatch(/^sdxc upgrade --prompt takes --from <version> and no version\n/);
	});
});

describe("bumpManifest", () => {
	test("changes only the pins inside dependency sections", () => {
		let { text, bumps } = bumpManifest(MANIFEST, { sdxc: "2026.10.14", remix: "3.0.0" });
		expect(text).toBe(MANIFEST.replace('"sdxc": "2026.9.4"', '"sdxc": "2026.10.14"'));
		expect(bumps).toEqual([{ name: "sdxc", from: "2026.9.4", to: "2026.10.14" }]);
	});
});
