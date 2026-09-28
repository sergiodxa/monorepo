# ADR-099: Honeypot Package

## Status

**Accepted** - 2026-09-28

## Background

A honeypot is a form field people never see and bots fill in because they complete every input
they find. It costs the visitor nothing, needs no third party, and stops the bulk of automated form
spam. ADR-098 first put the honeypot inside the spam filter as a scored rule. That was the wrong
place: a filled trap is a fact about the request, not evidence to weigh. It is known before the
body is read into a submission, and it justifies refusing the request outright, before any content
rule, reputation lookup or model call runs.

The repo has one honeypot today, written inline in `apps/blog`'s support form: a `website` field
checked in the action. Every new form would copy it. This ADR introduces `@sdxc/honeypot`: a
signed token, a router middleware that verifies it, and a `remix/ui` component that renders the
fields. It also takes over the signed render timestamp ADR-098 planned under
`@sdxc/spam/render-timestamp`, since that is another hidden field with its own verification.

## Context

### Prior art

`remix-utils` ships a honeypot for React Router: `createHoneypot` (or middleware) with a
`nameFieldName` that can be randomized, a `validFromFieldName` carrying an encrypted timestamp, an
`encryptionSeed`, and a `HoneypotProvider` plus `<HoneypotInputs label>` pair that renders the
fields from props the root loader produced. A failure calls `onSpam`, which returns a `Response`.

Parts of that design carry over, and parts do not fit this repo:

| Aspect                   | remix-utils                             | Here                                                                                |
| ------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------- |
| Timestamp protection     | Encrypted                               | Signed with HMAC; nothing in the token is secret, only unforgeable                  |
| Field props distribution | React context provider from root loader | The handler issues fields and passes them to the component                          |
| Failure                  | `onSpam` returns a response             | `onFailure(error, ctx)` returns a response, or `null` to continue with the outcome  |
| Outcome for the handler  | None                                    | `ctx.honeypot`, a `Result` carrying the verified render time for the spam filter    |
| Hiding                   | Inline `display: none` wrapper          | Positioned off-screen, excluded from the accessibility tree, tab order and autofill |

### Failure modes a honeypot must avoid

| Failure                                         | Cause                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A real person rejected                          | Browser or password-manager autofill writes into a field named like `name`, `email`, `website` |
| A screen-reader or keyboard user fills the trap | The field is reachable by Tab or announced                                                     |
| A bot skips the trap                            | `type="hidden"` and `display: none` fields are the first thing bots learn to leave alone       |
| A forged "rendered at" time                     | A plain hidden timestamp field is written by the bot                                           |
| A person loses what they typed                  | A form left open overnight is refused as stale                                                 |

The support form's `website` field is exposed to the first failure: browsers autofill a field
with that name from the visitor's profile.

## Decision

Create `@sdxc/honeypot`, public from the start, with three export paths.

| Path                        | Contents                                                  |
| --------------------------- | --------------------------------------------------------- |
| `@sdxc/honeypot`            | `Honeypot` (issue and verify), `HoneypotError`, the types |
| `@sdxc/honeypot/middleware` | `honeypot(instance, options?)` router middleware          |
| `@sdxc/honeypot/ui`         | `<HoneypotFields>` component                              |

### Token

`issue()` produces two field names and one value:

- a **trap field** whose name is random per issue (`hp_` plus random letters by default) and
  whose expected value is the empty string;
- a **token field** (default name `hp-token`) whose value is
  `base64url(JSON payload).base64url(HMAC-SHA-256)`, with the payload
  `{ v: 1, iat: <ms>, trap: <trap field name> }`.

The trap's name travels inside the signed payload, so verification knows which field to read and a
bot cannot pick the name. A random name also keeps browsers and password managers from matching it
to any saved profile field.

```typescript
let honeypot = new Honeypot({ secret: env.HONEYPOT_SECRET });

let fields = await honeypot.issue(); // Result<Honeypot.Fields, HoneypotError>
// { tokenField: "hp-token", token: "eyJ2Ijox….Hc2k…", trapField: "hp_qzvkt" }

let outcome = await honeypot.verify(formData); // Result<Honeypot.Verification, HoneypotError>
// { renderedAt: Date, elapsedMs: 41200 }
```

`secret` accepts a list: the first signs, every entry verifies, so a rotation keeps forms already
open in a browser valid.

### Verification

`verify(form, { now? })` fails with a `HoneypotError` whose `code` is one of:

| Code            | When                                                                |
| --------------- | ------------------------------------------------------------------- |
| `missing-token` | No token field, or a body that is not a form                        |
| `invalid-token` | Malformed, signed with no configured secret, or an unknown version  |
| `trap-filled`   | The trap field is present and non-empty                             |
| `too-fast`      | Issued less than `minSeconds` ago, or in the future beyond the skew |
| `expired`       | Issued more than `maxAge` ago, only when `maxAge` is set            |
| `misconfigured` | No secret to sign or verify with                                    |

`minSeconds` defaults to `0` and `maxAge` to unset. A fast human and a form left open for a day are
both real people, so the defaults refuse only what no person produces: a filled trap and a missing
or forged token. Speed stays evidence, not a verdict. The verification reports `renderedAt` and
`elapsedMs`, and the spam filter's `timing` rule scores them.

A missing trap field is accepted: some bots drop unknown fields, and an absent trap is as empty as
an untouched one.

### Middleware

