---
title: How to Implement Entity-Attribute-Value Pattern with Drizzle
excerpt: Store dynamic attributes in a flexible schema using the EAV pattern with Drizzle ORM.
tech: drizzle-orm@0.30.0
---

Imagine you're building a content management system where different types of content have different attributes. A blog post might have a title, slug, and body, while a like might only have a URL. A comment might have content and a parent reference. The challenge is storing all these in a single table without creating dozens of nullable columns.

The Entity-Attribute-Value (EAV) pattern solves this by storing attributes as rows instead of columns. Each attribute becomes a key-value pair linked to the main entity. This gives you flexibility to add new attributes without schema migrations, while keeping your main table clean and focused on shared properties. You can use [column factories](/tutorials/create-reusable-drizzle-column-factories) to standardize the common columns across your EAV tables.

## Define the Main Entity Table

Start with a `posts` table that contains only the shared attributes across all post types:

```ts {% path="app/db/schema.ts" %}
import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export let posts = sqliteTable("posts", {
	id: text("id").primaryKey(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
	authorId: text("author_id").notNull(),
	type: text("type", {
		enum: ["like", "tutorial", "article", "comment", "glossary"],
	}).notNull(),
});
```

This table stores the entity identifier, timestamps, author reference, and a `type` discriminator. The `type` column lets you filter posts by their kind without querying the metadata.

## Create the Metadata Table

Now create a separate table to store the dynamic attributes:

```ts {% path="app/db/schema.ts" %}
export let postMeta = sqliteTable("post_meta", {
	id: text("id").primaryKey(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
	postId: text("post_id")
		.notNull()
		.references(() => posts.id, { onDelete: "cascade" }),
	key: text("key").notNull(),
	value: text("value").notNull(),
});
```

Each row represents a single attribute: `key` is the attribute name (like `title` or `slug`), and `value` stores the data. The `postId` foreign key links back to the main entity, and `onDelete: "cascade"` ensures metadata is cleaned up when a post is deleted.

## Set Up Drizzle Relations

Define the relations so Drizzle can load metadata alongside posts:

```ts {% path="app/db/schema.ts" %}
export let postRelation = relations(posts, ({ many }) => {
	return {
		meta: many(postMeta),
	};
});

export let postMetaRelation = relations(postMeta, ({ one }) => {
	return {
		post: one(posts, { fields: [postMeta.postId], references: [posts.id] }),
	};
});
```

These relations enable Drizzle's relational queries to fetch posts with their metadata in a single query using the `with` option. If you don't always need the metadata, consider [lazy loading](/tutorials/add-lazy-loading-for-related-data-in-drizzle) to fetch it only when accessed.

## Query Posts with Metadata

Use Drizzle's relational queries to fetch posts along with their metadata:

```ts {% path="app/models/post.server.ts" %}
import { desc, eq } from "drizzle-orm";
import * as schema from "~/db/schema";

export async function listPosts(db: Database, type?: string) {
	let posts = await db.query.posts.findMany({
		with: { meta: true },
		orderBy: desc(schema.posts.createdAt),
		where: type ? eq(schema.posts.type, type) : undefined,
	});

	return posts.map((post) => ({
		...post,
		meta: reduceMeta(post.meta),
	}));
}
```

The `with: { meta: true }` option tells Drizzle to include all related metadata rows. The `reduceMeta` function (shown below) transforms the array of key-value pairs into a usable object.

## Transform Metadata into an Object

The metadata comes back as an array of rows. Transform it into a key-value object:

```ts {% path="app/models/post.server.ts" %}
interface BaseMeta {
	[key: string]: unknown;
}

function reduceMeta<Meta extends BaseMeta>(meta: Array<{ key: string; value: string }>): Meta {
	return meta.reduce((acc, { key, value }) => {
		if (key in acc) {
			let existing = acc[key];
			if (Array.isArray(existing)) {
				return { ...acc, [key]: [...existing, value] };
			}
			return { ...acc, [key]: [existing, value] };
		}
		return { ...acc, [key]: value };
	}, {} as Meta);
}
```

