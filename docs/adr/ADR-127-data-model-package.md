# ADR-127: Data Model Package

## Status

**Proposed** - 2026-10-09

## Background

Most apps in this repo already wrap their `remix/data-table` tables in a model or repository
layer: uptime and r3-auth in `app/data/`, auth-saas in `app/models/`, blog in
`app/repositories/`. Each app wrote its own, so the same pattern exists five times under three
directory names, with no shared base and different answers to the same questions: where a job is
enqueued after a write, what a list method returns for pagination, and whether a failure is a
`Result` or a throw.

This ADR adds `@sdxc/data-model` so that layer is written once: models built on a
`remix/data-table` table, bound per request to the right `Database`, with named scopes, custom
methods and async callbacks that reach the app's services. It is designed as an official `remix/data-model` would be: it keeps data-table's plain
rows and immutable queries, and composes through context keys and middleware.

## Context

### The model layers apps already have

| App       | Location            | Example                                              |
| --------- | ------------------- | ---------------------------------------------------- |
| uptime    | `app/data/`         | `apps/uptime/app/data/monitor.ts` (about 35 modules) |
| auth-saas | `app/models/`       | `apps/auth-saas/app/models/tenant.ts`                |
| blog      | `app/repositories/` | `apps/blog/app/repositories/post.ts`                 |
| r3-auth   | `app/data/`         | `apps/r3-auth/app/data/client.ts`                    |
| demo      | `app/data/`         | `apps/demo/app/data/posting.ts`                      |

The dominant shape is a class of static methods taking the database first:
`Monitor.create(ctx.db, teamId, ...)`, `Tenant.findBySlug(db, slug)`. auth-saas models also hold
their table as `static table`. Instance classes appear only where a package interface has to be
implemented, such as `FollowerRepository implements FollowerStore`, which takes the database in
its constructor. Nothing publishes models on the context; handlers import the class and pass
`ctx.db` on every call.

Where the layers disagree:

| Question                       | Answers found                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Who enqueues after a write     | The model (`Monitor.ping` enqueues `checkHttp`, `apps/uptime/app/data/monitor.ts`); the caller (`ArticlePost.create` then `ctx.jobs.enqueue`, `apps/blog/app/http/controllers/cms/articles.tsx`) |
| What a list returns for paging | Rows; a separate `*Query` variant for `Pagination.byKeyset` (about 13 uptime modules); a paged result built inside the model (`Tenant.listProvisioned`, `PostSearch.page`)                       |
| How a failure is reported      | `null` and the occasional throw in most modules; `Result` in `FollowerRepository`, blog's `user.ts` and `PostSearch`                                                                             |
| Naming                         | `findById` / `findBy<Field>` / `listBy<X>` / `listBy<X>Query`; `update` / `updateById`; `delete` / `deleteById` / `destroy`                                                                      |

The same entity is sometimes modelled twice, as `customer` is in uptime and auth-saas.

### What data-table already provides

| Capability                                   | Where                                |
| -------------------------------------------- | ------------------------------------ |
| Typed tables, relations, eager loading       | `table()`, `hasMany()`, `.with()`    |
| Immutable, reusable `Query` objects          | `query(table)`, `db.query(table)`    |
| CRUD helpers                                 | `db.find`, `db.create`, `db.update`… |
| Table hooks: `beforeWrite`, `validate`, etc. | `table({ … })`                       |
| Transactions                                 | `db.transaction()`                   |

The table hooks are **synchronous** and receive only `{ operation, tableName, value }`. They
cannot enqueue a job, send mail or read anything the request published, so they cannot hold the
side effects a model is wanted for.

### What the consumers expect

- `@sdxc/pagination` pages any value with the query methods it uses (`Pagination.byOffset`,
  `Pagination.byKeyset`); it types its input structurally, not as a concrete class.
- `@sdxc/search` returns a data-table `Query` from `definition.query(db, parsed)`, which callers
  narrow with `.where()` and hand to pagination.
- Per-request services are published on the context (ADR-057): a `Database` key carries the
  tenant's database, `Jobs` carries the enqueuer (`ctx.jobs.enqueue(...)`), apps declare their own
  `Mail` and similar keys.

