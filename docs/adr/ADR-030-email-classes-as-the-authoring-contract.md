# ADR-030: Email Classes As The Authoring Contract

## Status

**Accepted** - 2026-07-29

## Background

[ADR-018](./ADR-018-mail-package-with-pluggable-transports.md) decides how email is delivered: a `Mailer`, three transports, and a middleware exposing `ctx.email`. It leaves open how an individual email is defined, which is a separate question with its own trade-offs.

Rails' ActionMailer answers it by making each email a class method with a matching template, so the data an email needs, the subject, and the body live together and every email in the application is discoverable in one place. The same shape maps onto this monorepo, where emails are currently assembled from three loosely related pieces at each call site.

## Context

### Current State

An email today is spread across a helper function, a view module, and an inline subject:

```ts
// app/services/invite-email.tsx
export async function sendInviteEmail(resend: Resend, teamName: string, email: string, url: string) {
	let html = await renderToString(<TeamInviteEmail team={teamName} url={url} />);
	await resend.emails.send({
		from: EMAIL_FROM,
		replyTo: EMAIL_REPLY_TO,
		to: email,
		subject: `You've been invited to join ${teamName} on Uptime`,
		html,
	});
}
```

| Piece             | Where it lives                                |
| ----------------- | --------------------------------------------- |
| Data requirements | Positional parameters of the send function    |
| Subject           | Template literal inside the send function     |
| Body              | A separate view module, imported              |
| Recipient         | A `string` parameter beside the other strings |

### Issues Identified

| Issue                                                  | Impact                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| No inventory of the emails an app can send             | Finding them means grepping for provider calls                                        |
| Subjects are hardcoded English string literals         | The apps are localized, so the subject is the one part of the email left untranslated |
| Data requirements are positional strings               | `(teamName, email, url)` is three interchangeable strings at the call site            |
| Recipient is unrelated to the data it was derived from | Nothing prevents sending one user's email to another user's address                   |
| The body is rendered by the sender, not by the email   | Every new email repeats the render-then-send sequence                                 |
| Tests assert on subject strings                        | Assertions break on copy changes and pass on wrong-email bugs                         |

### Locale Is The Deciding Constraint

A subject is user-facing copy, so it must come from the i18n layer rather than a literal. It also must be translated into the _recipient's_ language, which is not always the request language: an invite is composed by one user and read by another who has no stored preference yet. That means an email cannot be a static object; producing its subject and body requires a translator chosen per recipient.

## Decision

Define emails as classes implementing an `Email` interface, and let the mailer accept either a plain `Message` or an `Email`.

### 1. The Interface

```ts
export interface Email {
	/** Recipient this email is addressed to, derived from the data it was constructed with. */
	readonly to: Address | Address[];
	/** Subject line, already translated. */
	readonly subject: string;
	/** Body tree, rendered by the mailer into HTML and plain text. */
	body(): JSX.Element;
	/** Optional per-email overrides; the mailer's configuration supplies defaults. */
	readonly replyTo?: Address | Address[];
	readonly headers?: Record<string, string>;
}
```

`Email` is an interface, so the contract is satisfiable by anything structurally compatible and matches the repository's preference for interfaces. The sender identity comes from the mailer's configuration and layout comes from the `Email.Layout` component used inside `body()`, which leaves the interface holding exactly the three things that vary per email: who it goes to, what it says, and what it looks like.

Nothing here mentions i18n. A translated subject is a string by the time the mailer sees it, so `@pkg/mail` needs no translator, no locale resolution, and no dependency on `@pkg/i18n`.

### 2. An Email

The constructor takes everything the email needs, including the translator and the locale it was bound to:

```tsx
export class TeamInviteEmail implements Email {
	constructor(
		private invite: { team: string; email: string; url: string; locale: string; t: TFunction },
	) {}

	get to() {
		return { email: this.invite.email };
	}

	get subject() {
		return this.invite.t("emails.teamInvite.subject", { team: this.invite.team });
	}