```typescript
router.post("/comments", {
	middleware: [honeypot(instance)],
	handler(ctx) {
		// Reached only with a verified token and an empty trap.
		let { renderedAt } = unwrap(ctx.honeypot);
		return saveComment(ctx, renderedAt);
	},
});
```

- It reads the form parsed by `remix`'s `formData()` middleware when present, and otherwise a
  clone of the request, so the body stays readable for the handler.
- `onFailure(error, ctx)` returns a `Response` to refuse, or `null` to continue with the failure
  published. The default answers a plain-text `400`. Answering like a success, so a bot learns
  nothing, is left to the app, since only the app knows what success looks like; the README shows
  it as a pattern.
- The outcome is published as `ctx.honeypot` and under an exported context key with a written
  type.

### Component

```tsx
<form method="post" action={routes.comments.href()}>
	<HoneypotFields {...fields} label="Leave this field empty" />
	<textarea name="content" />
	<button type="submit">Post</button>
</form>
```

It renders the token as `<input type="hidden">` and the trap inside a wrapper that is:

- positioned off-screen through a `css()` mixin (`position: absolute; inset-inline-start:
-10000px; block-size: 1px; overflow: hidden`), which keeps it in the layout bots inspect;
- `aria-hidden="true"`, with the trap at `tabindex="-1"`, so assistive technology and keyboard
  users never reach it;
- labelled with the `label` prop, so a person who does reach it through some other path reads
  what to do;
- marked `autocomplete="off"` plus the ignore attributes the common password managers honor
  (`data-1p-ignore`, `data-lpignore="true"`, `data-bwignore`, `data-form-type="other"`).

It needs no client JavaScript and no provider.

### Working with the spam filter

The honeypot runs first and rejects the certain cases. What passes carries a verified render time,
which the filter's `timing` rule scores as one signal among many:

```typescript
let { renderedAt } = unwrap(ctx.honeypot);
let assessment = await filter.check({ content, author, renderedAt });
```

`@sdxc/spam` therefore drops its `honeypot` rule and its planned `render-timestamp` export, and
`Submission.renderedAt` is a verified `Date`.

## Consequences

### Positive

- **Rejected before any work** - a filled trap or forged token never reaches content parsing,
  reputation lookups or a model call.
- **Autofill-safe** - the random trap name matches no saved profile field.
- **Accessible** - the trap is outside the accessibility tree and the tab order.
- **No JavaScript, no third party** - the fields are plain HTML and the token is verified locally.
- **Feeds the spam filter** - the verified render time becomes the `timing` signal.

### Negative

- **Stale on cached pages** - a page cached at the edge embeds one token for every visitor, so
  `renderedAt` is the cache fill time. Forms on cached pages keep `minSeconds` at `0` or load the
  fields from an uncached fragment.
- **Replayable** - a bot that fetches the page once can reuse the token with an empty trap until
  `maxAge`, if set. The honeypot stops careless bots; replay is for rate limiting and CAPTCHA.
- **A secret to manage** - each app adds `HONEYPOT_SECRET` to its environment and to
  `.env.example`.
- **Targeted bots adapt** - a bot written for one site learns to leave the trap empty, which is
  why the spam filter still runs behind it.

### Neutral

- **Default refusal is a 400** - apps that prefer a silent fake success pass `onFailure`.

## Implementation Plan

### Phase 1: Package

**Priority:** High

1. Tests first: issue and verify round trip, each error code, secret rotation, a missing trap,
   the skew window, the middleware with and without `formData()` middleware, and the component's
   rendered attributes
2. `Honeypot`, `HoneypotError` and the token format over `@sdxc/crypto`'s `hmac` and `Base64Url`
3. `honeypot()` middleware, published context key with a written type
4. `<HoneypotFields>` with the off-screen `css()` mixin
5. README for npm readers, `LICENSE.md`, the root README row with ✅, `bun run
release:bootstrap @sdxc/honeypot`

### Phase 2: Spam filter alignment

**Priority:** High

1. Remove the `honeypot` rule and the `render-timestamp` export from `@sdxc/spam`
2. Update ADR-098 to point here

### Phase 3: Adoption

**Priority:** Medium

1. `apps/blog` support form replaces its inline `website` check with the middleware and component

## Alternatives Considered

### 1. Keep the honeypot as a spam-filter rule

**Rejected because**: the filter runs after the body is parsed into a submission and would pay for
remote checks only to reach a verdict the request already settled.

### 2. Encrypt the timestamp, as remix-utils does

**Rejected because**: nothing in the token needs to be hidden, only protected from forgery. HMAC
signing does that with a shorter token and a verifier this repo already has.

### 3. Single-use tokens stored in KV

It would stop replay. **Rejected because**: it adds a storage binding, a write per page view and a
read per submission to a layer whose value is being free. Replay belongs to rate limiting.

### 4. `display: none` or `type="hidden"` for the trap

The simplest markup. **Rejected because**: form bots skip exactly these fields, which defeats the
trap.

## References

- [remix-utils Honeypot](https://sergiodxa.github.io/remix-utils/modules/Middleware_Honeypot.html)
- [HTML autocomplete attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
- [ADR-098: Spam Package](./ADR-098-spam-package.md)

## Current Progress

- [x] Phase 1: Package
- [x] Phase 2: Spam filter alignment
- [ ] Phase 3: Adoption

## Notes

- Verification uses `@sdxc/crypto`'s constant-time `hmac.verify`.
- The component takes the issued fields as props, so a page rendering two forms issues twice and
  each form carries its own trap name.
