# @sdxc/honeypot

Honeypot form fields with a signed timestamp, router middleware that refuses a filled trap or a
forged token, and a `remix/component` component that renders both fields without client JavaScript.

## Installation

```bash
npm add @sdxc/honeypot
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router, the component
renders with `remix/component`, and every verification answers an
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) value.

## Usage

### Issue and verify fields

```ts
import { Honeypot } from "@sdxc/honeypot";
import { isFailure, unwrap } from "@sdxc/result";

let honeypot = new Honeypot({ secret: HONEYPOT_SECRET });

let fields = unwrap(await honeypot.issue()); // { tokenField, token, trapField }

let result = await honeypot.verify(await request.formData());
if (isFailure(result)) return result.error.code; // "trap-filled", "invalid-token", …
result.data.renderedAt; // when the form was issued, as this app signed it
```

The token signs the render time and the trap's random name, so a bot can neither pick the trap
nor backdate the form. Issue once per rendered form.

### Render the fields

```tsx
import type { Honeypot } from "@sdxc/honeypot";
import type { Handle } from "remix/component";

import { HoneypotFields } from "@sdxc/honeypot/ui";

function ContactForm(handle: Handle<{ fields: Honeypot.Fields }>) {
	return () => (
		<form method="post" action="/contact">
			<HoneypotFields {...handle.props.fields} />
			<textarea name="message" />
			<button type="submit">Send</button>
		</form>
	);
}
```

### Guard the route

```tsx
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { unwrap } from "@sdxc/result";
import { createRouter } from "remix/router";

let trap = new Honeypot({ secret: HONEYPOT_SECRET });
let router = createRouter();

router.get("/contact", {
	middleware: [honeypot(trap)],
	async handler(ctx) {
		let fields = unwrap(await ctx.honeypot.issue());
		return renderPage(<ContactForm fields={fields} />);
	},
});

router.post("/contact", {
	middleware: [honeypot(trap)],
	async handler(ctx) {
		let { renderedAt } = unwrap(ctx.honeypotOutcome);
		let form = await ctx.request.formData();
		return saveMessage(form, renderedAt);
	},
});
```

The middleware publishes the honeypot as `ctx.honeypot` on every request, and verifies every
method other than GET, HEAD and OPTIONS before the handler runs, answering a failure with a
plain-text 400. The handler still reads the body.

## API

### `@sdxc/honeypot`

#### `new Honeypot(options: Honeypot.Options)`

- `secret`: signs tokens with HMAC-SHA-256. A list signs with its first entry and verifies with
  every entry.
- `tokenField`: the hidden token input's name (default `"hp-token"`).
- `trapPrefix`: the start of every trap name; eight random letters follow (default `"hp_"`).
- `minSeconds`: refuses a submission sent sooner than this after render (default `0`).
- `maxAge`: refuses a token older than this many seconds (default unset).

#### `honeypot.issue(options?: { now?: Date }): Promise<Result<Honeypot.Fields, HoneypotError>>`

Mints a fresh trap name and a token for one form. Fails with `misconfigured` when there is no
secret.

#### `honeypot.verify(form: FormData | URLSearchParams, options?: { now?: Date }): Promise<Result<Honeypot.Verification, HoneypotError>>`

Checks the token's signature, that the trap it names is empty or absent, and the timing limits.
A token issued up to a minute in the future counts as issued now.

#### `honeypot.tokenField: string`

The token input's name, as configured.

#### `HoneypotError`

An `Error` whose `code` says why:

| Code            | When                                                        |
| --------------- | ----------------------------------------------------------- |
| `missing-token` | No token field, or a submitted body that is not a form      |
| `invalid-token` | Malformed, or signed by none of the secrets                 |
| `trap-filled`   | The trap holds any value, whitespace included               |
| `too-fast`      | Sooner than `minSeconds`, or issued over a minute in future |
| `expired`       | Older than `maxAge`                                         |
| `misconfigured` | No secret to sign or verify with                            |

### `@sdxc/honeypot/middleware`

#### `honeypot(instance: Honeypot, options?: HoneypotMiddlewareOptions): Middleware`

Publishes `instance` as `ctx.honeypot` and, on every method other than GET, HEAD and OPTIONS,
publishes the verification as `ctx.honeypotOutcome`. It reuses the form parsed by `remix`'s
`formData()` middleware, or reads a clone of the request.

- `onFailure(error, ctx)`: returns a `Response` to refuse with, or `null` to continue to the
  handler with the failure on `ctx.honeypotOutcome` (default: a plain-text 400).

#### `HoneypotKey`, `HoneypotOutcomeKey`

Context keys for the same two values, for code that reads with `ctx.get(...)`.

### `@sdxc/honeypot/ui`

#### `<HoneypotFields tokenField token trapField label? />`

Renders the token as a hidden input and the trap as a text input in an off-screen, `inert`,
`aria-hidden` wrapper, with `tabindex="-1"`, `autocomplete="off"` and the ignore attributes
password managers honor. `label` defaults to `"Leave this field empty"`. The trap stays in the
layout because form bots skip `display: none` fields.

### Types

#### `Honeypot.Fields`

`{ tokenField, token, trapField }`, what `issue` returns and `HoneypotFields` takes.

#### `Honeypot.Verification`

`{ renderedAt: Date, elapsedMs: number }`: when the form was issued and how long ago.

#### `Honeypot.ErrorCode`

The union of `HoneypotError` codes.

#### `Honeypot.Options`, `Honeypot.IssueOptions`, `Honeypot.VerifyOptions`

The constructor, `issue` and `verify` options.

#### `HoneypotOutcome`

`Result<Honeypot.Verification, HoneypotError>`, the type of `ctx.honeypotOutcome`.

#### `HoneypotMiddlewareOptions`, `HoneypotFields.Props`

The middleware's options and the component's props.

## Pattern: Answer a bot like a success

A refusal teaches a bot to adapt. Redirecting to the page a person sees after submitting teaches
it nothing.

```ts
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { createRouter } from "remix/router";

