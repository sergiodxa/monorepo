/**
 * The monorepo source-rule checks over an in-memory repository: every workspace for the general
 * rules, an app's layout only for the Worker rules, and generated files left out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ProjectCheck, ProjectCheckContext } from "@sdxc/kit/doctor";

import { describe, expect, test } from "vitest";

import checks from "./source-rules.js";

/** A context whose files are `files`, by path from the repository root. */
function context(files: Record<string, string>): ProjectCheckContext {
	return {
		root: "/repo",
		manifest: {},
		config: {} as ProjectCheckContext["config"],
		routes: [],
		async readFile(path) {
			return files[path] ?? null;
		},
		async exists(path) {
			return path in files;
		},
		async files(folder) {
			return Object.keys(files)
				.filter((path) => path.startsWith(`${folder}/`))
				.sort();
		},
	};
}

/** The check named `name`. */
function check(name: string): ProjectCheck {
	let found = checks.find((candidate) => candidate.name === name);
	if (found === undefined) throw new Error(`No check named ${name}`);
	return found;
}

describe("monorepo source rules", () => {
	test("fails on a const inside a package's function", async () => {
		let result = await check("monorepo-local-const").run(
			context({ "packages/jwt/src/sign.ts": "export function sign() {\n\tconst key = 1;\n}\n" }),
		);
		expect(result.status).toBe("fail");
		expect(result.findings).toEqual([
			"packages/jwt/src/sign.ts:2: const inside a function or block",
		]);
	});

	test("leaves generated files out", async () => {
		let result = await check("monorepo-local-const").run(
			context({
				"test/browser-public/mockServiceWorker.js": "function a() {\n\tconst b = 1;\n}\n",
				"apps/web/node_modules/x/index.js": "function a() {\n\tconst b = 1;\n}\n",
			}),
		);
		expect(result.status).toBe("pass");
	});

	test("reads process.env only inside an app's layout", async () => {
		let result = await check("monorepo-process-env").run(
			context({
				"apps/web/app/services/key.ts": "export let KEY = process.env.KEY;\n",
				"apps/web/scripts/import.ts": "export let KEY = process.env.KEY;\n",
				"packages/cli/src/env.ts": "export let KEY = process.env.KEY;\n",
			}),
		);
		expect(result.findings).toEqual(["apps/web/app/services/key.ts:1: reads process.env"]);
	});

	test("accepts a logger built in an app's initializer", async () => {
		let result = await check("monorepo-logger").run(
			context({ "apps/web/app/initializers/logger.ts": "export let logger = createLogger();\n" }),
		);
		expect(result.status).toBe("pass");
	});
});
