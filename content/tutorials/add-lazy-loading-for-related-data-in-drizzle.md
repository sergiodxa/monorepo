---
title: How to Add Lazy Loading for Related Data in Drizzle
excerpt: Load related data on demand using lazy getters with caching to avoid N+1 queries.
tech: drizzle-orm@0.30.0
---

When building applications with Drizzle ORM, you often need to access related data like an author for a post or comments for an article. The challenge is that you don't always need this related data, and eagerly loading it every time wastes database queries and bandwidth.

The solution is to implement lazy loading: fetch related data only when it's actually accessed, and cache the result so subsequent accesses don't trigger additional queries. This pattern complements strategies like [avoiding query waterfalls](/tutorials/avoid-waterfalls-of-queries-in-remix-loaders) and [loading only the data you need](/tutorials/load-only-the-data-you-need-in-remix). It's especially useful in scenarios where you list many records but only need related data for some of them, or when the related data is expensive to fetch.

## Create the Model Class with Services

Start by creating a model class that wraps your Drizzle query results. The class receives a services object containing the database connection, which it uses for lazy loading.

```ts {% path="app/models/post.server.ts" %}
import { eq } from "drizzle-orm";

import type { Database } from "~/db";
import type { UUID } from "~/utils/uuid";

import * as schema from "~/db/schema";

interface Services {
	db: Database;
}

export class Post {
	readonly id: UUID;
	readonly authorId: UUID;
	readonly title: string;
	readonly createdAt: Date;

	constructor(
		protected services: Services,
		input: { id: UUID; authorId: UUID; title: string; createdAt: Date },
	) {
		this.id = input.id;
		this.authorId = input.authorId;
		this.title = input.title;
		this.createdAt = input.createdAt;
	}
}
```

The `services` object is stored as a protected property so the class can use it internally for database queries. This [dependency injection pattern](/articles/dependency-injection-in-remix-loaders-and-actions) makes the class easy to test by allowing you to pass mock services. The constructor accepts the raw data and assigns it to readonly properties. You can use [column factories](/tutorials/create-reusable-drizzle-column-factories) to standardize the column definitions in your schema.

## Add a Lazy Getter for Related Data

Now add a getter that fetches the related author only when accessed. The key is to store the promise in a private property so subsequent calls return the cached result.

```ts {% path="app/models/post.server.ts" %}
export class Post {
	readonly id: UUID;
	readonly authorId: UUID;
	readonly title: string;
	readonly createdAt: Date;

	private authorPromise?: Promise<schema.SelectUser>;

	constructor(
		protected services: Services,
		input: { id: UUID; authorId: UUID; title: string; createdAt: Date },
	) {
		this.id = input.id;
		this.authorId = input.authorId;
		this.title = input.title;
		this.createdAt = input.createdAt;
	}

	get author() {
		if (this.authorPromise) return this.authorPromise;
		this.authorPromise = this.services.db.query.users
			.findFirst({
				where: eq(schema.users.id, this.authorId),
			})
			.then((author) => {
				if (author) return author;
				throw new Error(`Couldn't find author with id ${this.authorId} on post ${this.id}.`);
			});
		return this.authorPromise;
	}
}
```

The `author` getter checks if `authorPromise` already exists. If it does, it returns the cached promise immediately. If not, it creates a new promise that queries the database, stores it, and returns it.

This means the first call to `post.author` triggers a database query, but all subsequent calls return the same promise without hitting the database again.

## Add Static Methods to Create Model Instances

Add static methods that query the database and return model instances. These methods pass the database connection to each instance so they can perform lazy loading.

```ts {% path="app/models/post.server.ts" %}
import { desc, eq } from "drizzle-orm";

export class Post {
	// ... properties and constructor

	static async list({ db }: Services) {
		let posts = await db.query.posts.findMany({
			orderBy: desc(schema.posts.createdAt),
		});

		return posts.map(
			(post) =>
				new Post(
					{ db },
					{
						id: post.id,
						authorId: post.authorId,
						title: post.title,
						createdAt: post.createdAt,
					},
				),
		);
	}

