# ADR-167: Email Registry

## Status

**Accepted** - 2026-10-19

## Background

Routes, jobs, MCP tools and commands are each declared in a typed registry: a declaration file
that costs only schemas, one handler file per entry, and an initializer that maps each handler
lazily. Emails were the exception. `defineEmail()` returned a standalone class, and 25 of the 28
emails across the apps are hand-written classes whose props include a translator function `t`.

That shape blocks three things an app wants: queuing an email for durable delivery (a function
cannot be serialized, and a queue consumer has no way to find an email class by name), previewing
every email (nothing enumerates them), and checking each email's copy in every language.

## Context

- `Mailer.send()` and `later()` take an `Email` object built by the caller. `later()` only defers
  to the end of the invocation; nothing retries a failed send.
- Every app builds its job-side mailer by hand (an app-written job middleware, a module-level
  singleton, a mailer constructed inside a job), because `@sdxc/mail` ships middleware for
  routes and commands but none for jobs.
- An app's command line runs on Bun and cannot import `cloudflare:workers`, so anything a
  command and the Worker share must not construct a binding-backed transport.
- The proposal this replaces, `sdxc make email --queued`, generated one job per email. Any
  generic delivery job needs a name-to-email lookup, which is a registry.

## Decision

Emails get a registry shaped like the others:

- `app/emails/index.ts` default-exports `emails({ … })`, each entry `email({ props: schema })`,
  named by its path (`teams.invite`).
- One template per email, default-exporting `createEmail(emails.x, { subject, body, …, preview? })`.
  Every member receives the parsed props with `locale` and `t` beside them.
- `app/initializers/mail.ts` exports `mail = createMail({ translator })` and calls
  `mail.map(emails.x, lazy(() => import(…)))` once per template. The registry holds no transport,
  so the Worker and the command line share it.
- A mailer configured with `mail` (and, for queuing, a `queue` function) sends by declaration:
  `ctx.email.send(emails.x, { to, locale, props })`, `later(…)` and `queue(…)`.
- Copy is translated when the email renders, from the delivery's `locale`, so a queued delivery
  carries only plain JSON props.
- One generic job delivers every queued email: `job({ input: EMAIL_DELIVERY })` whose handler
  calls `ctx.email.deliver(ctx.input)`, exiting on an `EmailRefusedError` (unmapped name,
  refused props) and retrying anything else.
- `@sdxc/mail/middleware/jobs` publishes `ctx.email` to jobs.
- `sdxc make email <name> [field ...]` takes the same field specs as `make model` and writes the
  declaration, the template with a `preview`, its test, and the mapping.

## Consequences

### Positive

- A sender imports schemas only; queuing needs no per-email job.
- Previews, tests and checks can enumerate every email through `mail.mapped`.
- Props are validated where the caller writes them, including before they enter a queue.
- Jobs get `ctx.email` from the package instead of an app-written middleware.

### Negative

- Two places to touch per email (a declaration line and a template file).
- Existing class-based emails keep working but must be rewritten to join the registry; their
  `t` prop becomes the delivery's `locale`, and Date props become ISO strings.
- An email's name is a wire contract while deliveries wait in a queue.

### Neutral

- `send(message)` and `send(emailObject)` keep working, for mail that is not a declared email.

## Alternatives Considered

- **One job per email (`--queued`)**: typed per email, but multiplies job declarations and still
  leaves previews and checks with nothing to enumerate.
- **Translate at dispatch time**: makes queued payloads carry rendered copy and leaves previews
  without real props. Rails (`I18n.with_locale` in the mailer) and Laravel (`->locale()`)
  translate at render time too.
- **Registry owns the transport**: rejected because the command line cannot import the
  Worker-only binding the transport wraps.

## Current Progress

- [x] `@sdxc/mail`: `email`, `emails`, `createEmail`, `createMail`, `lazy`, `send`/`later`/`queue`/`deliver` by declaration, `EMAIL_DELIVERY`, `./middleware/jobs`
- [x] `sdxc make email` with fields, and the app template wired to the registry
- [x] Development preview route (`@sdxc/mail/previews`, mounted at `/_emails` while developing) and `sdxc run emails preview <name>`
- [x] `sdxc doctor` checks for unmapped emails, missing tests and templates without `preview()`
- [x] Apps moved onto the registry: demo, r3-auth, reader, blog, uptime, auth-saas; `defineEmail()` removed
