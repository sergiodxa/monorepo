/**
 * Runtime-defined post types: the field/definition types, the naming rules and
 * reserved-word sets, and the {@link PostType} repository with validation and
 * built-in protection. Post types are the engine's answer to WordPress custom types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import type { SelectPostType } from "../../database/schema.js";

import { postTypes } from "../../database/schema.js";

/** The field input kinds available for a custom field, each holding a single flat value. */
export type FieldKind = "text" | "textarea" | "markdown" | "date" | "url" | "boolean" | "tags";

/** A single custom field on a post type. */
export interface FieldDefinition {
	/** ^[a-z][a-z0-9_]*$, unique per type, not in {@link RESERVED_FIELD_KEYS}. */
	key: string;
	label: string;
	kind: FieldKind;
	required: boolean;
	/** Optional help text rendered under the input. */
	description?: string;
}

/** A post type resolved from a DB row (fields parsed from JSON). */
export interface PostTypeDefinition {
	id: string;
	name: string;
	path: string;
	label: string;
	description: string;
	fields: FieldDefinition[];
	builtin: boolean;
	visible: boolean;
}

/** Slug shape shared by post-type `name` and `path`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Field-key shape: lowercase, underscore-separated. */
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Core columns + implicit fields a user definition may not shadow. */
export const RESERVED_FIELD_KEYS = new Set([
	"id",
	"slug",
	"type",
	"author_id",
	"title",
	"published_at",
	"created_at",
	"updated_at",
]);

/** Route segments a post type `path` may never use (reserved by the engine). */
export const RESERVED_PATHS = new Set([
	"cms",
	"auth",
	"assets",
	"rss.xml",
	"sitemap.xml",
	"robots.txt",
	"frames",
]);

/** The built-in article type name (referentially linked to `posts.type`). */
export const ARTICLE_TYPE_NAME = "article";

const ALL_KINDS: ReadonlySet<string> = new Set<FieldKind>([
	"text",
	"textarea",
	"markdown",
	"date",
	"url",
	"boolean",
	"tags",
]);

/** Input accepted by {@link PostType.create}/{@link PostType.update}. */
export interface PostTypeInput {
	name: string;
	path: string;
	label: string;
	description?: string;
	fields: FieldDefinition[];
	visible?: boolean;
}

/** Repository for runtime-defined post types with built-in protection. */
export class PostType {
	/** Table reference shared by all queries. */
	static table = postTypes;

	/** Thrown when a post-type mutation violates an invariant. */
	static InvalidError = class extends Error {
		constructor(message: string) {
			super(message);
			this.name = "PostTypeInvalidError";
		}
	};

	/**
	 * Lists all post types.
	 * @param db - Database handle.
	 * @returns Every post type as a parsed definition.
	 */
	static async findAll(db: Database): Promise<PostTypeDefinition[]> {
		let rows = await db.findMany(this.table);
		return rows.map((row) => this.toDefinition(row));
	}

	/**
	 * Lists post types that participate in public routes/feeds/sitemap.
	 * @param db - Database handle.
	 * @returns The visible post types as parsed definitions.
	 */
	static async findVisible(db: Database): Promise<PostTypeDefinition[]> {
		let rows = await db.findMany(this.table, { where: { visible: 1 } });
		return rows.map((row) => this.toDefinition(row));
	}

	/**
	 * Finds a post type by machine name.
	 * @param db - Database handle.
	 * @param name - The machine name (== `posts.type`).
	 * @returns The parsed definition, or `null` when not found.
	 */
	static async findByName(db: Database, name: string): Promise<PostTypeDefinition | null> {
		let row = await db.findOne(this.table, { where: { name } });
		return row ? this.toDefinition(row) : null;
	}

	/**
	 * Finds a post type by its public path segment.
	 * @param db - Database handle.
	 * @param path - The plural URL segment (e.g. "articles").
	 * @returns The parsed definition, or `null` when not found.
	 */
	static async findByPath(db: Database, path: string): Promise<PostTypeDefinition | null> {
		let row = await db.findOne(this.table, { where: { path } });
		return row ? this.toDefinition(row) : null;
	}

	/**
	 * Creates a custom post type after validating its shape and uniqueness.
	 * @param db - Database handle.
	 * @param input - The post type to create.
	 * @returns The created post type definition.
	 * @throws {PostType.InvalidError} On invalid input or a duplicate name/path.
	 */
	static async create(db: Database, input: PostTypeInput): Promise<PostTypeDefinition> {
		this.validate(input);
		if (await this.findByName(db, input.name)) {
			throw new this.InvalidError(`A post type named "${input.name}" already exists.`);
		}
		if (await this.findByPath(db, input.path)) {
			throw new this.InvalidError(`A post type with path "${input.path}" already exists.`);
		}

		let now = new Date().toISOString();
		let id = `pt_${crypto.randomUUID()}`;
		await db.create(this.table, {
			id,
			name: input.name,
			path: input.path,
			label: input.label,
			description: input.description ?? "",
			fields: JSON.stringify(input.fields),
			builtin: 0,
			visible: input.visible === false ? 0 : 1,
			created_at: now,
			updated_at: now,
		});
		let created = await this.findByName(db, input.name);
		if (!created) throw new this.InvalidError("Failed to create post type.");
		return created;
	}