### The three hosts

| Host           | Context          | Publishes through                   |
| -------------- | ---------------- | ----------------------------------- |
| `remix/router` | `RequestContext` | `ctx.set(key, value, { property })` |
| `@sdxc/jobs`   | `JobContext`     | `ctx.set(key, value, { property })` |
| `@sdxc/mcp`    | `RequestContext` | The request's own context, extended |

MCP tools and resources run on the request's own `RequestContext`, so whatever router middleware
publishes is already visible to them. Jobs share the `get`/`set` shape but type middleware effects
through `JobMiddleware`, so they need their own entry point.

### Database constraints

`@sdxc/data-table-d1` has no interactive transactions; `@sdxc/data-table-sqlstorage` does. Any
callback timing that depends on commit has to define what happens on D1.

## Decision

### A model is a definition bound to a database and a context

```typescript
import { createModel } from "@sdxc/data-model";
import { Jobs } from "@sdxc/jobs";

import { users } from "./schema.js";

export const Users = createModel(users, {
	scopes: {
		active: (query) => query.where({ deleted_at: null }),
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},
	callbacks: {
		async beforeCreate(values) {
			return { ...values, email: values.email.toLowerCase() };
		},
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.get(Jobs).enqueue(jobs.sendWelcome, { userId: event.row.id });
		},
	},
	methods: (model) => ({
		findByEmail: (email: string) => model.query().where({ email: email.toLowerCase() }).first(),
	}),
});

let users = Users.bind({ db }, context);
await users.active().inTeam(teamId).orderBy("name", "asc").all();
```

- `createModel(table, options)` returns an unbound definition. `definition.bind(context, host?)`
  returns the bound model every method runs on. The database is supplied once, at binding, and
  the bound model is a configured runtime object rather than a set of functions that re-take
  `db` on every call.
- Rows are the plain typed objects data-table returns. There are no record instances, no
  `user.save()` and no identity map; writes go through the bound model.
- `methods` receives the bound model, so custom methods compose scopes, queries and other
  methods with full inference, and appear on the bound model next to the built-ins.

### Scopes return a real data-table `Query`

`users.query()` and every scope return a data-table `Query` wrapped so that the model's scopes are
callable on it, and every `Query` method it returns is wrapped again. Scopes therefore chain with
each other and with data-table's own methods in any order:

```typescript
let query = users.active().inTeam(teamId).where({ role: "admin" }).with({ posts: userPosts });

let page = await Pagination.byOffset(query, { page: 1, perPage: 25 });
```

