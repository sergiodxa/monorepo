/**
 * Test support shared by both pools: the migrations as statements, applied in filename
 * order to whichever D1 binding a test holds, and an author for seeded posts to belong
 * to, so a test runs against the tables production reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

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
 * Applies every migration to a D1 binding, one batch per file.
 *
 * @param binding A real or mocked D1 binding holding no schema yet.
 */
export async function applyMigrations(binding: D1Database): Promise<void> {
	for (let path of Object.keys(MIGRATIONS).sort()) {
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
