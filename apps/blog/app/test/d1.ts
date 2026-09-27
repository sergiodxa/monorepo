/**
 * Workers-pool test support: brings the real local D1 binding up to the schema the
 * migrations describe and seeds an author, so a test drives the router against the
 * same tables production reads, with every migration applied in filename order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:test";
import { Database } from "remix/data-table";

import { User } from "~/app/repositories/user";

/** Every migration's SQL, keyed by path, bundled at build time so workerd needs no filesystem. */
const MIGRATIONS = import.meta.glob<string>("../../database/migrations/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
});

/**
 * Splits a migration into statements, dropping `--` comment lines first so a semicolon
 * inside a comment never ends a statement.
 */
function statementsOf(sql: string): string[] {
	let code = sql
		.split("\n")
		.filter((line) => !line.trim().startsWith("--"))
		.join("\n");
	return code
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement !== "");
}

/**
 * Applies every migration once per isolate's storage: a database already holding the
 * `posts` table is left as it is, so test files sharing storage stay independent of order.
 *
 * @returns The data-table database the app's repositories use, over the migrated binding.
 */
export async function migratedDatabase(): Promise<Database> {
	let existing = await env.DB.prepare(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'posts'",
	).all();

	if ((existing.results ?? []).length === 0) {
		for (let path of Object.keys(MIGRATIONS).sort()) {
			let statements = statementsOf(MIGRATIONS[path] ?? "");
			await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
		}
	}

	return new Database(createD1DatabaseAdapter(env.DB));
}

/**
 * Creates an author for posts to belong to, since `posts.author_id` is a foreign key.
 *
 * @param db The migrated database.
 * @returns The new user's id.
 */
export async function seedAuthor(db: Database): Promise<string> {
	let suffix = crypto.randomUUID().slice(0, 8);
	let user = await User.create(db, {
		subjectId: crypto.randomUUID(),
		email: `author-${suffix}@example.com`,
		avatar: "https://example.com/avatar.png",
		username: `author-${suffix}`,
		displayName: "Author",
	});
	if (!user) throw new Error("Seeding the author failed");
	return user.id;
}
