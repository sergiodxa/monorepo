---
name: sdxc-validate
description: "@sdxc/validate runs a Standard Schema over FormData, URLSearchParams, a Request body or a plain object and returns a `Result<T, ValidationError>` instead of throwing. Use when validating a submitted form or JSON request body in a route handler, when you need typed data plus an `issues` array to render field errors, or when reaching for any Standard Schema library (remix/data-schema, Valibot, ArkType) behind one call."
---

# @sdxc/validate

One `validate()` function normalizes the four shapes a submission arrives in — `FormData`, `URLSearchParams`, a `Request` whose content type decides how the body is read, and a plain object — then runs it through any [Standard Schema](https://standardschema.dev) compliant schema. The outcome is a `Result` from `@sdxc/result`: `result.data` is typed from the schema, and the failure branch carries a `ValidationError` whose `issues` are the schema's own. It runs on any fetch runtime.

Full API, options and examples: [packages/validate/README.md](packages/validate/README.md)

## When to reach for it

- A route handler takes a form submission or a JSON body and should answer a 400 with field-level issues rather than throw.
- The same validation has to accept both a form-encoded and a JSON request without branching on the content type by hand.
- You already have a schema written with one Standard Schema library and want no adapter for it.
- Parsed data from elsewhere (a config file, a query string) needs a type and a single failure branch.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/validate": "workspace:*" } }
```

```ts
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";

let schema = s.object({
	email: s.string().pipe(email()),
	name: s.string().pipe(minLength(2)),
});

let result = await validate(request, schema);

if (isFailure(result)) {
	return badRequest({ errors: result.error.issues });
}

result.data; // { email: string, name: string }
```

## Suggestions

- A `Request` is read by content type: `application/json` parses the JSON body, `application/x-www-form-urlencoded` parses as `URLSearchParams`, and `multipart/form-data` parses as `FormData`. Pass the request itself and let it decide.
- Where a `formData()` middleware already parsed the body, pass the parsed `FormData` and leave the request untouched — a body is readable once.
- A repeated field name collapses to a single value when one entry was sent and an array when several were, which is what a schema for a multi-select should expect.
- `ValidationError.message` is always `"Validation Error"`; the useful part is `issues`, each carrying a `message` and the `path` to the field it belongs to.

## Related

- `@sdxc/result` — the `Result`, `isSuccess` and `isFailure` this returns and you branch on; skill `sdxc-result`
- `@sdxc/response` — the status helpers a failed validation answers with; skill `sdxc-response`