This function handles a subtle case: when the same key appears multiple times, it automatically converts the value to an array. This lets you store multi-value attributes like tags without special handling.

## Create Posts with Metadata

When creating a post, insert the main record first, then add metadata rows:

```ts {% path="app/models/post.server.ts" %}
export async function createPost<Meta extends BaseMeta>(
	db: Database,
	{ authorId, type, ...meta }: { authorId: string; type: string } & Meta,
) {
	let id = generateId();

	await db.insert(schema.posts).values({ id, type, authorId });

	await Promise.all(
		Object.entries(meta).map(([key, value]) => {
			return createPostMeta(db, id, key, value);
		}),
	);

	return showPost(db, type, id);
}
```

The spread operator separates known fields (`authorId`, `type`) from dynamic metadata. Each metadata entry is inserted as a separate row.

## Handle Different Value Types

Metadata values need to be stored as strings. Handle different types appropriately:

```ts {% path="app/models/post.server.ts" %}
async function createPostMeta(
	db: Database,
	postId: string,
	key: string,
	value: unknown,
): Promise<void> {
	if (!value) return;

	if (typeof value === "string") {
		await db.insert(schema.postMeta).values({ postId, key, value });
		return;
	}

	if (typeof value === "boolean" || typeof value === "number") {
		return createPostMeta(db, postId, key, value.toString());
	}

	if (Array.isArray(value)) {
		await Promise.all(value.map((item) => createPostMeta(db, postId, key, item)));
		return;
	}
}
```

This recursive function handles strings directly, converts numbers and booleans to strings, and creates multiple rows for arrays. The same key with multiple values becomes an array when read back.

## Update Posts with Metadata

For updates, the simplest approach is to delete existing metadata and recreate it:

```ts {% path="app/models/post.server.ts" %}
export async function updatePost<Meta extends BaseMeta>(
	db: Database,
	id: string,
	{ authorId, type, ...meta }: { authorId: string; type: string } & Meta,
) {
	await db
		.update(schema.posts)
		.set({ type, authorId, updatedAt: new Date().toISOString() })
		.where(eq(schema.posts.id, id));

	await db.delete(schema.postMeta).where(eq(schema.postMeta.postId, id));

	await Promise.all(
		Object.entries(meta).map(([key, value]) => {
			return createPostMeta(db, id, key, value);
		}),
	);

	return showPost(db, type, id);
}
```

Deleting and recreating metadata is simpler than diffing changes, and the cascade delete on the foreign key keeps things consistent. For high-traffic applications, you might want to optimize this with upserts.

## Add Type Safety with Generics

Use TypeScript generics to type the metadata for different post types:

```ts {% path="app/models/post.server.ts" %}
interface TutorialMeta {
	title: string;
	slug: string;
	body: string;
	technologies: string[];
}

interface LikeMeta {
	url: string;
}

// Usage
let tutorial = await createPost<TutorialMeta>(db, {
	authorId: user.id,
	type: "tutorial",
	title: "How to Use EAV",
	slug: "how-to-use-eav",
	body: "Content here...",
	technologies: ["drizzle-orm", "typescript"],
});

let like = await createPost<LikeMeta>(db, {
	authorId: user.id,
	type: "like",
	url: "https://example.com/article",
});
```

The generic parameter ensures you pass the correct metadata shape for each post type, while the underlying storage remains flexible. For a more structured approach, you can [wrap these functions in a class-based model](/articles/class-based-models-with-drizzle-orm) that encapsulates the type-specific logic.

## Final Thoughts

The EAV pattern trades query simplicity for schema flexibility. It works well when you have many entity types with varying attributes, or when attributes change frequently. The tradeoff is that querying specific attributes requires joins or post-processing, and you lose database-level type checking on values. When using EAV in loaders, be mindful of [query waterfalls](/tutorials/avoid-waterfalls-of-queries-in-remix-loaders) and [load only the data you need](/tutorials/load-only-the-data-you-need-in-remix) to keep performance optimal.

For applications with stable schemas, traditional columns are usually better. But for content systems, user-defined fields, or multi-tenant applications where each tenant has different data needs, EAV provides the flexibility you need without constant migrations.
