/**
 * `sdxc models` end to end in a scratch project: each model loaded by the project's runtime,
 * its columns printed, and the migration chain compared with its table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Exec } from "@sdxc/cli";

import { spawnExec } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { success } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { createSDXC } from "../cli.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	await Promise.all(DIRECTORIES.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The data-table module this workspace installed, imported by URL from a scratch project. */
const DATA_TABLE = import.meta.resolve("remix/data-table");

/** Runs the model loader for real and answers anything else as a success. */
const EXEC: Exec = async (command, request) => {
	if (command[0] === "bun" || command[0] === "node") return spawnExec(command, request);
	return success({ code: 0, stdout: "", stderr: "", output: "" });
};

/** A project with a `post` model and a chain whose one migration creates `posts` as `sql`. */
async function project(sql: string): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-models-"));
	DIRECTORIES.push(root);
	await writeFile(
		join(root, "package.json"),
		JSON.stringify({ name: "blog", packageManager: "bun@1.4.2" }),
	);
	await mkdir(join(root, "app/models"), { recursive: true });
	await writeFile(
		join(root, "app/models/post.ts"),
		`import { column as c, table } from "${DATA_TABLE}";

export const postsTable = table({
	name: "posts",
	columns: {
		id: c.text().primaryKey(),
		title: c.text(),
		slug: c.text().unique(),
		subtitle: c.text().nullable(),
	},
});
`,
	);
	await writeFile(join(root, "app/models/index.ts"), "export default {};\n");
	await mkdir(join(root, "database/migrations"), { recursive: true });
	await writeFile(join(root, "database/migrations/0001_CreatePosts.sql"), sql);
	return root;
}

/** Runs `sdxc models <argv>` in `cwd`. */
function models(argv: string[], cwd: string) {
	return invoke(createSDXC(), ["models", ...argv], {
		cwd,
		interactive: false,
		env: { PATH: process.env.PATH ?? "" },
		exec: EXEC,
	});
}

describe("models", () => {
	test("lists every model, and prints one in full with the command that catches its chain up", async () => {
		let root = await project(
			'CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT NOT NULL);\n',
		);

		let list = await models([], root);
		let one = await models(["post"], root);

		expect(list.code, list.stderr).toBe(0);
		expect(list.stdout).toBe(
			"Model  File                Table  Columns  Migrations\npost   app/models/post.ts  posts  4        behind\n",
		);
		expect(one.stdout).toContain("slug      text  no             unique");
		expect(one.stdout).toContain("subtitle  text  yes");
		expect(one.stdout).toContain(
			"Migrations: the migrations create a different table; sdxc make migration sync-posts --from-model post writes the SQL that catches them up",
		);
		expect(one.stdout).toContain("Factory: none; sdxc make factory post writes one");
	});

	test("says the chain is in step once it creates the table, and names an unknown model", async () => {
		let root = await project(
			[
				'CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT NOT NULL, "slug" TEXT NOT NULL, "subtitle" TEXT);',
				'CREATE UNIQUE INDEX "posts_slug_unique" ON "posts" ("slug");',
				"",
			].join("\n"),
		);

		let one = await models(["post"], root);
		let unknown = await models(["comment"], root);

		expect(one.stdout).toContain("Migrations: the migrations create this table");
		expect(unknown).toMatchObject({
			code: 1,
			stderr: "No model comment in app/models/; models: post\n",
		});
	});
});
