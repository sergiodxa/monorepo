---
title: How to Create Reusable Drizzle Column Factories
excerpt: Build factory functions for common column patterns in Drizzle ORM to reduce repetition.
tech: drizzle-orm@0.30.0
---

When working with Drizzle ORM, you often find yourself repeating the same column definitions across multiple tables. Every table needs a primary key, many need timestamps, and foreign keys require consistent referential integrity settings. Instead of copying and pasting these patterns, you can create factory functions that encapsulate your conventions.

This approach keeps your schema DRY, ensures consistency across tables, and makes it easy to change conventions in one place. These factories work well alongside patterns like the [Entity-Attribute-Value pattern](/tutorials/implement-entity-attribute-value-pattern-with-drizzle) for flexible schemas. Let's build a set of reusable column factories for common patterns: primary keys with auto-generated UUIDs, foreign keys with cascade behavior, timestamps, and URL fields.

## Create a UUID Column Factory

Start with a basic UUID column factory. This creates a text column with the correct length for UUIDs and a unique constraint.

```ts {% path="lib/db-helpers/uuid.ts" %}
import { text } from "drizzle-orm/sqlite-core";

const UUID_LENGTH = 36;

export function uuid<T extends string>(name: T) {
	return text(name, { mode: "text", length: UUID_LENGTH }).unique();
}
```

The generic `<T extends string>` preserves the literal type of the column name, which Drizzle uses for type inference. This factory returns a column builder, so you can chain additional methods like `.notNull()` when using it.

## Create a Primary Key Factory

Build on the UUID factory to create primary keys that auto-generate UUIDs.

```ts {% path="lib/db-helpers/pk.ts" %}
import { uuid } from "./uuid";

export function pk<T extends string>(name: T) {
	return uuid(name)
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
}
```

The `$defaultFn` method tells Drizzle to generate a UUID when inserting a row without an explicit ID. This runs on the application side, not in the database, which works well with SQLite and Cloudflare D1.

## Create a Foreign Key Factory

Foreign keys need consistent referential integrity settings. Create a factory that enforces cascade behavior.

```ts {% path="lib/db-helpers/fk.ts" %}
import { type ReferenceConfig, text } from "drizzle-orm/sqlite-core";

const UUID_LENGTH = 36;

export function fk<T extends string>(name: T, ref: ReferenceConfig["ref"]) {
	return text(name, { mode: "text", length: UUID_LENGTH }).references(ref, {
		onDelete: "cascade",
		onUpdate: "cascade",
	});
}
```

The `ReferenceConfig["ref"]` type comes from Drizzle and accepts a function that returns the referenced column. Using cascade for both delete and update ensures that when a parent row is deleted or its ID changes, related rows are automatically handled.

## Create a Timestamp Factory

Timestamps stored as integers (milliseconds since epoch) work well with SQLite.

```ts {% path="lib/db-helpers/timestamps.ts" %}
import { integer } from "drizzle-orm/sqlite-core";

export function timestamp<T extends string>(name: T) {
	return integer(name, { mode: "timestamp_ms" });
}
```

The `timestamp_ms` mode tells Drizzle to convert between JavaScript `Date` objects and integer milliseconds automatically. This factory returns a column builder, so you can add `.notNull()` or `.$defaultFn()` as needed.

## Create a URL Column Factory

URLs have a standard maximum length defined by RFC 3986. Create a factory that enforces this.

```ts {% path="lib/db-helpers/url.ts" %}
import { text } from "drizzle-orm/sqlite-core";

const URL_LENGTH = 2048;

export function url<T extends string>(name: T) {
	return text(name, {
		mode: "text",
		length: URL_LENGTH,
	});
}
```

This ensures all URL columns in your schema use the same length constraint without repeating the magic number.

## Use the Factories in Your Schema

Now use these factories to define tables with minimal repetition.

```ts {% path="app/db/schema.ts" %}
import { fk, pk, timestamp } from "~/lib/db-helpers";
import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = timestamp("created_at")
	.notNull()
	.$defaultFn(() => new Date());

const updatedAt = timestamp("updated_at")
	.notNull()
	.$defaultFn(() => new Date())
	.$onUpdateFn(() => new Date());

export const users = sqliteTable("users", {
	id: pk("id"),
	createdAt,
	updatedAt,
	displayName: text("display_name", { mode: "text" }).notNull(),
	email: text("email", { mode: "text" }).unique().notNull(),
});

export const posts = sqliteTable("posts", {
	id: pk("id"),
	createdAt,
	updatedAt,
	authorId: fk("author_id", () => users.id).notNull(),
	title: text("title", { mode: "text" }).notNull(),
	content: text("content", { mode: "text" }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => {
	return { posts: many(posts) };
});

export const postsRelations = relations(posts, ({ one }) => {
	return {
		author: one(users, {
			fields: [posts.authorId],
			references: [users.id],
		}),
	};
});
```

Notice how `createdAt` and `updatedAt` are defined once and reused across tables. The `pk()` factory handles ID generation, and `fk()` ensures consistent cascade behavior. Each table definition is concise and focuses on what makes it unique.

## Add Optional Timestamps

Some timestamps are optional, like `verifiedAt` or `deletedAt`. Use the base `timestamp()` factory without defaults.

```ts {% path="app/db/schema.ts" %}
export const sessions = sqliteTable("sessions", {
	id: pk("id"),
	createdAt,
	updatedAt,
	expiresAt: timestamp("expires_at")
		.notNull()
		.$defaultFn(() => {
			let date = new Date();
			date.setDate(date.getDate() + 30);
			return date;
		}),
	userId: fk("user_id", () => users.id).notNull(),
});
```

The `expiresAt` column uses a custom default function that sets expiration to 30 days from creation. This pattern works for any timestamp that needs custom default logic.

## Final Thoughts

Column factories reduce repetition and enforce consistency across your Drizzle schema. Start with the patterns you repeat most often: primary keys, foreign keys, and timestamps. As your schema grows, you can add more factories for domain-specific patterns like URLs, email addresses, or JSON columns with specific shapes. When querying data from these tables, consider [lazy loading related data](/tutorials/add-lazy-loading-for-related-data-in-drizzle) to avoid fetching more than you need.

The key insight is that Drizzle's column builders are composable. Your factories return column builders that can be further customized with `.notNull()`, `.$defaultFn()`, or any other method. This gives you the benefits of standardization without sacrificing flexibility. To take your schema patterns further, consider [wrapping your tables in class-based models](/articles/class-based-models-with-drizzle-orm) for encapsulated business logic.
