/**
 * Tests how `sdxc deploy` reads `cf`'s JSON output and the build output: which account it
 * reports, which migrations it lists, and which D1 binding the migration chain applies to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { BUILD_WORKERS, parseIdentity, parsePending, readBuiltWorker } from "./plan.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project whose build output holds one Worker per entry of `workers`, keyed by folder. */
async function built(workers: Record<string, unknown>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-deploy-plan-"));
	PROJECTS.push(root);
	for (let [folder, config] of Object.entries(workers)) {
		await mkdir(join(root, BUILD_WORKERS, folder), { recursive: true });
		await writeFile(
			join(root, BUILD_WORKERS, folder, "worker.config.json"),
			JSON.stringify(config),
		);
	}
	return root;
}

describe("parseIdentity", () => {
	let accounts = [
		{ id: "a1", name: "Personal" },
		{ id: "a2", name: "Work" },
	];

	test("names the only account a login reaches", () => {
		let identity = parseIdentity(
			JSON.stringify({ authenticated: true, email: "ada@example.com", accounts: [accounts[0]] }),
			undefined,
		);

		expect(identity).toEqual({
			status: "success",
			data: { account: "Personal (a1)", email: "ada@example.com" },
		});
	});

	test("takes the account CLOUDFLARE_ACCOUNT_ID names, as cf does", () => {
		let identity = parseIdentity(JSON.stringify({ authenticated: true, accounts }), "a2");

		expect(isSuccess(identity) && identity.data.account).toBe(
			"Work (a2), from CLOUDFLARE_ACCOUNT_ID",
		);
	});

	test("says cf picks among several accounts", () => {
		let identity = parseIdentity(JSON.stringify({ authenticated: true, accounts }), undefined);

		expect(isSuccess(identity) && identity.data.account).toBe("one of 2 accounts, which cf picks");
	});

	test("reads JSON cf colored", () => {
		let identity = parseIdentity(
			'{\u001B[36m"authenticated"\u001B[39m: true, "accounts": []}',
			"a1",
		);

		expect(isSuccess(identity) && identity.data.account).toBe("a1, from CLOUDFLARE_ACCOUNT_ID");
	});

	test("fails naming cf auth login when signed out", () => {
		let identity = parseIdentity(JSON.stringify({ authenticated: false }), undefined);

		expect(isFailure(identity) && identity.error.message).toContain("cf auth login");
	});
});

describe("parsePending", () => {
	test("answers each unapplied migration's name in order", () => {
		let pending = parsePending('[{"Name":"0002_a.sql"},{"Name":"0003_b.sql"}]\n');

		expect(isSuccess(pending) && pending.data).toEqual(["0002_a.sql", "0003_b.sql"]);
	});

	test("fails on output other than the JSON list", () => {
		let pending = parsePending("✘ Not logged in\n");

		expect(isFailure(pending) && pending.error.message).toContain("cf d1 migrations list");
	});
});

describe("readBuiltWorker", () => {
	test("applies the chain to DB when the Worker binds several databases", async () => {
		let root = await built({
			default: {
				name: "app",
				env: {
					ANALYTICS: { type: "d1", id: "analytics-id" },
					DB: { type: "d1", id: "db-id" },
					KV: { type: "kv", id: "kv-id" },
				},
			},
		});

		let worker = await readBuiltWorker(root);

		expect(isSuccess(worker) && worker.data).toEqual({
			name: "app",
			database: { binding: "DB", id: "db-id" },
		});
	});

	test("applies the chain to the only database under any binding name", async () => {
		let root = await built({
			default: { name: "app", env: { STORE: { type: "d1", id: "s-id" } } },
		});

		let worker = await readBuiltWorker(root);

		expect(isSuccess(worker) && worker.data.database).toEqual({ binding: "STORE", id: "s-id" });
	});

	test("fails naming the build when there is no output", async () => {
		let root = await built({});

		let worker = await readBuiltWorker(root);

		expect(isFailure(worker) && worker.error.message).toContain("run the build first");
	});
});
