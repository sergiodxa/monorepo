/**
 * Test support shared by both pools: the migrations as statements, applied in filename
 * order to whichever D1 binding a test holds, and an author for seeded posts to belong
 * to, so a test runs against the tables production reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";

import { bindModels } from "~/app/test/models";

/** Every migration's SQL, keyed by path, bundled at build time so workerd needs no filesystem. */
const MIGRATIONS = import.meta.glob<string>("../../database/migrations/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});

/** A statement opening a trigger, whose body holds semicolons of its own until `END`. */
const CREATE_TRIGGER = /^CREATE\s+TRIGGER\b/i;

/** A trigger body's closing keyword, ending the statement a trigger opened. */
const TRIGGER_END = /\bEND$/i;

/**
 * Splits a migration into statements, dropping `--` comment lines first so a semicolon
 * inside a comment never ends a statement, and keeping a `CREATE TRIGGER` whole through
 * its `END`, since the semicolons inside its body end its inner statements only.
 */
function statementsOf(sql: string): string[] {
	let code = sql
		.split("\n")
		.filter((line) => !line.trim().startsWith("--"))
		.join("\n");

	let statements: string[] = [];
	let pending = "";
	for (let piece of code.split(";")) {
		pending = pending === "" ? piece : `${pending};${piece}`;
		let statement = pending.trim();
		if (CREATE_TRIGGER.test(statement) && !TRIGGER_END.test(statement)) continue;
		if (statement !== "") statements.push(statement);
		pending = "";
	}
	return statements;
}

/**
 * Applies migrations to a D1 binding in filename order, every one unless `only` narrows
 * them, so a test can seed rows under an older schema and then apply the rest.
 *
 * @param binding A real or mocked D1 binding holding none of the selected migrations yet.
 * @param only Picks migrations by file name, such as `0006_PostSearch.sql`.
 */
export async function applyMigrations(
	binding: D1Database,
	only: (file: string) => boolean = () => true,
): Promise<void> {
	for (let path of Object.keys(MIGRATIONS).sort()) {
		if (!only(path.slice(path.lastIndexOf("/") + 1))) continue;
		let statements = statementsOf(MIGRATIONS[path] ?? "");
		for (let statement of statements) await binding.prepare(statement).run();
	}
}

/**
 * Creates an author for posts to belong to, since `posts.author_id` is a foreign key.
 *
 * @param db The migrated database.
 * @returns The new user's id.
 */
export async function seedAuthor(db: Database): Promise<string> {
	let suffix = crypto.randomUUID().slice(0, 8);
	let user = unwrap(
		await bindModels(db).users.create({
			subject_id: crypto.randomUUID(),
			email: `author-${suffix}@example.com`,
			avatar: "https://example.com/avatar.png",
			username: `author-${suffix}`,
			display_name: "Author",
		}),
	);
	return user.id;
}
