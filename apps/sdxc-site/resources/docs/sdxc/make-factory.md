---
title: Make a factory
description: Write the factory tests seed a model's rows with, through the model itself, with sdxc make factory.
section:
    title: The sdxc command
    order: 2
order: 2.07
lastUpdated: 2026-10-19
outcomes:
    - "Why a factory builds rows through the model"
    - "What `make factory` writes from a model's fields"
    - "How to seed test rows with it"
---

A factory builds complete rows for tests, so a test sets only the fields it is about. It writes
through the model, so callbacks, constraints and meta run in a fixture as they do in production.
`sdxc make factory` writes one in `database/factories/` for the model of the same name:

```bash
sdxc make factory post
```

```text
Wrote database/factories/post.ts
```

[`sdxc make model`](/docs/sdxc/make-model#the-factory) already writes a model's factory, with a
sample value per field. Reach for `sdxc make factory` for a model made with `--skip factory`, or
one written by hand.

## Flags

| Flag        | What it does                      |
| ----------- | --------------------------------- |
| `--dry-run` | print the file and change nothing |

A factory is test code itself, so it never gets a test beside it.

## What it writes

```typescript {% title="database/factories/post.ts" %}
import { defineFactory } from "@sdxc/data-model/testing";

import { Post } from "~/app/models/post";

/** A complete Post row; a test overrides only the fields it is about. */
export const PostFactory = defineFactory(Post, {});
```

The factory imports the model's PascalCase export from the file of the same name in
`app/models/`, so `sdxc make factory billing/invoice` writes `database/factories/billing/invoice.ts`
reading `Invoice` from `~/app/models/billing/invoice`, the name
[`sdxc make model`](/docs/sdxc/make-model) exports. With no fields to read, the attributes start
empty for you to fill.

## Fill it in

Give every column the model requires a value, drawn from the sample streams so each row differs
and a seed reproduces a run:

```typescript {% title="database/factories/post.ts" %}
export const PostFactory = defineFactory(Post, {
	title: ({ sample }) => sample.lorem.sentence(),
	body: ({ sample }) => sample.lorem.paragraph(),
	published_at: () => Date.now(),
	author_id: async ({ create }) => (await create(AuthorFactory)).id,
}).trait("draft", { published_at: null });
```

Then create rows in a test:

```typescript
let factories = createFactories(models, { seed: 42 });
let post = await factories.create(PostFactory, { title: "Hello" });
await factories.createMany(PostFactory, 3);
```

[Data models](/docs/data-and-background-work/data-models#build-test-data-with-factories) covers
traits, sequences and the in-memory database a test binds the models to, and
[Test data](/docs/operations-and-testing/test-data) seeding beyond one model.

## Where to go next

- [Make a model](/docs/sdxc/make-model) — the model a factory writes through.
- [Make a migration](/docs/sdxc/make-migration) — the table the rows land in.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
