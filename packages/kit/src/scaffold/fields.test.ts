/**
 * How `sdxc scaffold` and `sdxc make model` read their fields, the type each bare name takes by
 * convention, the columns a field becomes, and how a name is pluralized.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { column, table } from "remix/data-table";
import { describe, expect, test } from "vitest";

import { createTableStatement } from "../make/schema.js";

import {
	buildColumn,
	columnSource,
	conventionalType,
	parseFields,
	pluralize,
	resolveReferences,
} from "./fields.js";

describe("parseFields", () => {
	test("spells each name as a column, a label, a flag and a key", () => {
		let fields = unwrap(parseFields(["title", "publishedOn:date", "view-count:integer"]));

		expect(fields).toEqual([
			{
				column: "title",
				label: "Title",
				flag: "title",
				key: "title",
				type: "string",
				nullable: false,
			},
			{
				column: "published_on",
				label: "Published on",
				flag: "published-on",
				key: "publishedOn",
				type: "date",
				nullable: false,
			},
			{
				column: "view_count",
				label: "View count",
				flag: "view-count",
				key: "viewCount",
				type: "integer",
				nullable: false,
			},
		]);
	});

	test.each([
		["title", "string"],
		["name", "string"],
		["published_at", "timestamp"],
		["publishedAt", "timestamp"],
		["starts_on", "date"],
		["due_date", "date"],
		["birthday", "date"],
		["is_public", "boolean"],
		["has_paid", "boolean"],
		["can_comment", "boolean"],
		["published", "boolean"],
		["active", "boolean"],
		["enabled", "boolean"],
		["archived", "boolean"],
		["view_count", "integer"],
		["price_cents", "integer"],
		["position", "integer"],
		["quantity", "integer"],
		["age", "integer"],
		["email", "email"],
		["billing_email", "email"],
		["url", "url"],
		["avatar_url", "url"],
		["website", "url"],
		["body", "text"],
		["description", "text"],
		["content", "text"],
		["notes", "text"],
		["bio", "text"],
		["short_description", "text"],
		["author_id", "references"],
		["password_hash", "string"],
	])("a bare %s is %s", (name, type) => {
		expect(unwrap(parseFields([name]))[0]?.type).toBe(type);
	});

	test.each([
		["published_at:date", "date"],
		["email:string", "string"],
		["author_id:string", "string"],
		["body:string", "string"],
		["view_count:text", "text"],
		["at", "string"],
		["id_card", "string"],
	])("%s overrides or misses every convention, as %s", (spec, type) => {
		expect(unwrap(parseFields([spec]))[0]?.type).toBe(type);
	});

	test("a trailing ? on the name or the type makes the field nullable", () => {
		let fields = unwrap(parseFields(["bio?", "subtitle:string?", "title"]));

		expect(fields.map((field) => [field.column, field.type, field.nullable])).toEqual([
			["bio", "text", true],
			["subtitle", "string", true],
			["title", "string", false],
		]);
	});

	test("a reference names its column after the model, and points at the plural table", () => {
		let fields = unwrap(parseFields(["author:references", "blog_category_id", "editor_id?"]));

		expect(fields.map((field) => [field.column, field.reference, field.nullable])).toEqual([
			["author_id", { model: "author", table: "authors", key: "text" }, false],
			[
				"blog_category_id",
				{ model: "blog-category", table: "blog_categories", key: "text" },
				false,
			],
			["editor_id", { model: "editor", table: "editors", key: "text" }, true],
		]);
	});

	test("an empty list parses to no fields", () => {
		expect(unwrap(parseFields([]))).toEqual([]);
	});

	test.each([
		[["title:varchar"], '"varchar" in "title:varchar" is not a field type'],
		[["id"], "id is a column of every table"],
		[["created_at:integer"], "created_at is a column of every table"],
		[["title", "Title"], "title is listed twice"],
		[["1st"], '"1st" is not a field name'],
		[["a:b:c"], '"a:b:c" is not a field'],
		[["published?"], "published is a box, ticked or not"],
		[["password"], "password would keep a password as typed"],
		[["admin_password:string"], "admin_password would keep a password as typed"],
		[["id:references"], "id is a column of every table"],
	])("refuses %j", (specs, message) => {
		let parsed = parseFields(specs);

		expect(isFailure(parsed) && parsed.error.message).toContain(message);
	});
});

describe("conventionalType", () => {
	test("checks a timestamp before a box, so published_at and published differ", () => {
		expect(conventionalType(["published", "at"])).toBe("timestamp");
		expect(conventionalType(["published"])).toBe("boolean");
	});
});

describe("columns", () => {
	test("writes each type's column, a reference's foreign key and a nullable column", () => {
		let fields = unwrap(
			parseFields(["title", "published_at", "bio?", "author_id", "views:integer"]),
		);

		expect(fields.map((field) => columnSource(field, "posts"))).toEqual([
			"c.text()",
			"c.integer()",
			"c.text().nullable()",
			'c.text().references("authors", "posts_author_id_fkey")',
			"c.integer()",
		]);
	});

	test("the built columns render as the migration's statement", () => {
		let fields = unwrap(parseFields(["title", "published_at", "bio?", "author_id"]));
		let columns = Object.fromEntries(
			fields.map((field) => [field.column, buildColumn(field, "posts", column)]),
		);

		let sql = createTableStatement(
			table({ name: "posts", columns: { id: column.text().primaryKey(), ...columns } }),
		);

		expect(sql).toContain('"title" TEXT NOT NULL');
		expect(sql).toContain('"published_at" INTEGER NOT NULL');
		expect(sql).toContain('"bio" TEXT,');
		expect(sql).toContain(
			'CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors" ("id")',
		);
	});
});

describe("resolveReferences", () => {
	test("points a reference at the table and id type its model declares", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-fields-"));
		await mkdir(join(root, "app/models"), { recursive: true });
		await writeFile(
			join(root, "app/models/author.ts"),
			'export const authorTable = table({\n\tname: "author",\n\tcolumns: {\n\t\tid: c.integer().primaryKey(),\n\t},\n});\n',
		);
		let fields = unwrap(parseFields(["author_id", "editor_id"]));

		let resolved = await resolveReferences(root, fields);
		await rm(root, { recursive: true, force: true });

		expect(resolved.map((field) => field.reference)).toEqual([
			{ model: "author", table: "author", key: "integer" },
			{ model: "editor", table: "editors", key: "text" },
		]);
	});
});

describe("pluralize", () => {
	test.each([
		["post", "posts"],
		["blog-post", "blog-posts"],
		["box", "boxes"],
		["match", "matches"],
		["category", "categories"],
		["day", "days"],
	])("%s becomes %s", (singular, plural) => {
		expect(pluralize(singular)).toBe(plural);
	});
});
