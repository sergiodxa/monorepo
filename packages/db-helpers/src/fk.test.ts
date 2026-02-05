import { describe, expect, test } from "bun:test";

import { sqliteTable } from "drizzle-orm/sqlite-core";

import { fk } from "./fk";
import { pk } from "./pk";

describe("fk", () => {
	test("creates a foreign key column", () => {
		let users = sqliteTable("users", {
			id: pk("id"),
		});

		let posts = sqliteTable("posts", {
			id: pk("id"),
			authorId: fk("author_id", () => users.id),
		});

		expect(posts.authorId.name).toBe("author_id");
		expect(posts.authorId.dataType).toBe("string");
	});

	test("is not unique by default", () => {
		let users = sqliteTable("users", {
			id: pk("id"),
		});

		let posts = sqliteTable("posts", {
			id: pk("id"),
			authorId: fk("author_id", () => users.id),
		});

		expect(posts.authorId.isUnique).toBe(false);
	});

	test("is nullable by default", () => {
		let users = sqliteTable("users", {
			id: pk("id"),
		});

		let posts = sqliteTable("posts", {
			id: pk("id"),
			authorId: fk("author_id", () => users.id),
		});

		expect(posts.authorId.notNull).toBe(false);
	});

	test("can be chained with notNull", () => {
		let users = sqliteTable("users", {
			id: pk("id"),
		});

		let posts = sqliteTable("posts", {
			id: pk("id"),
			authorId: fk("author_id", () => users.id).notNull(),
		});

		expect(posts.authorId.notNull).toBe(true);
	});
});
