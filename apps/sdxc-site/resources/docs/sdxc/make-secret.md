---
title: Make a secret
description: Declare a secret the Worker reads from env with sdxc make secret, which writes its bindings.secret() and its .env.example line, then give it values for development, tests and production.
section:
    title: The sdxc command
    order: 2
order: 2.16
lastUpdated: 2026-10-25
outcomes:
    - "What `make secret` writes, and the two places it leaves to you"
    - "Why a secret is set in production before the deploy that declares it"
    - "How to read a secret in a service and test it with a development value"
---

A secret is a value the Worker reads from `env` that never goes into the repository: an API key,
a signing key. Each one is named in four places, and a name missing from one of them shows up
as a type error, a failing CI run or a failed deploy. `sdxc make secret` writes the two that are
committed, the declaration in `cloudflare.config.ts` and the line in `.env.example`:

```bash
sdxc make secret STRIPE_API_KEY
```

```text
Edited cloudflare.config.ts
Edited .env.example
Next: sdxc run typegen
```

```text
--- a/cloudflare.config.ts
+++ b/cloudflare.config.ts
 		env: {
+			STRIPE_API_KEY: bindings.secret(),
--- a/.env.example
+++ b/.env.example
 TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
+STRIPE_API_KEY=
```

`sdxc make secret NAME` is the same command as `sdxc make binding secret NAME`, under the name
you reach for when the value is a secret.

## Flags

| Flag        | What it does                                  |
| ----------- | --------------------------------------------- |
| `--dry-run` | print both edits as diffs, and change nothing |
| `--force`   | declare a key `env` already holds as a secret |

A key `env` already declares stops the run with both files as they were:

```text
STRIPE_API_KEY is already declared in cloudflare.config.ts; pass --force to replace it
```

`--force` replaces that declaration with `bindings.secret()` where it stands, keeping its
comment, and leaves `.env.example` as it is when it already lists the key.

The key is SCREAMING_SNAKE_CASE: one in that form is kept, and kebab-case or camelCase is
converted, so `stripe-api-key` and `stripeApiKey` both declare `STRIPE_API_KEY`. A Worker
configured in `wrangler.jsonc` stops with `No cloudflare.config.ts in the project`.

## Give it a development value

`.env.example` gets the key with an empty value. Fill in one that works in development, such as
a provider's test-mode key, since a fresh clone and CI copy this file to `.dev.vars` and run the
app with what it holds:

```text {% title=".env.example" %}
# Stripe's test-mode secret key, from the dashboard's developer settings.
STRIPE_API_KEY=sk_test_development
```

`make secret` leaves your own `.dev.vars` alone, since it is not committed. Add the same line
there, so `bun dev` reads the value, then type `env` from the declaration:

```bash
sdxc run typegen
```

`sdxc doctor` fails while `.env.example` leaves out a secret `cloudflare.config.ts` declares, so
a declaration written by hand without its line is caught before CI type checks without it.

## Set it for production

```bash
bunx cf workers secrets update STRIPE_API_KEY
```

> [!WARNING]
> `cf deploy` uploads the Worker with exactly the secrets `cloudflare.config.ts` declares, fails
> when one of them has no value in production, and removes a production secret the file no longer
> declares. Set the new secret before the first deploy that declares it, and remove its
> declaration only once nothing reads it.

## Read it from env

Import `env` from `cloudflare:workers` in the module that uses the secret, and keep it there, so
one service is the only code that holds the key:

```typescript {% title="app/services/stripe.ts" %}
import { env } from "cloudflare:workers";

/** The headers every Stripe API call sends, signed with the account's secret key. */
export function stripeHeaders(): Headers {
	return new Headers({ Authorization: `Bearer ${env.STRIPE_API_KEY}` });
}
```

## Test it

Vitest reads `env` from the stand-in in `app/test/cloudflare-workers.ts`, which carries the
development value of every secret `.env.example` lists. Add the new one beside the template's:

```typescript {% title="app/test/cloudflare-workers.ts" %}
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
	STRIPE_API_KEY: "sk_test_development",
} as Partial<Cloudflare.Env> as Cloudflare.Env;
```

The service then reads in a test exactly the value it reads under `bun dev`:

```typescript {% title="app/services/stripe.test.ts" %}
import { describe, expect, test } from "vitest";

import { stripeHeaders } from "~/app/services/stripe";

describe("stripeHeaders", () => {
	test("signs a call with the secret key", () => {
		expect(stripeHeaders().get("Authorization")).toBe(
			"Bearer sk_test_development",
		);
	});
});
```

```bash
bun run test app/services/stripe.test.ts
sdxc doctor --only env
```

```text
pass  env  .env.example lists every secret cloudflare.config.ts declares
```

## Where to go next

- [Deploy your app](/docs/getting-started/first-deploy#secrets) — where each of a secret's four
  places is kept, and the secrets a new app starts with.
- [Make a binding](/docs/sdxc/make-binding) — the KV namespace, database or bucket the same
  code reads beside the secret.
- [Check a project](/docs/sdxc/check-a-project) — the `env` and `typegen` checks that catch a
  secret missing from one place.
