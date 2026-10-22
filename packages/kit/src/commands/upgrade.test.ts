/**
 * `sdxc upgrade` moving a fixture project: resolving the target on a mocked npm registry,
 * asking before a breaking release, pinning every `@sdxc/*` package and `remix` byte for byte,
 * and handing the install and the target release's prompt to the package manager.
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
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vite-plus/test";

import { createSDXC } from "../cli.js";
import { registryDocument } from "../testing.js";
import { bumpManifest } from "../upgrade/project.js";

/** The releases the mocked npm serves as `@sdxc/kit` versions, each with its `remix` peer. */
const RELEASES: Record<string, { remix: string }> = {
	"2026.9.4": { remix: "3.0.0" },
	"2026.10.1": { remix: "3.0.0" },
	"2026.10.14": { remix: "3.1.0" },
};

/** The versions the mocked npm serves for each package the fixture lists. */
const PUBLISHED: Record<string, string[]> = {
	"@sdxc/cli": ["2026.9.4", "2026.10.14"],
	"@sdxc/jwt": ["2026.9.1", "2026.10.1"],
	"@sdxc/csv": ["2026.9.1", "2026.9.20"],
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
	http.get("https://registry.npmjs.org/*", ({ request }) => {
		let name = decodeURIComponent(new URL(request.url).pathname.slice(1));
		if (name === "@sdxc/kit") {
			return HttpResponse.json({
				name,
				"dist-tags": { latest: "2026.10.14" },
				versions: Object.fromEntries(
					Object.entries(RELEASES).map(([version, { remix }]) => [
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

/** The fixture `package.json` on release 2026.9.4, tab-indented with a script naming sdxc. */
const MANIFEST = `{
	"name": "app",
	"scripts": {
		"sdxc": "sdxc upgrade"
	},
	"dependencies": {
		"@sdxc/cli": "2026.9.4",
		"remix": "3.0.0"
	},
	"devDependencies": {
		"@sdxc/jwt": "2026.9.1"
	}
}
`;

/** The lines the run prints about the breaking change the fixture imports. */
const BREAKING = [
	"Release 2026.10.14 brings 1 breaking change to packages this project imports:",
	"  2026.10.14 @sdxc/jwt: sign() takes the key first",
];

/** A pnpm project on release 2026.9.4 with one file importing `@sdxc/jwt`. */
async function fixtureProject(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-upgrade-"));
	PROJECTS.push(root);
	let files: Record<string, string> = {
		"package.json": MANIFEST,
		"pnpm-lock.yaml": "",
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
	"pnpm dlx @sdxc/kit@2026.10.14 upgrade --prompt --from 2026.9.4 --remix-from 3.0.0": {},
	"pnpm dlx @sdxc/kit@2026.10.14 upgrade --prompt --from 2026.10.14 --since @sdxc/jwt@2026.9.1": {},
	"pnpm dlx @sdxc/kit@2026.10.14 upgrade --prompt --from 2026.10.1 --since @sdxc/csv@2026.9.1 --remix-from 3.0.0":
		{},
	"pnpm dlx @sdxc/kit@2026.10.1 upgrade --prompt --from 2026.10.1 --remix-from 2.9.0": {},
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
	test("moves every @sdxc package and remix to the latest release, then installs and prompts", async () => {
		let root = await fixtureProject();
		let result = await upgrade([], root);
		expect(result.code).toBe(0);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			MANIFEST.replace('"@sdxc/cli": "2026.9.4"', '"@sdxc/cli": "2026.10.14"')
				.replace('"remix": "3.0.0"', '"remix": "3.1.0"')
				.replace('"@sdxc/jwt": "2026.9.1"', '"@sdxc/jwt": "2026.10.1"'),
		);
		expect(result.stderr).toBe(
			[
				"Looking up release latest",
				"✓ Found release 2026.10.14",
				"Resolving 2 @sdxc packages at 2026.10.14",
				"✓ Resolving 2 @sdxc packages at 2026.10.14",
				...BREAKING,
				"package.json: @sdxc/cli 2026.9.4 -> 2026.10.14",
				"package.json: remix 3.0.0 -> 3.1.0",
				"package.json: @sdxc/jwt 2026.9.1 -> 2026.10.1",
				"Installing with pnpm",
				"✓ Installing with pnpm",
				"",
			].join("\n"),
		);
		expect(result.exec.map(({ command, cwd, stdio }) => [command.join(" "), cwd, stdio])).toEqual([
			["pnpm install", root, "stderr"],
			[
				"pnpm dlx @sdxc/kit@2026.10.14 upgrade --prompt --from 2026.9.4 --remix-from 3.0.0",
				root,
				"inherit",
			],
		]);
	});

	test("asks before crossing a breaking release, and leaves package.json on no", async () => {
		let root = await fixtureProject();

		let declined = await upgrade([], root, { interactive: true, answers: { breaking: false } });

		expect(declined.code).toBe(0);
		expect(declined.stderr).toBe(
			[
				"Looking up release latest",
				"✓ Found release 2026.10.14",
				"Resolving 2 @sdxc packages at 2026.10.14",
				"✓ Resolving 2 @sdxc packages at 2026.10.14",
				...BREAKING,
				"✓ Upgrade to release 2026.10.14? No",
				"Kept the @sdxc packages at 2026.9.4; package.json is unchanged",
				"",
			].join("\n"),
		);
		expect(declined.exec).toEqual([]);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(MANIFEST);

		let accepted = await upgrade([], root, { interactive: true, answers: { breaking: true } });

		expect(accepted.code).toBe(0);
		expect(accepted.stderr).toContain("✓ Upgrade to release 2026.10.14? Yes\n");
		expect(await readFile(join(root, "package.json"), "utf8")).toContain(
			'"@sdxc/cli": "2026.10.14"',
		);
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

	test("--no-install pins each package at the release and prints the commands to run next", async () => {
		let root = await fixtureProject();
		let result = await upgrade(["2026.10.1", "--no-install", "--output", "prompt.md"], root);
		expect(result.code).toBe(0);
		expect(result.exec).toEqual([]);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			MANIFEST.replace('"@sdxc/jwt": "2026.9.1"', '"@sdxc/jwt": "2026.10.1"'),
		);
		expect(result.stderr).toContain(
			`Run \`pnpm install\`, then \`pnpm dlx @sdxc/kit@2026.10.1 upgrade --prompt --from 2026.9.4 --output ${join(root, "prompt.md")}\` for the upgrade prompt.\n`,
		);
	});

	test("names the install that failed and the command to finish with", async () => {
		let root = await fixtureProject();

		let result = await upgrade([], root, {
			exec: { ...EXEC, "pnpm install": { code: 1, stderr: "ERR_PNPM_FETCH\n" } },
		});

		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"✗ Installing with pnpm\npnpm install exited with 1\nFix the install and run it again, then `pnpm dlx @sdxc/kit@2026.10.14 upgrade --prompt --from 2026.9.4 --remix-from 3.0.0` for the upgrade prompt.\n",
		);
	});

	test("reports the project's release as up to date when no pin moves", async () => {
		let root = await fixtureProject();
		let result = await upgrade(["2026.9.4"], root);
		expect(result).toMatchObject({
			code: 0,
			stderr:
				"Looking up release 2026.9.4\n✓ Found release 2026.9.4\nResolving 2 @sdxc packages at 2026.9.4\n✓ Resolving 2 @sdxc packages at 2026.9.4\nThe @sdxc packages are up to date at 2026.9.4\n",
		});
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(MANIFEST);
	});

	test("re-pins packages behind the project's release when it is already the latest", async () => {
		let root = await fixtureProject();
		let lagging = MANIFEST.replace('"@sdxc/cli": "2026.9.4"', '"@sdxc/cli": "2026.10.14"').replace(
			'"remix": "3.0.0"',
			'"remix": "3.1.0"',
		);
		await writeFile(join(root, "package.json"), lagging);

		let result = await upgrade([], root);

		expect(result.code).toBe(0);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			lagging.replace('"@sdxc/jwt": "2026.9.1"', '"@sdxc/jwt": "2026.10.1"'),
		);
		expect(result.stderr).toContain(BREAKING.join("\n"));
		expect(result.stderr).toContain("package.json: @sdxc/jwt 2026.9.1 -> 2026.10.1\n");
		expect(result.stderr).not.toContain("up to date");
		expect(result.exec.map(({ command }) => command.join(" "))).toEqual([
			"pnpm install",
			"pnpm dlx @sdxc/kit@2026.10.14 upgrade --prompt --from 2026.10.14 --since @sdxc/jwt@2026.9.1",
		]);
	});

	test("moves remix to the peer of the project's own release", async () => {
		let root = await fixtureProject();
		let mismatched = MANIFEST.replace(
			'"@sdxc/jwt": "2026.9.1"',
			'"@sdxc/jwt": "2026.10.1"',
		).replace('"remix": "3.0.0"', '"remix": "2.9.0"');
		await writeFile(join(root, "package.json"), mismatched);

		let result = await upgrade(["2026.10.1"], root);

		expect(result.code).toBe(0);
		expect(await readFile(join(root, "package.json"), "utf8")).toBe(
			mismatched.replace('"remix": "2.9.0"', '"remix": "3.0.0"'),
		);
		expect(result.exec.map(({ command }) => command.join(" "))).toEqual([
			"pnpm install",
			"pnpm dlx @sdxc/kit@2026.10.1 upgrade --prompt --from 2026.10.1 --remix-from 2.9.0",
		]);
	});

	test("hands the prompt each lagging package's own starting release", async () => {
		let root = await fixtureProject();
		let lagging = MANIFEST.replace(
			'"@sdxc/jwt": "2026.9.1"',
			'"@sdxc/jwt": "2026.10.1",\n\t\t"@sdxc/csv": "2026.9.1"',
		);
		await writeFile(join(root, "package.json"), lagging);

		let result = await upgrade([], root);

		expect(result.code).toBe(0);
		expect(result.stderr).toContain("package.json: @sdxc/csv 2026.9.1 -> 2026.9.20\n");
		expect(result.exec.map(({ command }) => command.join(" "))).toEqual([
			"pnpm install",
			"pnpm dlx @sdxc/kit@2026.10.14 upgrade --prompt --from 2026.10.1 --since @sdxc/csv@2026.9.1 --remix-from 3.0.0",
		]);
	});

	test("refuses a release older than the project's", async () => {
		let root = await fixtureProject();
		await writeFile(
			join(root, "package.json"),
			MANIFEST.replace('"@sdxc/jwt": "2026.9.1"', '"@sdxc/jwt": "2026.10.1"'),
		);
		let result = await upgrade(["2026.9.4"], root);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"Release 2026.9.4 is older than the project's 2026.10.1; upgrade only moves forward\n",
		);
	});

	test("fails on a release npm does not have, and on a project without @sdxc packages", async () => {
		let root = await fixtureProject();
		let result = await upgrade(["2027.1.1"], root);
		expect(result).toMatchObject({
			code: 1,
			stderr:
				"Looking up release 2027.1.1\n✗ Looking up release 2027.1.1\nRelease 2027.1.1 is not published on npm\n",
		});

		await writeFile(join(root, "package.json"), '{ "dependencies": { "remix": "3.0.0" } }\n');
		let none = await upgrade([], root);
		expect(none.code).toBe(1);
		expect(none.stderr).toContain("package.json lists no @sdxc/* package to upgrade");
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
		let { text, bumps } = bumpManifest(MANIFEST, { "@sdxc/cli": "2026.10.14", remix: "3.0.0" });
		expect(text).toBe(MANIFEST.replace('"@sdxc/cli": "2026.9.4"', '"@sdxc/cli": "2026.10.14"'));
		expect(bumps).toEqual([{ name: "@sdxc/cli", from: "2026.9.4", to: "2026.10.14" }]);
	});
});
