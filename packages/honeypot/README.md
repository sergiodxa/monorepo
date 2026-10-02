# @sdxc/honeypot

Honeypot form fields with a signed render timestamp: a trap field people never see, router
middleware that refuses a filled trap or a forged token before the handler runs, and a `remix/component`
component that renders both fields without client JavaScript.

## Installation

```bash
npm add @sdxc/honeypot
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router and the component
renders with `remix/component`; every verification returns an
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) value. Both install alongside this
package.

## Usage

### Guard a form route

Install the middleware once on the route that renders the form and accepts it. It publishes the
honeypot as `ctx.honeypot` for rendering, and verifies every submission before the handler runs.

```tsx
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { HoneypotFields } from "@sdxc/honeypot/ui";
import { unwrap } from "@sdxc/result";

let trap = new Honeypot({ secret: HONEYPOT_SECRET });

router.map(routes.contact, {
	middleware: [honeypot(trap)],
	actions: {
		async index(ctx) {
			let fields = unwrap(await ctx.honeypot.issue());
			return render(
				<form method="post" action="/contact">
					<HoneypotFields {...fields} />
					<textarea name="message" />
					<button type="submit">Send</button>
				</form>,
			);
		},
		action(ctx) {
			// Reached only with a verified token and an empty trap.
			let { renderedAt, elapsedMs } = unwrap(ctx.honeypotOutcome);
			return saveMessage(ctx, { renderedAt });
		},
	},
});
```

### Verify without the middleware

```ts
import { isFailure } from "@sdxc/result";

let result = await honeypot.verify(await request.formData());
if (isFailure(result)) return result.error.code; // "trap-filled", "invalid-token", …
result.data.renderedAt; // when the form was issued, as this app signed it
```

## API

### `@sdxc/honeypot`

#### `new Honeypot({ secret, tokenField?, trapPrefix?, minSeconds?, maxAge? })`

- `secret` signs tokens with HMAC-SHA-256. A list signs with its first entry and verifies with
  every entry, so rotating keeps forms already open in a browser valid.
- `tokenField` names the hidden token input (default `hp-token`).
- `trapPrefix` starts every trap name (default `hp_`); eight random letters follow, so browser and
  password-manager autofill never recognize it.
- `minSeconds` refuses a submission sent sooner than that after render (default `0`, since a fast
  person is still a person).
- `maxAge` refuses a token older than that many seconds (default unset, so a form left open
  overnight still submits).

#### `honeypot.issue({ now? })`

Resolves `Result<Honeypot.Fields, HoneypotError>`: `{ tokenField, token, trapField }`. The token is
`base64url(payload).base64url(mac)`, and the payload records the issue time and the trap's name,
so a bot can neither choose the trap nor backdate the form. It fails with `misconfigured` when
there is no secret.

#### `honeypot.verify(form, { now? })`

Takes a `FormData` or `URLSearchParams` and resolves `Result<Honeypot.Verification, HoneypotError>`:
`{ renderedAt, elapsedMs }`. A trap the bot dropped counts as empty. Tokens issued up to a minute in
the future are accepted, to allow for clock differences.

#### `HoneypotError`

`code` is one of:

| Code            | When                                                              |
| --------------- | ----------------------------------------------------------------- |
| `missing-token` | No token field, or a body that is not a form                      |
| `invalid-token` | Malformed, signed with no configured secret, or an unknown format |
| `trap-filled`   | The trap field holds any value, whitespace included               |
| `too-fast`      | Sooner than `minSeconds`, or issued over a minute in the future   |
| `expired`       | Older than `maxAge`                                               |
| `misconfigured` | No secret to sign or verify with                                  |

### `@sdxc/honeypot/middleware`

`honeypot(instance, { onFailure? })` publishes `instance` as `ctx.honeypot` (and under the
`HoneypotKey` context key) on every request, so a handler issues fields from it. On every method
other than GET, HEAD and OPTIONS it also verifies the submitted fields, so one installation covers
a route that renders a form and accepts it. It reads the form parsed by `remix`'s `formData()`
middleware when present, and otherwise a clone of the request, leaving the body readable for the
handler. `onFailure(error, ctx)` returns a `Response` to refuse, or `null` to continue with the
failure published; the default is a plain-text `400`.

The verification is published as `ctx.honeypotOutcome` (`HoneypotOutcome`, a
`Result<Honeypot.Verification, HoneypotError>`) and under the `HoneypotOutcomeKey` context key.

### `@sdxc/honeypot/ui`

`<HoneypotFields tokenField token trapField label? />` renders the token as
`<input type="hidden">` and the trap as a text input inside a wrapper that is positioned
off-screen, `inert` and `aria-hidden`. The trap has `tabindex="-1"`, `autocomplete="off"` and the
ignore attributes 1Password, LastPass and Bitwarden honor. `label` (default
`"Leave this field empty"`) labels the trap. Form bots skip `display: none` and hidden inputs,
which is why the trap stays in the layout.

## Pattern: Answer a bot like a success

A refusal teaches a bot to adapt. Answering with the page a person would see after submitting
teaches it nothing.

```ts
import { honeypot as honeypotMiddleware } from "@sdxc/honeypot/middleware";

router.post("/contact", {
	middleware: [
		honeypotMiddleware(honeypot, {
			onFailure(error) {
				if (error.code === "misconfigured") return new Response(null, { status: 500 });
				return Response.redirect(new URL("/contact/sent", "https://example.com"), 303);
			},
		}),
	],
	handler: sendMessage,
});
```

## Pattern: Score what passes with a spam filter

The honeypot refuses what no person produces. What passes carries a render time this app signed,
which [`@sdxc/spam`](https://www.npmjs.com/package/@sdxc/spam)'s timing rule scores as one signal
among many.

```ts
import { honeypot as honeypotMiddleware } from "@sdxc/honeypot/middleware";
import { unwrap } from "@sdxc/result";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let filter = createSpamFilter({ checks: DEFAULT_RULES });

router.post("/comments", {
	middleware: [honeypotMiddleware(honeypot)],
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

## Pattern: Testing a guarded route

Issue fields in the test the way a page would, then post them.

```ts
import { Honeypot } from "@sdxc/honeypot";
import { honeypot as honeypotMiddleware } from "@sdxc/honeypot/middleware";
import { unwrap } from "@sdxc/result";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

test("refuses a filled trap", async () => {
	let honeypot = new Honeypot({ secret: "test" });
	let router = createRouter();
	router.post("/contact", {
		middleware: [honeypotMiddleware(honeypot)],
		handler: () => new Response("sent"),
	});

	let fields = unwrap(await honeypot.issue());
	let body = new URLSearchParams({ [fields.tokenField]: fields.token, [fields.trapField]: "spam" });
	let response = await router.fetch("https://example.com/contact", { method: "POST", body });

	expect(response.status).toBe(400);
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