	body() {
		return <TeamInviteBody invite={this.invite} />;
	}
}
```

Emails live in `app/emails/`, one per file, which makes that directory the inventory the codebase currently lacks. The body component stays a separate module when it is large; small bodies can be written inline in `body()`.

### 3. Sending

```ts
await ctx.email.send(new TeamInviteEmail({ team, email, url }));
ctx.email.later(new PasswordResetEmail(user));
```

`Mailer.send()` and `Mailer.later()` accept `Message | Email`. Given an `Email`, the mailer reads `to` and `subject`, calls `body()`, renders it to HTML and plain text through the package's `render()`, and normalizes the result into the same `NormalizedMessage` a plain `Message` produces. Transports never learn that email classes exist.

Discrimination between the two inputs is structural: a value with a callable `body` is an `Email`, anything else is a `Message`.

Recipient overrides stay possible for the cases that need them, without weakening the default:

```ts
await ctx.email.send(new TeamInviteEmail(invite), { to: forwardedAddress });
```

### 4. The App Supplies The Translator

Choosing a recipient's language is application knowledge, so the app resolves it and hands the result to the constructor. Inside a request that translator comes from the i18n middleware; in a queue consumer or scheduled handler the app creates an instance for the locale it looked up.

```ts
// In a controller, for a recipient whose language is not the requester's.
let t = await ctx.i18next.cloneInstance({ lng: invite.locale }).loadNamespaces("emails");
await ctx.email.send(new TeamInviteEmail({ ...invite, locale: invite.locale, t }));
```

Guidance for choosing that locale, in order of preference: the recipient's stored preference, the locale recorded on the record being acted on (an invite stores the language it was created in), then the app's fallback. The requester's own locale is the last resort, since the common mistake is sending in the sender's language rather than the reader's.

### 5. Emails Hold Loaded Data

An email class is constructed with the fields it needs, already loaded, so it holds no database handle and no service container and fetches nothing while rendering. That keeps it testable without a database.

The translator is the one function it holds, and `locale` sits beside it as the serializable record of which language it produced. A future deferred delivery would enqueue the data with its `locale`, and the consumer would rebuild the translator and the instance from that.

### 6. Testing

Emails are directly testable without a mailer:

```ts
let email = new TeamInviteEmail({ team: "Acme", email: "user@example.com", url, locale: "en", t });
assert.equal(email.subject, "You've been invited to join Acme");
```

And the mailer records the source object on sent messages, so send assertions identify the email by type instead of by copy:

```ts
assert.ok(transport.find((message) => message.email instanceof TeamInviteEmail));
```

That distinction matters: the string assertion passes when the wrong email is sent with a similar subject, and fails when the copy is reworded.

## Consequences

### Positive

- **An inventory exists** - `app/emails/` lists every email an app can send.
- **Subjects get translated** - the last piece of hardcoded user-facing copy in the email path moves into the i18n layer.
- **The mail package stays i18n-free** - a translated subject reaches it as a string, so it needs no translator, no locale resolution, and no i18n dependency.
- **Recipient travels with its data** - the address is derived from the same object the content is derived from, so they cannot disagree.
- **Data requirements are a typed constructor** - a missing or misordered field is a compile error rather than three interchangeable strings.
- **Each email renders itself** - no repeated render-then-send sequence per call site.
- **Assertions identify emails by type** - resistant to copy changes, sensitive to wrong-email bugs.
- **Locale handling has one defined resolution order** - instead of an implicit assumption per call site.

### Negative

- **This is a bet on volume** - three emails exist today, and for three emails functions would have been adequate. The pattern pays off at the count the authentication work implies.
- **A file per email** - more modules than the current two helpers, and a class whose only members are a getter and two methods is a function in disguise for the simplest cases.
- **`implements` enforces shape, not correctness** - nothing checks that an i18n key exists or that the body actually uses the data it was given.
- **Locale choice has no guardrail in the package** - the app decides which language a recipient reads, so sending in the requester's language stays possible and is caught by review rather than by a type.
- **JSX inside email classes** - the `app/emails/` directory holds `.tsx` modules that look like data but render markup.

### Neutral

- **Plain `Message` keeps working** - one-off and machine-generated mail does not need a class.
- **The transport layer is unaffected** - resolution happens in the mailer, so ADR-018's transports and middleware need no changes.
- **Body components can live anywhere** - existing view modules can be reused unchanged by an email class.

## Implementation Plan

### Phase 1: Contract

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Define `Email` in the mail package.
2. Accept `Message | Email` in `send()` and `later()`, with structural discrimination and the send-time override options.

### Phase 2: Locale And Recording

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Implement the locale resolution order, including the middleware supplying the request locale.
2. Record the source `Email` on messages captured by `MemoryTransport`.

### Phase 3: Adoption

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Convert the invite email into `TeamInviteEmail`, including moving its subject into the locale files.
2. Convert the alert emails, which are the case with the most call sites.
3. Update tests to assert by email type, and document the pattern in the package README.

## Alternatives Considered

### 1. A Base Class

`class WelcomeEmail extends Email` with shared behavior in the base.

**Rejected because**: the two candidates for shared behavior do not belong there. The sender identity is mailer configuration, since it is per app rather than per email, and layout is a component used inside `body()`. What remains is an abstract class with no behavior, which is an interface with extra coupling. If several emails later share real logic, a helper function is the lighter answer.

### 2. Plain Functions Returning A Message

`function teamInviteEmail(invite): Promise<Message>`.

**Rejected because**: it produces the message eagerly, so the locale must be decided by the caller before the function is called, which is exactly the decision this ADR wants the mailer to own. It also leaves the recipient as a separate argument and gives tests nothing to assert on but strings.

### 3. Object Literals Behind A `defineEmail()` Factory

`export default defineEmail({ to, subject, body })`.

**Rejected because**: the factory adds an indirection that buys nothing a class does not already provide, and per-email data would have to be threaded through a generic parameter to stay typed. A constructor is the language's own version of this.

### 4. Rails-Style Grouped Mailers

One class per domain with a method per email, such as a `UserMailer` with `welcome()` and `passwordReset()`.

**Rejected because**: grouping forces the constructor data to be the union of what every method needs, so each method receives more than it uses and the type of the group is looser than the type of any one email. One class per email keeps each constructor precise.

### 5. A Translator Factory In The Mailer

Give the `Mailer` a `(locale) => Promise<TFunction>` factory and let it resolve the recipient's locale itself.

**Rejected because**: it puts an i18n dependency and a locale policy inside a package whose job is delivery, and every caller outside a request would have to configure a factory before it could send anything. The app already knows which language a recipient reads, so it passes the translator it already has.

### 6. Serializable Emails For Deferred Delivery

Make every email serializable so it can be enqueued and sent by a background job.

**Deferred, not rejected**: it requires a name-to-constructor registry to rebuild an instance from a queue message, and that registry replaces compile-time types with string keys. `later()` from ADR-018 already covers post-response delivery within the request lifetime, which is the actual need today. Revisit when an email genuinely must survive a failed request.

## References

- [ADR-018: Mail Package With Pluggable Transports](./ADR-018-mail-package-with-pluggable-transports.md)
- [Rails ActionMailer](https://guides.rubyonrails.org/action_mailer_basics.html)
- [ADR-008: Service Container for Remix v3](./ADR-008-service-container-for-remix-v3.md)

## Current Progress

- [x] Phase 1: Contract
- [x] Phase 2: Locale And Recording
- [x] Phase 3: Adoption

## Notes

- Email classes must not be constructed with entities that carry live connections; pass the plain fields the email needs, which also keeps the constructor an honest description of its data requirements.
- The i18n keys for every email belong under a single namespace prefix so a missing translation is easy to spot across locales.
- Adoption in the uptime app resolves both emails to the app's fallback language, not the recipient's. An invite has no language column and an alert is addressed to a mailbox rather than an account, so there is nothing to look up. That is the documented order stopping at its last step, not a shortcut. Reading in the recipient's language needs a `language` column on invites and on the email alert config, which is a migration.
- The mailer resolves the locale once per send and reuses it for both `subject()` and `body()`, so a subject and body can never disagree about language.
- An `Email` whose `to` derives from optional data should fail loudly at construction rather than produce a message with no recipient; validating in the constructor keeps the failure next to the mistake.
