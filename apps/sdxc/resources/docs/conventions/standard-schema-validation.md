---
title: Standard Schema validation
description: Where a package needs a schema it accepts any Standard Schema, so the validation library is yours to choose.
section:
    title: Conventions
    order: 2
order: 2
lastUpdated: 2026-09-21
---

No package in this collection ships a validation library, and none of them requires a
particular one. Where a package needs to validate something — a document's frontmatter, a
webhook's payload, a job's arguments — it accepts any schema implementing
[Standard Schema](https://standardschema.dev), and infers the result type from the schema you
handed it.

## What that looks like

```typescript
import { Markdown } from "@sdxc/markdown";
import * as s from "remix/data-schema";

let Frontmatter = s.object({ title: s.string(), draft: s.optional(s.boolean()) });

let parsed = Markdown.parse(source, { frontmatter: Frontmatter });
// parsed.data.frontmatter is { title: string; draft?: boolean }
```

`remix/data-schema` is the schema library used throughout this collection's own code, but it is
not special to the packages: Valibot, ArkType and anything else implementing the interface work
in exactly the same call.

## Validating on your own

[`@sdxc/validate`](/api/validate) is the general case: it takes a schema and a plain
object, a `FormData`, a `URLSearchParams` or a whole `Request`, and answers with a `Result`
instead of throwing.

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";

async function handler(request: Request) {
	let result = await validate(request, schema);
	if (isFailure(result))
		return Response.json({ errors: result.error.issues }, { status: 400 });

	return Response.json({ id: await create(result.data) });
}
```

A `Request` is read according to its `Content-Type`, so one call covers JSON, a urlencoded form
and a multipart submission. A `FormData` flattens first: a name submitted once becomes a value,
a name submitted more than once becomes an array.

## Why it is an interface rather than a dependency

A validation library is a choice an application makes once and lives with. A package that
picked one for you would either force its choice into your bundle or force you to convert
between two schema languages at the boundary. Accepting the interface means the package never
enters that argument: it asks for something that can validate, and whatever you already use
answers.

The cost is that the failure shape is the interface's. A validation failure carries
`issues` — the Standard Schema issue list — rather than a shape any one library invented.
