/**
 * Setup-written files credit the project's author the way `make` stubs do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { planAuth } from "./auth.js";
import { creditSetupFiles } from "./credit.js";

/** Fixture roots created by the current test. */
const ROOTS: string[] = [];

afterEach(async () => {
	let created = ROOTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("creditSetupFiles", () => {
	test("adds @author and @copyright from package.json author", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-setup-credit-"));
		ROOTS.push(root);
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ name: "app", author: "Ada Lovelace (https://ada.dev)" }),
		);
		let credited = await creditSetupFiles(root, [
			{
				path: "app/initializers/flags.ts",
				content: "/**\n * Feature flags.\n */\n\nexport const flags = {};\n",
			},
		]);
		expect(credited[0]?.content).toContain("@author [Ada Lovelace](https://ada.dev)");
		expect(credited[0]?.content).toContain("@copyright Ada Lovelace");
		expect(credited[0]?.content).not.toContain("Sergio");
	});

	test("leaves sources unchanged when no author can be resolved", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-setup-credit-"));
		ROOTS.push(root);
		await writeFile(join(root, "package.json"), JSON.stringify({ name: "app" }));
		await mkdir(join(root, ".git"));
		await writeFile(join(root, ".git/config"), "[user]\n\tname =\n");
		let source = "/**\n * Feature flags.\n */\n\nexport const flags = {};\n";
		let previous = {
			GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
			GIT_CONFIG_SYSTEM: process.env.GIT_CONFIG_SYSTEM,
		};
		process.env.GIT_CONFIG_GLOBAL = "/dev/null";
		process.env.GIT_CONFIG_SYSTEM = "/dev/null";
		try {
			let credited = await creditSetupFiles(root, [
				{ path: "app/initializers/flags.ts", content: source },
			]);
			expect(credited[0]?.content).toBe(source);
		} finally {
			if (previous.GIT_CONFIG_GLOBAL === undefined) delete process.env.GIT_CONFIG_GLOBAL;
			else process.env.GIT_CONFIG_GLOBAL = previous.GIT_CONFIG_GLOBAL;
			if (previous.GIT_CONFIG_SYSTEM === undefined) delete process.env.GIT_CONFIG_SYSTEM;
			else process.env.GIT_CONFIG_SYSTEM = previous.GIT_CONFIG_SYSTEM;
		}
	});
});

describe("planAuth credits files", () => {
	test("issuer stub carries the package author, not a kit maintainer", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-setup-auth-"));
		ROOTS.push(root);
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ name: "app", author: { name: "Ada Lovelace", url: "https://ada.dev" } }),
		);
		await writeFile(
			join(root, "cloudflare.config.ts"),
			`export default { worker: { env: { SESSION_SECRET: bindings.secret() } } };\n`,
		);
		await writeFile(join(root, ".env.example"), "SESSION_SECRET=\n");
		let planned = unwrap(await planAuth(root, "r3-auth"));
		let issuer = planned.files.find((file) => file.path === "app/initializers/issuer.ts");
		expect(issuer?.content).toContain("@author [Ada Lovelace](https://ada.dev)");
		expect(issuer?.content).toContain("@copyright Ada Lovelace");
		expect(issuer?.content).not.toContain("Sergio");
	});
});
