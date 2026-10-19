---
title: Make a validator
description: Write the schema a form's fields pass before an action trusts them with sdxc make validator, and the test that submits it.
section:
    title: The sdxc command
    order: 2
order: 2.03
lastUpdated: 2026-10-19
---

A validator is the schema a submission passes before anything trusts it. `sdxc make validator`
writes one in `app/http/validators/`, built with `remix/data-schema`, with a test that submits it
through [`@sdxc/validate`](/api/validate):

```bash
sdxc make validator signup
```

```text
Wrote app/http/validators/signup.ts
Wrote app/http/validators/signup.test.ts
Added @sdxc/validate@2026.10.13 to package.json; run bun install
```

Reach for it for every form or body an action reads, and for any other input from outside: a
webhook's payload, a query string.

## Flags

| Flag                  | Default      | What it does                         |
| --------------------- | ------------ | ------------------------------------ |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it |
| `--dry-run`           |              | print the files and change nothing   |

## What it writes

A form-data schema named after the file, and the type of a valid submission:

```typescript {% title="app/http/validators/signup.ts" %}
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

/** The Signup fields, as an action receives them. */
export const SignupSchema = f.object({
	name: f.field(s.string()),
});

/** A validated Signup submission. */
export type SignupInput = s.InferOutput<typeof SignupSchema>;
```

The names come from the file's last segment in PascalCase, so `billing/address` writes
`app/http/validators/billing/address.ts` exporting `AddressSchema` and `AddressInput`. Nothing
is declared or mapped: an action imports the schema it needs.

`@sdxc/validate` is added to `package.json` when it is missing, since the test imports it.

## The test

It submits a complete form and an empty one:

```typescript {% title="app/http/validators/signup.test.ts" %}
import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import { SignupSchema } from "~/app/http/validators/signup";

describe("SignupSchema", () => {
	test("accepts a complete submission", async () => {
		let form = new FormData();
		form.set("name", "Ada");

		expect(isSuccess(await validate(form, SignupSchema))).toBe(true);
	});

	test("refuses a submission missing a field", async () => {
		expect(isFailure(await validate(new FormData(), SignupSchema))).toBe(true);
	});
});
```

```bash
bun run test app/http/validators/signup.test.ts
```

Replace `name` with the form's fields in both files, then add a case for each rule a field
carries.

## Fill it in

In the controller's action, validate the form and answer a failure before reading the values,
rendering the form again with `input.error.issues`:

```typescript
let input = await validate(ctx.formData, SignupSchema);
if (isFailure(input)) return renderForm(ctx, input.error.issues);

await ctx.models.users.create({ name: input.data.name });
```

`renderForm` stands for the page your controller renders.

[Forms and params](/docs/building-remix-apps/forms-and-params) covers fields, lists and route
params, [Nested fields](/docs/building-remix-apps/nested-fields) grouped and repeated fields,
and [Standard Schema validation](/docs/conventions/standard-schema-validation) the schemas
`validate` takes.

## Where to go next

- [Make a controller](/docs/sdxc/make-controller) — `--method form` writes the page and the
  action that reads the schema.
- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — a validator with a field per column,
  written beside the pages that use it.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