let trap = new Honeypot({ secret: HONEYPOT_SECRET });
let router = createRouter();

router.post("/contact", {
	middleware: [
		honeypot(trap, {
			onFailure(error) {
				if (error.code === "misconfigured") return new Response(null, { status: 500 });
				return Response.redirect("https://example.com/contact/sent", 303);
			},
		}),
	],
	handler: sendMessage,
});
```

## Pattern: Ask a person to resubmit after a timing limit

`minSeconds` and `maxAge` refuse submissions a person can make too. Return `null` for those
codes and let the handler re-render the form with fresh fields; `formData()` parses the body once
for both.

```tsx
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { isFailure, unwrap } from "@sdxc/result";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

let trap = new Honeypot({ secret: HONEYPOT_SECRET, minSeconds: 2, maxAge: 60 * 60 });
let router = createRouter({ middleware: [formData()] });

router.post("/contact", {
	middleware: [
		honeypot(trap, {
			onFailure(error) {
				if (error.code === "too-fast" || error.code === "expired") return null;
				return new Response("Form submission refused", { status: 400 });
			},
		}),
	],
	async handler(ctx) {
		if (isFailure(ctx.honeypotOutcome)) {
			let fields = unwrap(await ctx.honeypot.issue());
			return renderPage(<ContactForm fields={fields} notice="Please send the form again." />);
		}
		return saveMessage(ctx.get(FormData));
	},
});
```

## Pattern: Rotate the secret

List the new secret first. New forms are signed with it, and forms already open in a browser
still verify against the old one until you drop it.

```ts
import { Honeypot } from "@sdxc/honeypot";

let trap = new Honeypot({ secret: [HONEYPOT_SECRET_NEXT, HONEYPOT_SECRET] });
```

## Pattern: Score what passes with a spam filter

The honeypot refuses what no person produces. What passes carries a render time this app signed,
which [`@sdxc/spam`](https://www.npmjs.com/package/@sdxc/spam)'s timing rule scores as one signal
among many.

```ts
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { unwrap } from "@sdxc/result";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { createRouter } from "remix/router";

let trap = new Honeypot({ secret: HONEYPOT_SECRET });
let filter = createSpamFilter({ checks: DEFAULT_RULES });
let router = createRouter();

router.post("/comments", {
	middleware: [honeypot(trap)],
	async handler(ctx) {
		let form = await ctx.request.formData();
		let assessment = await filter.check({
			content: String(form.get("content") ?? ""),
			renderedAt: unwrap(ctx.honeypotOutcome).renderedAt,
		});
		return saveComment(form, assessment);
	},
});
```

## Pattern: Test a guarded route

Issue fields in the test the way a page would, then post them. `now` pins the clock for timing
limits.

```ts
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { isFailure, unwrap } from "@sdxc/result";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

test("refuses a filled trap", async () => {
	let trap = new Honeypot({ secret: "test" });
	let router = createRouter();
	router.post("/contact", {
		middleware: [honeypot(trap)],
		handler: () => new Response("sent"),
	});

	let fields = unwrap(await trap.issue());
	let body = new URLSearchParams({ [fields.tokenField]: fields.token, [fields.trapField]: "spam" });
	let response = await router.fetch("https://example.com/contact", { method: "POST", body });

	expect(response.status).toBe(400);
});

test("expires an old form", async () => {
	let trap = new Honeypot({ secret: "test", maxAge: 60 });
	let fields = unwrap(await trap.issue({ now: new Date("2026-01-01T00:00:00Z") }));
	let form = new URLSearchParams({ [fields.tokenField]: fields.token });

	let result = await trap.verify(form, { now: new Date("2026-01-01T00:02:00Z") });

	expect(isFailure(result) && result.error.code).toBe("expired");
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/honeypot": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