For a model loaded up front, the wrapped value is still a `Query` (`instanceof` holds), so
pagination, search refinement and eager loading accept it unchanged. A lazily loaded model hands
out a deferred query instead, described under [Loading models on demand](#loading-models-on-demand).

### Bound model surface

| Member               | Returns                                    | Callbacks |
| -------------------- | ------------------------------------------ | --------- |
| `query()`, scopes    | Scoped `Query`                             | No        |
| `from(query)`        | The given `Query`, scoped                  | No        |
| `find(id)`           | `Row \| null`                              | No        |
| `findBy(where)`      | `Row \| null`                              | No        |
| `create(values)`     | `Result<Row, ValidationError>`             | Yes       |
| `update(id, values)` | `Result<Row, ValidationError \| NotFound>` | Yes       |
| `delete(id)`         | `Result<Row, NotFound>`                    | Yes       |
| `transaction(fn)`    | Whatever `fn` returns                      | Defers    |
| `load()`             | The bound model, once its module loaded    | No        |
| Custom `methods`     | A promise or a model query                 | —         |

Reads answer `null` for a missing row. Writes answer a `Result` from `@sdxc/result`, because a
validation failure or a missing row is an expected outcome the caller branches on.

`from(query)` wraps a query some other package built over the same table, such as a search
query, so the model's scopes chain onto it.

### Callbacks

Callbacks are async and receive a `ModelContext`. The database is the only member the package
guarantees; everything else is the app's to attach:

```typescript
interface ModelContext {
	/** The database this model is bound to, or the transaction it runs in. */
	readonly db: Database;
	/** Reads a value the host context published, by the same key the app's middleware uses. */
	get<Key extends object>(key: Key): ContextValue<Key>;
}
```

`get` reads through to the host context, so a callback reaches the job enqueuer, the mail
transport or the billing provider by the same keys the app's middleware already publishes
(`ctx.get(Jobs)`, `ctx.get(Mail)`). A script or test binds with its own context instead of a
request.

Anything a callback should read as a property, such as `ctx.log`, the app adds by augmenting the
interface, the same way it types `RequestContext` in `config/router-context.d.ts`:

```typescript
/** config/model-context.d.ts */
declare module "@sdxc/data-model" {
	interface ModelContext {
		/** The invocation's log, read from the host context by the models middleware. */
		log: Log;
	}
}
```

```typescript
export const Users = createModel(users, {
	callbacks: {
		async afterCreate(row, ctx) {
			ctx.log.set({ user: { id: row.id } });
		},
	},
});

router.use(modelsMiddleware(models, (ctx) => ({ db: ctx.db, log: ctx.log })));
let bound = Users.bind({ db, log }, context);
```

The middleware's function and `bind`'s first argument are typed as every `ModelContext` member
besides `get`, which always reads through to the host. Once the app augments the interface, a
middleware or a binding that leaves out `log` fails to type-check rather than handing a callback
an `undefined`; an app that augments nothing returns `{ db }` alone.

| Callback                                    | Runs                                    | Can                   |
| ------------------------------------------- | --------------------------------------- | --------------------- |
| `validate(values, ctx)`                     | Before every create and update          | Fail with issues      |
| `beforeCreate`, `beforeUpdate`              | After `validate`, before the statement  | Rewrite values, fail  |
| `beforeDelete`                              | Before the statement                    | Fail                  |
| `afterCreate`, `afterUpdate`, `afterDelete` | After the statement succeeds            | Read and write the db |
| `afterCommit(event)`                        | After the enclosing transaction commits | Dispatch side effects |

- The model `validate` callback is async and runs in addition to the table's synchronous one,
  so a uniqueness check or a lookup against another table lives on the model.
- `after*` callbacks run inside the transaction when there is one; a failure there rolls the
  write back.
- `afterCommit` is where jobs and mail belong. Inside `users.transaction(...)` (or
  `models.transaction(...)`), events queue and flush once the transaction resolves, and are
  dropped when it rolls back, so a rolled-back signup never sends a welcome email. Outside a
  transaction, and always on D1, `afterCommit` runs right after the write's `after*` callback.
- Callbacks run for writes made through the model. A bulk write built from a query
  (`users.active().update({...})`) is data-table's own operation and runs no model callbacks; it
  is the explicit escape hatch for set-based writes.

### Constraints: several models over one table

`constraints` pins columns to fixed values, so several models can share a table, as blog's
article, tutorial, like and glossary posts share `posts` today:

```typescript
export const Articles = createModel(posts, { constraints: { type: "article" } });
export const Tutorials = createModel(posts, { constraints: { type: "tutorial" } });
```

| Operation                   | Effect of `constraints: { type: "article" }`                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `query()`, scopes, `from()` | Every query starts with `.where({ type: "article" })`, so paging and search see only articles       |
| `find(id)`, `findBy(where)` | A row of another type answers `null`                                                                |
| `create(values)`            | Writes `type: "article"`; the input type omits `type`                                               |
| `update(id)`, `delete(id)`  | The constraint joins the `WHERE`, so another type's id answers `NotFound`; `type` cannot be changed |
| Row type                    | `type` narrows to `"article"`                                                                       |

A constraint is a value written on create and fixed afterwards, which fits a discriminator.
A filter whose column the model itself changes, such as `deleted_at` for soft deletes, stays a
scope.

### Sub-models: inheritance on a discriminator column

A base model that names a discriminator column can be extended once per value, the way Rails
single-table inheritance uses `type`:

```typescript
export const Posts = createModel(posts, {
	inheritance: "type",
	scopes: {
		live: (query) => query.where({ deleted_at: null }),
		published: (query) => query.where(sql`"published_at" <= ${new Date().toISOString()}`),
	},
	callbacks: {
		async beforeUpdate(values) {
			return { ...values, updated_at: new Date().toISOString() };
		},
	},
});

export const Articles = Posts.extend("article", {
	methods: (model) => ({
		findBySlug: (slug: string) => model.live().published().where(/* slug */).first(),
	}),
	callbacks: {
		async afterCommit(event, ctx) {
			if (event.operation === "create") {
				await ctx.get(Jobs).enqueue(jobs.webmentions.send, { postId: event.row.id });
			}
		},
	},
});

export const Likes = Posts.extend("like", {});
```

- `extend(value, options)` is `createModel(table, options)` with the base's options merged in
  and `constraints: { [inheritance]: value }` added. `value` is typed as the discriminator
  column's own values, so a typo or a value the enum lacks fails to type-check.
- A sub-model has every scope and method of its base. Declaring one with a name the base
  already uses is a type error, so a name means the same query on every model sharing it.
- Callbacks stack: the base's run first, then the sub-model's, for each event. A base
  `beforeUpdate` stamping `updated_at` therefore covers every post type.
- The base model reads and writes every row of the table, with the discriminator typed as the
  column's full union and only its own callbacks running. Writing through the sub-model is what
  runs the sub-model's callbacks: a base can hold lazily loaded sub-models that are not imported
  yet, so it never dispatches to them.
- Sub-models register like any model (`articles: Articles`, or a loader), independently of the
  base; registering the base is needed only where something uses it directly.

### A registry and per-host middleware

```typescript
import { createModels } from "@sdxc/data-model";

export const models = createModels({ users: Users, posts: Posts });
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/router";

router.use(modelsMiddleware(models, (ctx) => ({ db: ctx.db })));

/** In a route handler, or an MCP tool mounted on the router. */
let user = await ctx.models.users.findByEmail(email);
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/jobs";

createJobDispatcher({
	middleware: [database(), modelsMiddleware(models, (ctx) => ({ db: ctx.database }))],
});
```

- The middleware takes a function from the host context, a `RequestContext` or a `JobContext`,
  to the model context. It can read anything earlier middleware published there, so the
  tenant's database is the one every model binds to, the app picks what callbacks see as
  properties, and the package stays unaware of tenancy and of how the app names its services.
- The function runs on the first model access in an invocation, once, so whatever it reads must
  already be on the context by then; an invocation that touches no model never runs it.
- It publishes the bound registry under the `Models` key and installs it as `ctx.models`.
  Members are bound lazily on first access, so an invocation that touches no model binds none.
- `ctx.models.transaction(async (models) => { ... })` binds every model to the transaction and
  shares one `afterCommit` queue across them.
- The registry keys are lowercase plural (`users`, `posts`): they name bound instances, and match
  the table names. `ctx.models` is the property, because `ctx.data` reads as form or loader data.
- `@sdxc/data-model/router` covers MCP; there is no `@sdxc/data-model/mcp` entry point.

### Loading models on demand

A registry entry is either a model or a function that imports the module holding one, so an
invocation evaluates only the model modules it uses:

```typescript
export const models = createModels({
	users: Users,
	articles: () => import("~/app/models/articles.js"),
	invoices: () => import("~/app/models/invoices.js"),
});
```

```typescript
let article = await ctx.models.articles.findBySlug(slug);
let page = await Pagination.byOffset(ctx.models.articles.published().newest(), {
	page: 1,
	perPage: 20,
});
```

A lazy entry reads as a proxy with exactly the bound model's type, so call sites are the same
whether an entry is lazy or not, and an entry can move between the two without touching them.

- A lazy entry's module default-exports its model, the shape `dispatcher.map(job, () => import(...))`
  already uses for jobs.
- An async member, such as `findBySlug()` or `create()`, awaits the import, binds the model, and
  then calls the member with the same arguments. The returned promise settles with the member's
  own result, or rejects when the import fails.
- A member that returns a query, such as `query()`, a scope or `from()`, returns a deferred query
  synchronously. It records each chained call and replays the chain on the loaded model when a
  terminal method (`all()`, `first()`, `count()`, a write) runs, so it chains and pages exactly
  like the eager one.
- Every member a model exposes therefore returns either a promise or a model query. The type of
  `methods` enforces it: a custom method returning a plain value fails to type-check, because a
  proxy could not produce that value before the module loads.
- The import runs once per invocation, on the first member called, and the bound model is kept
  for the rest of it.
- Inside `ctx.models.transaction(async (models) => { ... })` the proxy binds the loaded model to
  the transaction.
- Model modules import tables, never other models, so loading one never pulls in another; a
  callback that needs a second model reads the registry with `ctx.get(Models)`.
- On Workers the bundle still contains every model. What the loader defers is module
  evaluation, which keeps a model's top-level work, such as building a search definition, off
  invocations that never use it.

A deferred query is a data-table `Query` only once replayed. Pagination and search take it,
since they call query methods and never test its class, but code that needs a real `Query` in
hand, such as `db.exec(query)` or an `instanceof` check, reads it from the loaded model with
`await ctx.models.articles.load()`.

### Package boundaries

- The package ships no tables, schemas or migrations; the app declares tables and passes them in.
- It depends on `remix` (data-table and router types) and `@sdxc/result`; `@sdxc/jobs` is a
  peer of the `./jobs` entry point only. Logging is whatever the app attaches in the middleware.
- Everything it returns for querying is a data-table `Query`, so `@sdxc/pagination` and
  `@sdxc/search` need no changes and take no dependency on it.

## Usage Examples

The examples follow one blog-like app with `users`, `articles` and `comments` tables. The tables
are ordinary `remix/data-table` declarations; only the model files are new.

### Defining models

```typescript
import { createModel } from "@sdxc/data-model";
import { Jobs } from "@sdxc/jobs";
import { fail, sql } from "remix/data-table";

import jobs from "~/app/jobs";
import { Mail } from "~/app/middleware/mail";
import { articleComments, articles, users } from "~/app/schema";

export const Articles = createModel(articles, {
	scopes: {
		published: (query) => query.where(sql`"published_at" <= ${Date.now()}`),
		drafts: (query) => query.where({ published_at: null }),
		by: (query, authorId: string) => query.where({ author_id: authorId }),
		newest: (query) => query.orderBy("published_at", "desc"),
	},

	methods: (model) => ({
		findBySlug: (slug: string) => model.published().where({ slug }).first(),
		withComments: (id: string) =>
			model
				.query()
				.where({ id })
				.with({ comments: articleComments.orderBy("created_at", "asc") })
				.first(),
	}),

	callbacks: {
		async validate(values, ctx) {
			if (values.slug === undefined) return;
			let taken = await ctx.db.findOne(articles, { where: { slug: values.slug } });
			if (taken !== null && taken.id !== values.id) return fail("Slug already taken", ["slug"]);
		},

		async beforeCreate(values) {
			return { ...values, slug: values.slug ?? slugify(values.title) };
		},

		async afterCommit(event, ctx) {
			if (event.operation === "update" && event.changed.includes("published_at")) {
				await ctx.get(Jobs).enqueue(jobs.notifySubscribers, { articleId: event.row.id });
			}
		},
	},
});

export const Users = createModel(users, {
	scopes: {
		active: (query) => query.where({ deleted_at: null }),
	},

	methods: (model) => ({
		findByEmail: (email: string) => model.active().where({ email: email.toLowerCase() }).first(),
	}),

	callbacks: {
		async beforeCreate(values) {
			return { ...values, email: values.email.toLowerCase() };
		},

		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.get(Mail).send({ to: event.row.email, template: "welcome" });
		},
	},
});
```

`event` names the operation, the row after the write, the row before it for updates and deletes,
and `changed`, the columns an update actually altered.

### Registering and wiring

```typescript
import { createModels } from "@sdxc/data-model";

export const models = createModels({
	articles: Articles,
	comments: Comments,
	users: Users,
});
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/router";

export const router = createRouter({
	middleware: [
		log(logger),
		database(),
		jobsMiddleware(queue),
		mail(),
		modelsMiddleware(models, (ctx) => ({ db: ctx.db, log: ctx.log })),
	],
});
```

`modelsMiddleware` runs after the middleware that publish the database and the services the
callbacks read, so its function and every `ctx.get(...)` in a callback find their values.

### Listing with pagination

```typescript
router.map(routes.articles.index, async (ctx) => {
	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) return redirect(ctx.url.pathname);

	let page = await Pagination.byOffset(ctx.models.articles.published().newest(), {
		page: params.data.page,
		perPage: params.data.perPage,
	});
	if (isFailure(page)) throw page.error;

	return ctx.render(<ArticleList articles={page.data.items} pagination={page.data.pagination} />);
});
```

Keyset paging takes the scoped query the same way, minus the ordering scope, because `byKeyset`
owns the sort:

```typescript
let page = await Pagination.byKeyset(ctx.models.articles.published().by(authorId), {
	orderBy: [
		["published_at", "desc"],
		["id", "desc"],
	],
	cursor: params.data.cursor,
	limit: 50,
});
```

### Searching within a scope

```typescript
router.map(routes.search, async (ctx) => {
	let parsed = parseQuery(ctx.url.searchParams.get("q") ?? "", { fields: ARTICLE_SEARCH.fields });
	if (isFailure(parsed)) return new Response(parsed.error.message, { status: 400 });
	if (parsed.data === null) return ctx.render(<EmptySearch />);

	let query = ctx.models.articles.from(ARTICLE_SEARCH.query(ctx.db, parsed.data)).published();

	let page = await Pagination.byOffset(query, { page: 1, perPage: 20 });
	if (isFailure(page)) throw page.error;

	return ctx.render(<SearchResults page={page.data} parsed={parsed.data} />);
});
```

### Creating from a form

```typescript
router.map(routes.articles.create, async (ctx) => {
	let input = s.parseSafe(ARTICLE_FORM, Object.fromEntries(ctx.formData));
	if (!input.success) return ctx.render(<ArticleForm issues={input.issues} />, { status: 422 });

	let article = await ctx.models.articles.create({ ...input.value, author_id: ctx.user.id });
	if (isFailure(article)) {
		return ctx.render(<ArticleForm issues={article.error.issues} />, { status: 422 });
	}

	return redirect(routes.articles.show.href({ id: article.data.id }));
});
```

The form schema checks the shape of what was submitted; the model's `validate` callback checks
what only the database can answer, such as the slug being taken. Both failures render the same
form.

### Updating and deleting

```typescript
let updated = await ctx.models.articles.update(id, { published_at: Date.now() });
if (isFailure(updated)) {
	if (updated.error instanceof NotFound) return new Response(null, { status: 404 });
	return ctx.render(<ArticleForm issues={updated.error.issues} />, { status: 422 });
}
```

Publishing an article changes `published_at`, so `Articles`' `afterCommit` enqueues
`notifySubscribers` once the update has landed.

### A transaction across models

```typescript
router.map(routes.signup, async (ctx) => {
	let result = await ctx.models.transaction(async (models) => {
		let user = await models.users.create({ email, name });
		if (isFailure(user)) return user;

		let article = await models.articles.create({
			title: "Hello, world",
			author_id: user.data.id,
		});
		if (isFailure(article)) return article;

		return user;
	});

	if (isFailure(result)) return ctx.render(<SignupForm issues={result.error.issues} />);
	return redirect(routes.dashboard.href());
});
```

The welcome mail from `Users`' `afterCommit` is queued during the transaction and sent once it
commits. Had the article failed, the transaction would roll back and the mail would be dropped
along with the user.

### In a job

```typescript
export const dispatcher = createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	middleware: [
		database(),
		mail(),
		modelsJobMiddleware(models, (ctx) => ({ db: ctx.database, log: ctx.log })),
	],
});
```

```typescript
export default async function notifySubscribers(ctx: JobContext<{ articleId: string }>) {
	let article = await ctx.models.articles.find(ctx.input.articleId);
	if (article === null) ctx.exit("Article no longer exists");

	let subscribers = await ctx.models.users.active().where({ subscribed: true }).all();
	await ctx.get(Mail).sendMany(subscribers.map((user) => digestFor(user, article)));
}
```

### In an MCP tool

```typescript
mcp.tools.map(toolset.findArticles, async (ctx) => {
	let articles = await ctx.models.articles
		.published()
		.by(ctx.input.authorId)
		.newest()
		.limit(10)
		.all();
	if (articles.length === 0) throw new ToolError("That author has no published articles.");
	return articles.map(({ title, slug }) => ({ title, slug }));
});
```

The MCP handler is mounted on the router, so its tools run on a request context the models
middleware has already populated.

### In a script or test

Outside a host, bind with the model context built by hand and, when callbacks read services, any
host with `get(key)`. A test uses a real `RequestContext` and sets only what the callbacks under
test read:

```typescript
let context = new RequestContext(new Request("https://example.com"));
let sent: MailMessage[] = [];
context.set(Mail, { send: async (message) => void sent.push(message) });

let users = Users.bind({ db: createSqliteDatabase(), log: new Log({ kind: "test" }) }, context);
let user = await users.create({ email: "Pat@Example.com", name: "Pat" });

expect(user).toEqual(success(expect.objectContaining({ email: "pat@example.com" })));
expect(sent).toEqual([expect.objectContaining({ to: "pat@example.com", template: "welcome" })]);
```

### Post types as sub-models

```typescript
export const models = createModels({
	posts: Posts,
	articles: () => import("~/app/models/articles.js"),
	likes: () => import("~/app/models/likes.js"),
});

/** Article archive: only articles, already live and published. */
let page = await Pagination.byKeyset(ctx.models.articles.live().published(), {
	orderBy: [
		["published_at", "desc"],
		["id", "desc"],
	],
	limit: 20,
});

/** A like is created with `type: "like"`, and none of the article callbacks run. */
await ctx.models.likes.create({ author_id: ctx.user.id, published_at: now });

/** The home feed reads every type through the base, narrowing on the discriminator. */
let feed = await ctx.models.posts.live().published().limit(50).all();
for (let post of feed) if (post.type === "article") renderArticle(post);
```

### Bulk writes, without callbacks

```typescript
await ctx.models.articles
	.drafts()
	.where(sql`"created_at" < ${cutoff}`)
	.delete();
```

A delete built from a query runs as one statement and fires no model callbacks, which is what a
cleanup over thousands of rows wants. When each row needs its callbacks, iterate and call
`articles.delete(id)` per row.

## Consequences

### Positive

- **One model layer instead of five** - apps stop hand-writing the static-class pattern, and the
  questions they answer differently today (side-effect placement, paging, failures, naming) get
  one answer.
- **Paging without `*Query` twins** - every scope already returns a pageable query, so a model
  no longer needs a rows method and a query method for the same list.
- **Side effects after commit** - `afterCommit` gives job and mail dispatch the timing that
  avoids sending work for a rolled-back write.
- **No new query vocabulary** - scopes return data-table queries, so pagination, search, eager
  loading and raw SQL keep working, and existing knowledge of data-table carries over.
- **Correct database by construction** - binding through middleware means a handler cannot pick
  up another tenant's database.

### Negative

- **Wrapped queries** - scope chaining depends on every data-table `Query` method returning a
  new `Query`. A data-table release that changes this breaks chaining until the wrapper adapts.
- **Deferred queries** - a query from a lazily loaded model is a recording until it runs, so the
  rare caller that needs a real `Query` in hand awaits `load()` first, and custom methods are
  limited to returning promises or model queries.
- **Two write paths** - model writes run callbacks and query-built bulk writes do not. The
  distinction has to be learned, as with Rails' `update_all`.
- **D1 weakens `afterCommit`** - without interactive transactions, it runs per write, so a
  multi-step D1 mutation can dispatch a job for a step a later failure leaves orphaned.
- **Another layer** - a reader following a write now looks at the table hooks and the model
  callbacks.

### Neutral

- **Plain rows** - there is no Active Record instance; code that wants `user.save()` calls
  `users.update(user.id, values)`.
- **Opt-in** - apps keep using data-table directly wherever a model adds nothing.

## Implementation Plan

### Phase 1: Spec

**Priority:** High

1. Write the acceptance tests first: binding, scopes chaining into `Pagination.byOffset`, each
   callback's ordering, `afterCommit` flush and drop on `@sdxc/data-table-sqlstorage`, and the
   per-write fallback on D1.
2. Back database tests with `@sdxc/cloudflare-mocks/sqlite`.

### Phase 2: Core

1. `createModel`, `bind`, scope wrapping, CRUD with callbacks, `ModelContext`.
2. `createModels`, lazy registry binding, `transaction`.
3. `constraints` and `extend` sub-models, ported against blog's `posts` types.

### Phase 3: Hosts

1. `./router` middleware, with an MCP tool reading `ctx.models` in its tests.
2. `./jobs` middleware.

### Phase 4: Package chores

1. README, LICENSE, root README row, `apps/sdxc` group and guide, npm bootstrap.
2. Port one existing model layer to validate the API, starting with a module where the model
   already dispatches side effects (uptime's `Monitor`) and one that pairs rows with a `*Query`
   variant, then migrate the remaining apps' `data/`, `models/` and `repositories/` modules.

## Alternatives Considered

### 1. Class-based models

`class Users extends Model(users) { ... }`, with scopes and callbacks as methods and the registry
constructing an instance per request.

**Rejected because**: static members and per-request instances split the API between "unbound"
and "bound" in a way the type system shows poorly, and subclassing a factory return value is a
pattern nothing else in the Remix surface uses. The definition-plus-`bind` shape gets the same
extensibility through `methods` with inference.

### 2. Active Record instances

Rows as instances with `save()`, `destroy()` and dirty tracking.

**Rejected because**: data-table returns plain rows from every read, eager loads included, and
pagination and search hand back those rows. Instances would need wrapping on every read path and
would diverge from what the rest of the stack returns.

### 3. Callbacks as data-table table hooks

Put model behavior into `table({ beforeWrite, afterWrite })`.

**Rejected because**: those hooks are synchronous and context-free, so they cannot enqueue jobs,
send mail or read the request's services.

### 4. Keep the static-class pattern apps use today

`Users.find(db, id)`, `Users.create(db, values)`, as uptime, auth-saas and blog do now.

**Rejected because**: callbacks also need the host context, so every call would take two leading
arguments, and the middleware would still have to bind them to offer `ctx.models`. `bind({ db },
host)` keeps the "database first" order those apps use while supplying it once.

### 5. Model middleware around every query

A chain that runs before any query a model makes, able to query other models or do anything
else first.

**Rejected because**: scopes return real data-table queries that `@sdxc/pagination`, `@sdxc/search`
and eager loading execute themselves, so a middleware would run for `users.find(id)` and not for
a paged listing unless the model wrapped every execution path. Each need it would serve already
has a home:

| Need                                       | Where it lives                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| Work before a write, querying other models | `validate` and `before*` callbacks, which receive `ctx.db` and `ctx.get()` |
| A filter every read applies (soft deletes) | A `defaultScope` option, applied in `query()`, added when a port needs it  |
| Per-tenant isolation                       | The tenant's database, bound by the models middleware                      |
| Authorization                              | The route, job or tool boundary that receives the traffic                  |
| Logging or timing every query              | The database adapter, or the host's own middleware                         |
| Caching a read                             | A custom method that consults the cache first                              |

A middleware that queries other models would also trigger theirs, which needs ordering rules
and recursion guards on top.

## References

- [remix/data-table](../vendor/@remix-run/data-table/README.md)
- [ADR-057: Request context instead of a service container](./ADR-057-request-context-instead-of-a-service-container.md)
- [Rails Active Record callbacks](https://guides.rubyonrails.org/active_record_callbacks.html)
- [Laravel Eloquent query scopes](https://laravel.com/docs/eloquent#query-scopes)

## Current Progress

- [ ] Phase 1: Spec
- [ ] Phase 2: Core
- [ ] Phase 3: Hosts
- [ ] Phase 4: Package chores

## Notes

- Blog's posts keep typed metadata in the companion `post_meta` key/value table, decoded by a
  per-type `MetaCodec`. Whether a model should load and write such a table itself (a `meta`
  option naming the table, foreign key and codec) is open; D1 would make a post and its meta two
  statements, so the meta write needs to be one multi-row upsert to keep the pair consistent.
- Bulk writes skip model callbacks by design; a test pins that behavior so it reads as a contract.
- The name `Models` for the context key and `ctx.models` for the property are the defaults; the
  middleware accepts a different property name for an app that already uses `models`.
