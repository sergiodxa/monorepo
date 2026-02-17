---
title: Class-Based Models with Drizzle ORM
excerpt: Wrap Drizzle queries in model classes to encapsulate behavior and enable inheritance.
technologies: drizzle-orm@0.30.0
---

Drizzle ORM encourages a functional approach where you write queries directly using the query builder. This works well for simple cases, but as your application grows, you may find yourself repeating the same query patterns, transformations, and business logic across multiple files.

One way to organize this code is to wrap Drizzle queries in model classes. This approach brings several benefits: encapsulated behavior, computed properties, type safe serialization, and the ability to use inheritance for related content types.

## The Base Model Pattern

A model class wraps a database record and provides methods to interact with it. Here's a simplified example of a `Post` model:

```ts {% path="app/models/post.server.ts" %}
import { eq, desc } from "drizzle-orm";
import type { Database } from "~/db";
import * as schema from "~/db/schema";

interface Services {
	db: Database;
}

export class Post {
	readonly id: string;
	readonly authorId: string;
	readonly type: "article" | "tutorial" | "comment";
	readonly createdAt: Date;
	readonly updatedAt: Date;

	constructor(
		protected services: Services,
		input: PostAttributes,
	) {
		this.id = input.id;
		this.authorId = input.authorId;
		this.type = input.type;
		this.createdAt = input.createdAt;
		this.updatedAt = input.updatedAt;
	}

	toJSON() {
		return {
			id: this.id,
			authorId: this.authorId,
			type: this.type,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}

	static async list({ db }: Services, type?: schema.SelectPost["type"]) {
		let posts = await db.query.posts.findMany({
			orderBy: desc(schema.posts.createdAt),
			where: type ? eq(schema.posts.type, type) : undefined,
		});

		return posts.map((post) => new Post({ db }, post));
	}

	static async show({ db }: Services, id: string) {
		let post = await db.query.posts.findFirst({
			where: eq(schema.posts.id, id),
		});

		if (!post) throw new Error(`Post not found: ${id}`);
		return new Post({ db }, post);
	}
}
```

The class holds a reference to the services it needs (in this case, the database connection) and exposes static methods for common operations like `list` and `show`. Instance methods like `toJSON` provide a consistent way to serialize the model.

## Lazy Loading Relations

One advantage of class based models is the ability to lazy load relations on demand. Instead of always joining related data, you can load it only when needed. For more patterns on this topic, see [adding lazy loading for related data in Drizzle](/tutorials/add-lazy-loading-for-related-data-in-drizzle).

```ts {% path="app/models/post.server.ts" %}
export class Post {
	private authorPromise?: Promise<schema.SelectUser>;

	get author() {
		if (this.authorPromise) return this.authorPromise;
		this.authorPromise = this.services.db.query.users
			.findFirst({
				where: eq(schema.users.id, this.authorId),
			})
			.then((author) => {
				if (author) return author;
				throw new Error(`Author not found: ${this.authorId}`);
			});
		return this.authorPromise;
	}
}
```

The getter caches the promise, so subsequent calls return the same result without additional queries. This pattern is useful when you sometimes need the relation and sometimes do not.

## Computed Properties

Models can expose computed properties that derive values from the underlying data:

```ts {% path="app/models/post.server.ts" %}
export class Post {
	get cacheKey() {
		return `post:${this.id}`;
	}
}
```

These properties feel natural to use and keep the logic close to the data it operates on.

## Inheritance for Content Types

The real power of class based models comes from inheritance. If you have multiple content types that share behavior, you can create specialized subclasses:

```ts {% path="app/models/article.server.ts" %}
import { Post } from "~/models/post.server";
import { Markdown } from "~/utils/markdown";

interface ArticleMeta {
	slug: string;
	title: string;
	content: string;
	excerpt?: string;
}

export class Article extends Post {
	override readonly type = "article" as const;
	readonly meta: ArticleMeta;

	get title() {
		return this.meta.title;
	}

	get slug() {
		return this.meta.slug;
	}

	get pathname() {
		return `/articles/${this.slug}`;
	}

	get wordCount() {
		return Markdown.plain(this.meta.content).split(/\s+/).length;
	}

	get renderable() {
		return Markdown.parse(`# ${this.title}\n${this.meta.content}`);
	}

	override toJSON() {
		return {
			...super.toJSON(),
			slug: this.slug,
			title: this.title,
			content: this.meta.content,
			excerpt: this.meta.excerpt,
		};
	}

	static override async list(services: Services) {
		let posts = await Post.list(services, "article");
		return posts.map((post) => new Article(services, post));
	}
}
```

The `Article` class inherits all the base behavior from `Post` while adding article specific properties like `title`, `slug`, `pathname`, and `wordCount`. The `toJSON` method extends the parent's serialization with additional fields.

This pattern scales well. You could have `Tutorial`, `Comment`, and `Glossary` classes all extending `Post`, each with their own specialized behavior while sharing the common foundation.

## Static Method Overrides

Subclasses can override static methods to customize queries:

```ts {% path="app/models/article.server.ts" %}
export class Article extends Post {
	static override async show(services: Services, slug: string) {
		let result = await services.db.query.postMeta.findFirst({
			where: and(eq(schema.postMeta.key, "slug"), eq(schema.postMeta.value, slug)),
			with: { post: { with: { meta: true } } },
		});

		if (!result) throw new Error(`Article not found: ${slug}`);

		return new Article(services, result.post);
	}

	static async search(services: Services, query: string) {
		let articles = await Article.list(services);
		// Implement search logic
		return articles.filter((a) => a.title.includes(query));
	}
}
```

The `Article.show` method looks up articles by slug instead of ID, which makes more sense for URL based lookups. The `search` method is entirely new functionality specific to articles.

## Trade-offs vs Plain Functions

This pattern is not without trade-offs. Here's when you might prefer plain functions:

**Plain functions work better when:**

- Your queries are simple and do not need shared behavior
- You want maximum tree shaking (unused functions are easier to eliminate)
- Your team prefers functional programming patterns
- You do not have content type hierarchies

**Class based models work better when:**

- Multiple content types share common behavior
- You need computed properties that depend on instance data
- You want lazy loaded relations
- You need consistent serialization across the codebase
- You want to encapsulate complex query logic

The overhead of classes is minimal in JavaScript, so performance is rarely a concern. The decision comes down to code organization preferences and whether inheritance provides value for your domain.

## Dependency Injection

One subtle benefit of this pattern is how it handles dependencies. The `services` object passed to the constructor and static methods makes testing straightforward, following the principles of [dependency injection in loaders and actions](/articles/dependency-injection-in-remix-loaders-and-actions):

```ts {% path="app/routes/articles.tsx" %}
export async function loader({ context }: Route.LoaderArgs) {
	let articles = await Article.list({ db: context.db });
	return { articles: articles.map((a) => a.toJSON()) };
}
```

In tests, you can pass a mock database. In production, you pass the real one. The model does not care where its dependencies come from.

## Conclusion

Class based models with Drizzle ORM provide a way to organize database access code that scales with complexity. The pattern shines when you have related content types that share behavior, need computed properties, or want lazy loaded relations.

It is not the only way to structure Drizzle code, and plain functions remain a valid choice for simpler applications. But when your domain model has natural hierarchies and shared behavior, inheritance can reduce duplication and make the codebase easier to navigate. For other Drizzle patterns, see [creating reusable column factories](/tutorials/create-reusable-drizzle-column-factories) and [implementing the Entity-Attribute-Value pattern](/tutorials/implement-entity-attribute-value-pattern-with-drizzle).