	/**
	 * Updates a post type. Built-in types keep their `name` and may only append
	 * fields (existing seeded fields cannot be removed or re-kinded).
	 * @param db - Database handle.
	 * @param id - The post type id to update.
	 * @param input - The new post type values.
	 * @returns The updated post type definition.
	 * @throws {PostType.InvalidError} When not found, invalid, or violating built-in rules.
	 */
	static async update(db: Database, id: string, input: PostTypeInput): Promise<PostTypeDefinition> {
		let existingRow = await db.findOne(this.table, { where: { id } });
		if (!existingRow) throw new this.InvalidError("Post type not found.");
		let existing = this.toDefinition(existingRow);

		this.validate(input);

		if (existing.builtin) {
			if (input.name !== existing.name) {
				throw new this.InvalidError("The built-in type's name cannot be changed.");
			}
			this.assertBuiltinFieldsPreserved(existing.fields, input.fields);
		}

		await db.update(
			this.table,
			{ id },
			{
				name: existing.builtin ? existing.name : input.name,
				path: input.path,
				label: input.label,
				description: input.description ?? "",
				fields: JSON.stringify(input.fields),
				visible: input.visible === false ? 0 : 1,
				updated_at: new Date().toISOString(),
			},
		);
		let updated = await db.findOne(this.table, { where: { id } });
		if (!updated) throw new this.InvalidError("Failed to update post type.");
		return this.toDefinition(updated);
	}

	/**
	 * Deletes a custom post type (built-ins cannot be deleted). No-op when missing.
	 * @param db - Database handle.
	 * @param id - The post type id to delete.
	 * @throws {PostType.InvalidError} When the target is a built-in type.
	 */
	static async destroy(db: Database, id: string): Promise<void> {
		let row = await db.findOne(this.table, { where: { id } });
		if (!row) return;
		if (row.builtin) throw new this.InvalidError("Built-in post types cannot be deleted.");
		await db.delete(this.table, { id });
	}

	/**
	 * Validates a post type's shape and rules: slug patterns for name/path, reserved
	 * paths, a non-empty label, and per-field key/kind/uniqueness constraints.
	 * @param input - The post type input to validate.
	 * @throws {PostType.InvalidError} On the first rule violation.
	 */
	static validate(input: PostTypeInput): void {
		if (!SLUG_PATTERN.test(input.name)) {
			throw new this.InvalidError("Name must be lowercase letters, numbers, and dashes.");
		}
		if (!SLUG_PATTERN.test(input.path)) {
			throw new this.InvalidError("Path must be lowercase letters, numbers, and dashes.");
		}
		if (RESERVED_PATHS.has(input.path)) {
			throw new this.InvalidError(`"${input.path}" is a reserved path.`);
		}
		if (!input.label.trim()) throw new this.InvalidError("Label is required.");

		let seen = new Set<string>();
		for (let field of input.fields) {
			if (!FIELD_KEY_PATTERN.test(field.key)) {
				throw new this.InvalidError(`Invalid field key "${field.key}".`);
			}
			if (RESERVED_FIELD_KEYS.has(field.key)) {
				throw new this.InvalidError(`"${field.key}" is a reserved field key.`);
			}
			if (seen.has(field.key)) {
				throw new this.InvalidError(`Duplicate field key "${field.key}".`);
			}
			if (!ALL_KINDS.has(field.kind)) {
				throw new this.InvalidError(`Unknown field kind "${field.kind}".`);
			}
			seen.add(field.key);
		}
	}

	private static assertBuiltinFieldsPreserved(
		before: FieldDefinition[],
		after: FieldDefinition[],
	): void {
		let afterByKey = new Map(after.map((field) => [field.key, field]));
		for (let field of before) {
			let next = afterByKey.get(field.key);
			if (!next) throw new this.InvalidError(`Built-in field "${field.key}" cannot be removed.`);
			if (next.kind !== field.kind) {
				throw new this.InvalidError(`Built-in field "${field.key}" cannot change kind.`);
			}
		}
	}

	/**
	 * Maps a DB row to a parsed {@link PostTypeDefinition}, tolerating malformed
	 * `fields` JSON by treating it as a type with no custom fields.
	 * @param row - The raw `post_types` row.
	 * @returns The parsed definition.
	 */
	static toDefinition(row: SelectPostType): PostTypeDefinition {
		let fields: FieldDefinition[] = [];
		try {
			let parsed: unknown = JSON.parse(row.fields);
			if (Array.isArray(parsed)) fields = parsed as FieldDefinition[];
		} catch {}
		return {
			id: row.id,
			name: row.name,
			path: row.path,
			label: row.label,
			description: row.description,
			fields,
			builtin: row.builtin === 1,
			visible: row.visible === 1,
		};
	}
}
