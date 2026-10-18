/**
 * `sdxc make migration --from-model` end to end in a scratch project: the model is loaded by a
 * real Bun or Node child, the chain it names is replayed, and the migration is written, shown
 * under `--dry-run`, or skipped when the chain already matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Exec } from "@sdxc/cli";

import { spawnExec } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { success } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The data-table module this workspace installed, imported by URL from a scratch project. */
const DATA_TABLE = import.meta.resolve("remix/data-table");

/**
 * Runs the model loader for real and answers every other command, the project's `format`
 * included, as a success that changes nothing.
 */
const EXEC: Exec = async (command, request) => {
	if (command[0] === "bun" || command[0] === "node") return spawnExec(command, request);
	return success({ code: 0, stdout: "", stderr: "", output: "" });
};

/** A project on `manager` with `app/models/posts.ts` declaring `columns` and the given config. */
async function project(
	columns: string,
	options: { manager?: "bun" | "npm"; config?: string } = {},
): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-from-model-"));
	DIRECTORIES.push(root);
	let manager = options.manager === "npm" ? "npm@11.0.0" : "bun@1.4.2";
	await writeFile(
		join(root, "package.json"),
		JSON.stringify({ name: "@acme/blog", packageManager: manager }),
	);
	if (options.config !== undefined) {
		await mkdir(join(root, ".config"));
		await writeFile(join(root, ".config/sdxc.jsonc"), options.config);
	}
	await mkdir(join(root, "app/models"), { recursive: true });
	await writeFile(
		join(root, "app/models/posts.ts"),
		`import { column as c, table } from "${DATA_TABLE}";

export const postsTable = table({ name: "posts", columns: { ${columns} } });

export default { name: "Posts", table: postsTable };
`,
	);
	return root;
}

/** Runs `sdxc make migration <argv>` in `cwd`. */
function make(argv: string[], cwd: string) {
	return invoke(createSDXC(), ["make", "migration", ...argv], {
		cwd,
		interactive: false,
		env: { PATH: process.env.PATH ?? "" },
		exec: EXEC,
	});
}

/** The files of a chain folder, or none when it does not exist. */
async function chain(root: string, folder = "database/migrations"): Promise<string[]> {
	return readdir(join(root, folder)).catch(() => []);
}

describe("make migration --from-model", () => {
	test.each(["bun", "npm"] as const)(
		"writes the CREATE TABLE a new model needs, loading it with the %s project's runtime",
		async (manager) => {
			let root = await project(`id: c.text().primaryKey(), title: c.text()`, { manager });

			let result = await make(["create-posts", "--from-model", "posts"], root);

			expect(result.stderr).not.toContain("Could not load");
			expect(result.code).toBe(0);
			expect(await readFile(join(root, "database/migrations/0001_CreatePosts.sql"), "utf8"))
				.toBe(`-- CreatePosts: brings database/migrations in step with app/models/posts.ts, as sdxc make migration --from-model wrote it.

CREATE TABLE "posts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL
);
`);
		},
	);

	test("adds only what the chain lacks, and writes nothing once it matches", async () => {
		let root = await project(
			`id: c.text().primaryKey(), title: c.text(), body: c.text().nullable()`,
		);
		await mkdir(join(root, "database/migrations"), { recursive: true });
		await writeFile(
			join(root, "database/migrations/0001_CreatePosts.sql"),
			`CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT NOT NULL);`,
		);

		let first = await make(["add-body", "--from-model", "posts"], root);
		let second = await make(["add-body-again", "--from-model", "posts"], root);

		expect(first.code).toBe(0);
		expect(await readFile(join(root, "database/migrations/0002_AddBody.sql"), "utf8")).toContain(
			`\n\nALTER TABLE "posts" ADD COLUMN "body" TEXT;\n`,
		);
		expect(second.code).toBe(0);
		expect(second.stdout).toBe(
			"database/migrations already matches app/models/posts.ts; nothing to write\n",
		);
		expect(await chain(root)).toEqual(["0001_CreatePosts.sql", "0002_AddBody.sql"]);
	});

	test("prints the SQL and its warnings under --dry-run and writes nothing", async () => {
		let root = await project(`id: c.text().primaryKey()`);
		await mkdir(join(root, "database/migrations"), { recursive: true });
		await writeFile(
			join(root, "database/migrations/0001_CreatePosts.sql"),
			`CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT);`,
		);

		let result = await make(["drop-title", "--from-model", "posts", "--dry-run"], root);

		expect(result.code).toBe(0);
		expect(result.stdout)
			.toBe(`Warning: posts.title is not in the model: the migration drops it and deletes its data
Would write database/migrations/0002_DropTitle.sql:

-- DropTitle: brings database/migrations in step with app/models/posts.ts, as sdxc make migration --from-model wrote it.
-- Warning: posts.title is not in the model: the migration drops it and deletes its data

ALTER TABLE "posts" DROP COLUMN "title";

`);
		expect(await chain(root)).toEqual(["0001_CreatePosts.sql"]);
	});

	test("diffs against the chain --chain names, each chain replayed alone", async () => {
		let root = await project(`id: c.text().primaryKey()`, {
			config:
				'{ "make": { "migrations": { "default": "database/migrations", "tenant": "database/tenant" } } }',
		});
		await mkdir(join(root, "database/migrations"), { recursive: true });
		await writeFile(
			join(root, "database/migrations/0001_CreatePosts.sql"),
			`CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL);`,
		);

		let main = await make(["posts", "--from-model", "posts"], root);
		let tenant = await make(["create-posts", "--from-model", "posts", "--chain", "tenant"], root);

		expect(main.stdout).toContain("nothing to write");
		expect(tenant.code).toBe(0);
		expect(await readFile(join(root, "database/tenant/0001_CreatePosts.sql"), "utf8")).toContain(
			'CREATE TABLE "posts"',
		);
	});

	test("fails naming the model file when it does not exist", async () => {
		let root = await project(`id: c.text().primaryKey()`);

		let result = await make(["x", "--from-model", "comments"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toBe(
			"app/models/comments.ts not found; --from-model takes a model's name as sdxc make model names it\n",
		);
	});

	test("fails with the runtime's error when the model cannot be loaded", async () => {
		let root = await project(`id: c.text().primaryKey()`);
		await writeFile(join(root, "app/models/broken.ts"), `throw new Error("boom");\n`);

		let result = await make(["x", "--from-model", "broken"], root);

		expect(result.code).toBe(1);
		expect(result.stderr).toMatch(/^Could not load app\/models\/broken\.ts with bun:\n[\s\S]*boom/);
	});
});
