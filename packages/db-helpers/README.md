# @pkg/db-helpers

Drizzle ORM column helpers for SQLite databases with consistent conventions.

## Overview

This package provides reusable column definitions for Drizzle ORM with SQLite. It establishes consistent patterns for common column types like primary keys, foreign keys, timestamps, and URLs.

## Usage

```typescript
import { pk, fk, uuid, email, url, timestamp } from "@pkg/db-helpers";
import { sqliteTable } from "drizzle-orm/sqlite-core";

export let users = sqliteTable("users", {
	id: pk("id"),
	stripeCustomerId: uuid("stripe_customer_id"), // UUID from external system
	email: email("email").notNull().unique(),
	avatarUrl: url("avatar_url"),
	createdAt: timestamp("created_at"),
});

export let posts = sqliteTable("posts", {
	id: pk("id"),
	authorId: fk("author_id", () => users.id),
	createdAt: timestamp("created_at"),
});
```

## API

### `pk<T extends string>(name: T)`

Creates a primary key column with automatic UUID generation.

**Features:**

- Text column with 36-character length (UUID format)
- Primary key constraint
- Unique constraint
- Auto-generates UUID on insert using `crypto.randomUUID()`

**Example:**

```typescript
let users = sqliteTable("users", {
	id: pk("id"), // Primary key with auto-generated UUID
});
```

### `uuid<T extends string>(name: T)`

Creates a text column for UUID identifiers with a unique constraint. Use this for UUIDs that come from external systems (e.g., a third-party API's user ID).

**Features:**

- Text column with 36-character length (UUID format)
- Unique constraint
- No auto-generation (value must be provided)

**Example:**

```typescript
let users = sqliteTable("users", {
	id: pk("id"),
	stripeCustomerId: uuid("stripe_customer_id"), // UUID from Stripe
	auth0UserId: uuid("auth0_user_id"), // UUID from Auth0
});
```

### `fk<T extends string>(name: T, ref: ReferenceConfig["ref"])`

Creates a foreign key column that references another table's primary key.

**Features:**

- Text column with 36-character length (UUID format)
- References another table's column
- Cascade delete: when parent row is deleted, child rows are deleted
- Cascade update: when parent key changes, child references are updated

**Parameters:**

- `name`: Column name
- `ref`: Reference function pointing to the parent table's column

**Example:**

```typescript
let posts = sqliteTable("posts", {
	id: pk("id"),
	authorId: fk("author_id", () => users.id),
});

let comments = sqliteTable("comments", {
	id: pk("id"),
	postId: fk("post_id", () => posts.id),
	authorId: fk("author_id", () => users.id),
});
```

### `email<T extends string>(name: T)`

Creates a text column for email storage with RFC 5321 compliant length.

**Features:**

- Text column with 254-character length (max email length per RFC 5321)

**Example:**

```typescript
let users = sqliteTable("users", {
	id: pk("id"),
	email: email("email").notNull().unique(),
});

let contactSubmissions = sqliteTable("contact_submissions", {
	id: pk("id"),
	email: email("email").notNull(), // Not unique - multiple submissions allowed
});
```

### `url<T extends string>(name: T)`

Creates a text column for URL storage with RFC 3986 compliant length.

**Features:**

- Text column with 2048-character length (max URL length per RFC 3986)

**Example:**

```typescript
let users = sqliteTable("users", {
	id: pk("id"),
	avatarUrl: url("avatar_url"),
	websiteUrl: url("website_url"),
});
```

### `timestamp<T extends string>(name: T)`

Creates a timestamp column stored as milliseconds since epoch.

**Features:**

- Integer column with `timestamp_ms` mode
- Drizzle automatically converts between JavaScript `Date` objects and milliseconds

**Example:**

```typescript
let posts = sqliteTable("posts", {
	id: pk("id"),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
	publishedAt: timestamp("published_at"),
});
```

## Conventions

### UUID-Based Primary Keys

All IDs use UUIDs (36 characters) for:

- Global uniqueness across databases
- Safe for distributed systems
- No sequential guessing of IDs

### Cascade Behavior

Foreign keys use cascade delete and update:

- **Cascade Delete**: When a parent record is deleted, all child records referencing it are automatically deleted
- **Cascade Update**: When a parent's primary key changes, all references are automatically updated

This simplifies data management but requires careful schema design.

### Timestamp Storage

Timestamps are stored as milliseconds since epoch (integer) rather than text or datetime formats. This provides:

- Precise time representation
- Easy arithmetic operations
- Consistent timezone handling (always UTC)
- Efficient storage and indexing

## Pattern: Complete Table Definition

```typescript
import { pk, fk, uuid, email, url, timestamp } from "@pkg/db-helpers";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export let users = sqliteTable("users", {
	id: pk("id"),
	stripeCustomerId: uuid("stripe_customer_id"),
	email: email("email").notNull().unique(),
	name: text("name", { length: 100 }),
	avatarUrl: url("avatar_url"),
	createdAt: timestamp("created_at")
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at"),
});

export let posts = sqliteTable("posts", {
	id: pk("id"),
	authorId: fk("author_id", () => users.id).notNull(),
	title: text("title", { length: 200 }).notNull(),
	content: text("content"),
	status: text("status", { enum: ["draft", "published", "archived"] })
		.notNull()
		.default("draft"),
	createdAt: timestamp("created_at")
		.notNull()
		.$defaultFn(() => new Date()),
	publishedAt: timestamp("published_at"),
});

export let comments = sqliteTable("comments", {
	id: pk("id"),
	postId: fk("post_id", () => posts.id).notNull(),
	authorId: fk("author_id", () => users.id).notNull(),
	content: text("content").notNull(),
	createdAt: timestamp("created_at")
		.notNull()
		.$defaultFn(() => new Date()),
});
```

## Related Packages

- [Drizzle ORM](https://orm.drizzle.team/) - The ORM these helpers are designed for

## Tips

1. **Use `pk` for primary keys** - Provides auto-generated UUIDs with proper constraints
2. **Use `fk` for references** - Ensures consistent cascade behavior across relationships
3. **Add `.notNull()` to required foreign keys** - The `fk` helper doesn't add `notNull` by default for flexibility
4. **Use `timestamp` for all date/time fields** - Consistent storage format across the database
5. **Consider nullable vs required** - Timestamps like `createdAt` should be `notNull`, while `deletedAt` should be nullable