	static async show({ db }: Services, id: UUID) {
		let post = await db.query.posts.findFirst({
			where: eq(schema.posts.id, id),
		});

		if (!post) throw new Error(`Couldn't find post with Id ${id}`);

		return new Post(
			{ db },
			{
				id: post.id,
				authorId: post.authorId,
				title: post.title,
				createdAt: post.createdAt,
			},
		);
	}
}
```

Each static method creates new `Post` instances and passes the `db` connection. This ensures every instance can lazily load its related data when needed.

## Use the Model in Your Application

Now you can use the model in your route loaders. The related data is only fetched when you actually access it.

```ts {% path="app/routes/posts.tsx" %}
import type { Route } from "./+types/posts";

import { Post } from "~/models/post.server";

export async function loader({ context }: Route.LoaderArgs) {
	let posts = await Post.list({ db: context.db });

	// Author data is NOT fetched yet
	return { posts: posts.map((post) => post.toJSON()) };
}
```

In this example, listing posts doesn't fetch any author data. But if you need the author for a specific post:

```ts {% path="app/routes/posts.$id.tsx" %}
import type { Route } from "./+types/posts.$id";

import { Post } from "~/models/post.server";

export async function loader({ params, context }: Route.LoaderArgs) {
	let post = await Post.show({ db: context.db }, params.id);

	// Now we fetch the author because we need it
	let author = await post.author;

	return {
		post: post.toJSON(),
		author: { id: author.id, name: author.name },
	};
}
```

The author is only fetched when explicitly accessed. If you access `post.author` multiple times in the same request, it only queries the database once.

## Add a Serialization Method

Add a `toJSON` method to serialize the model for sending to the client. This method should only include the data that's already loaded, not the lazy relations.

```ts {% path="app/models/post.server.ts" %}
export class Post {
	// ... properties, constructor, and getters

	toJSON() {
		return {
			id: this.id,
			authorId: this.authorId,
			title: this.title,
			createdAt: this.createdAt,
		};
	}
}
```

The `toJSON` method returns a plain object with the post's data. It includes `authorId` so the client knows which author the post belongs to, but it doesn't include the full author object since that requires an async operation.

## Handle Multiple Lazy Relations

You can add multiple lazy getters for different relations. Each one follows the same pattern: check for cached promise, create if missing, return the promise.

```ts {% path="app/models/post.server.ts" %}
export class Post {
	readonly id: UUID;
	readonly authorId: UUID;
	readonly categoryId: UUID;

	private authorPromise?: Promise<schema.SelectUser>;
	private categoryPromise?: Promise<schema.SelectCategory>;

	// ... constructor

	get author() {
		if (this.authorPromise) return this.authorPromise;
		this.authorPromise = this.services.db.query.users
			.findFirst({ where: eq(schema.users.id, this.authorId) })
			.then((author) => {
				if (author) return author;
				throw new Error(`Couldn't find author with id ${this.authorId}`);
			});
		return this.authorPromise;
	}

	get category() {
		if (this.categoryPromise) return this.categoryPromise;
		this.categoryPromise = this.services.db.query.categories
			.findFirst({ where: eq(schema.categories.id, this.categoryId) })
			.then((category) => {
				if (category) return category;
				throw new Error(`Couldn't find category with id ${this.categoryId}`);
			});
		return this.categoryPromise;
	}
}
```

Each relation has its own cached promise. Accessing `post.author` doesn't affect `post.category` and vice versa. You can access both in parallel if needed:

```ts
let [author, category] = await Promise.all([post.author, post.category]);
```

This pattern gives you fine-grained control over when related data is fetched, avoiding unnecessary queries while keeping your code clean and predictable. For schemas with dynamic attributes, you can combine this approach with the [Entity-Attribute-Value pattern](/tutorials/implement-entity-attribute-value-pattern-with-drizzle) to lazily load metadata only when needed. For a complete guide to this pattern, see how to [build class-based models with Drizzle ORM](/articles/class-based-models-with-drizzle-orm).
