# ADR-098: Spam Package

## Status

**Accepted** - 2026-09-28

## Background

Any app that accepts user-generated content (comments, replies, support forms, Webmentions,
sign-up profiles) receives spam. In the WordPress ecosystem, Akismet handles this, and it works
because of its network: it sees submissions from millions of sites, so a link or IP flagged on
one site is known everywhere. A library in this repo has no such network. Content analysis on its
own is therefore the weakest defense, and the working approach is layered: cheap checks stop most
bots before anything reads the text, and the remaining submissions get a score built from many
small signals, as SpamAssassin does for email.

The repo already has the cheap layers as separate pieces. What it lacks is the part that looks at a
submission and says how likely it is to be spam, and why. This ADR introduces `@sdxc/spam` for that
part, designed so the network-backed and learning layers plug into the same contract.

## Context

### What the repo has today

| Layer                                 | Where                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Honeypot field                        | `apps/blog` encore-support: a hidden `website` field; a filled one answers like a success |
| CAPTCHA                               | `@sdxc/captcha` (Turnstile, hCaptcha, reCAPTCHA, in-memory test provider)                 |
| Rate limiting                         | `@sdxc/rate-limit`, keyed by `@sdxc/get-client-ip`                                        |
| Disposable and role-account email     | `@sdxc/email-address/disposable`, `@sdxc/email-address/role-account`                      |
| DNS lookups from a Worker             | `@sdxc/doh` (Workers cannot send raw DNS queries)                                         |
| Content scoring, reputation, learning | Nothing                                                                                   |

### Signals worth using

| Signal                                                            | Source                                       | Cost                     |
| ----------------------------------------------------------------- | -------------------------------------------- | ------------------------ |
| Submitted faster than a human can                                 | A trusted render timestamp                   | Free, synchronous        |
| Link count and density                                            | The content                                  | Free, synchronous        |
| Shorteners, raw-IP URLs, BBCode                                   | The content                                  | Free, synchronous        |
| Unicode obfuscation                                               | The content                                  | Free, synchronous        |
| Contact bait (messaging handles, phone numbers, wallet addresses) | The content                                  | Free, synchronous        |
| Shouting and repetition                                           | The content                                  | Free, synchronous        |
| Disposable author email                                           | `@sdxc/email-address`                        | Free, synchronous        |
| Linked domain on a blocklist                                      | Spamhaus DBL, SURBL, URIBL                   | One DNS query per domain |
| IP, email or username reported                                    | StopForumSpam                                | One HTTP request, free   |
| Cross-site reputation                                             | Akismet, OOPSpam, CleanTalk                  | One HTTP request, paid   |
| Resemblance to this site's spam                                   | A classifier trained on moderation decisions | Storage reads            |
| Judgment on an ambiguous case                                     | An LLM                                       | One model call           |

### Constraints

- A false positive (a real person's content discarded) costs more than a missed spam. The package
  has to support "send to moderation" as a first-class outcome, not only accept or reject.
- Most checks work better with more than the text: the author's email, IP and user agent, and when
  the form was rendered. A string-only API would leave most signals unusable.
- Network checks add latency and can fail. A provider being down must never turn into a verdict.
- Sending content, IPs or emails to a third party is a data-sharing decision each app makes; the
  package must make every such call explicit in the app's configuration.
- `packages/*` stay app-agnostic, report errors through `@sdxc/result`, and call the global `fetch`.

## Decision

Create `@sdxc/spam`, a scoring pipeline over a submission. Every check, local or remote, implements
one contract and returns weighted signals. The filter adds them up and maps the total to a verdict,
keeping every signal as a reason. The app decides what each verdict does.

### Submission

Only `content` is required. Each optional field enables more checks; a check whose input is
missing contributes nothing.

```typescript
export interface Submission {
	content: string;
	/** `text` treats Markdown or HTML link syntax as a signal; `markdown` and `html` parse it. */
	format?: "text" | "markdown" | "html";
	author?: {
		name?: string;
		email?: string;
		url?: string;
		ip?: string;
		userAgent?: string;
	};
	/** When the form was rendered, verified by the honeypot token (ADR-099). */
	renderedAt?: Date;
	submittedAt?: Date;
	/** The site's expected languages, as BCP 47 tags, for the language-mismatch rule. */
	languages?: string[];
}
```

### Checks and signals

```typescript
export interface Signal {
	/** Stable identifier, e.g. `links.density` or `stop-forum-spam.ip`. */
	check: string;
	/** Positive is evidence of spam, negative is evidence of ham. */
	score: number;
	/** Human-readable detail for moderators and logs. */
	detail?: string;
}

export interface SpamCheck {
	readonly name: string;
	/** `local` checks run first and synchronously; `remote` and `escalation` are awaited. */
	readonly stage: "local" | "remote" | "escalation";
	check(
		submission: Submission,
		options: SpamCheck.Options,
	): Signal[] | Promise<Result<Signal[], SpamCheckError>>;
}
```

A check can add negative scores. That lets a reputation provider vouch for a known-good author, and
lets the learning classifier pull a submission back out of the `unsure` band.

### Pipeline

```typescript
let filter = createSpamFilter({
	checks: [...DEFAULT_RULES, stopForumSpam(), linkBlocklist({ dqsKey }), workersAi({ ai })],
	thresholds: { unsure: 5, spam: 10 },
	timeout: 1500,
});

let assessment = await filter.check(submission);
// { verdict: "ham" | "unsure" | "spam"; score: number; signals: Signal[]; failures: Failure[] }
```

1. **Local** checks run first. If their total already reaches the `spam` threshold, the filter
   returns without making a network call.
2. **Remote** checks run in parallel, each bounded by `timeout`.
3. **Escalation** checks (the LLM) run only when the total so far is in the `unsure` band, so the
   model is called for the few cases where the rules can't decide.

A check that fails, throws or times out adds no score. It appears in `failures` with its error
code, so the app can log it and decide whether an incomplete check should go to moderation. The
filter itself always resolves an assessment, so `check` returns one directly rather than a `Result`.

### Verdicts belong to the app

The package returns a verdict and its reasons, and nothing else. The expected use:

| Verdict  | Typical handling                                                           |
| -------- | -------------------------------------------------------------------------- |
| `ham`    | Publish                                                                    |
| `unsure` | Hold for moderation, showing the signals to the moderator                  |
| `spam`   | Answer like a success and discard (a bot learns nothing from the response) |

### Learning from moderation

```typescript
await filter.report(submission, "spam"); // or "ham"
```

`report` forwards a moderator's decision to every check that learns from it. The Bayes classifier
updates its token counts, and Akismet receives `submit-spam` or `submit-ham`. Checks that do not
learn ignore it.

The classifier is naive Bayes over word and link-domain tokens. Its counts live behind a
`TokenStore` interface with an in-memory implementation for tests and a `remix/data-table`
implementation for apps. A multi-tenant app keys the store on the tenant's `Database`, so one
tenant's training never changes another tenant's verdicts. Until it has seen a minimum number of
reports of each class, it contributes nothing, so a fresh install relies on the rules alone.

### Export paths

| Path                         | Contents                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `@sdxc/spam`                 | `createSpamFilter`, the contract types, `DEFAULT_RULES`, each rule by name    |
| `@sdxc/spam/stop-forum-spam` | StopForumSpam lookup of IP, email and username                                |
| `@sdxc/spam/link-blocklist`  | Linked-domain lookups against DNS blocklists through `@sdxc/doh`              |
| `@sdxc/spam/akismet`         | Akismet `comment-check`, `submit-spam`, `submit-ham`                          |
| `@sdxc/spam/bayes`           | The classifier and the `TokenStore` interface with its implementations        |
| `@sdxc/spam/workers-ai`      | Escalation through a Workers AI binding passed in by the app                  |
| `@sdxc/spam/memory`          | A check that returns scripted signals, for testing apps                       |
| `@sdxc/spam/author-email`    | The disposable-domain rule, which bundles `@sdxc/email-address`'s domain list |

Separate paths keep the core free of network code and of large data tables, such as the
disposable-domain list, and make each third party an import the app writes on purpose.

### Default rules

| Rule           | Scores                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `timing`       | Submission within a few seconds of render, or a render time far in the past                    |
| `links`        | Link count and links per word; more weight in short content                                    |
| `link-syntax`  | `[url=…]` BBCode, or Markdown or HTML links in a `text` field                                  |
| `link-targets` | URL shorteners, raw-IP hosts, punycode hosts mimicking a known brand                           |
| `unicode`      | Mixed scripts within a word (homoglyphs), zero-width characters, styled letters, stacked marks |
| `contact-bait` | Messaging-app handles, phone numbers, cryptocurrency wallet addresses                          |
| `shouting`     | Mostly uppercase, repeated characters, repeated phrases, emoji floods                          |
| `language`     | Content in a script none of the site's `languages` use                                         |
| `author-name`  | A name that contains a URL, or reads as a keyword list                                         |

Every rule takes its weights and limits as options with documented defaults, so an app reweights
or drops a rule by building its own list instead of reimplementing one. `author-email` is not in
`DEFAULT_RULES`, because of the list it bundles; an app adds it from its own path.

## Consequences

### Positive

- **Explainable** - every verdict carries the signals behind it, so a moderator sees why something
  was held and a false positive points at the rule to tune.
- **Cheap by default** - local rules decide most cases for free; network and model calls happen only
  when the rules can't.
- **Improves with use** - the classifier learns each site's spam from its own moderation decisions.
- **Explicit data sharing** - each third party is a separate import and a line in the app's config.
- **Testable** - the scripted check lets an app test its handling of each verdict without network.

### Negative

- **No cross-site knowledge by default** - without Akismet or a similar paid provider, the package
  only knows what its rules and this site's training reveal.
- **Weights need tuning** - the default weights are a starting point measured against a hand-built
  corpus, not against real traffic.
- **Cold start** - the classifier contributes nothing until moderators have reported enough of each
  class.
- **Spamhaus requires a key** - Spamhaus refuses queries arriving through public resolvers such as
  1.1.1.1, so the DBL lookup needs a free Data Query Service key; SURBL and URIBL have their own
  usage terms.
- **Third-party data** - apps that enable StopForumSpam, Akismet or an LLM send IPs, emails or
  content to that service and must cover it in their privacy policy.

### Neutral

- **No middleware** - forms differ in which fields they post and what a verdict does, so apps call
  the filter from their action. A middleware can follow once two apps share a shape.
- **Complements, not replaces** - the honeypot (ADR-099), CAPTCHA and rate limiting run before the
  filter and refuse the certain cases; the `timing` rule scores the render time the honeypot token
  verified.

## Implementation Plan

### Phase 1: Contract, local rules and corpus

**Priority:** High

1. Write the executable spec first: a labelled corpus of hand-written spam and ham fixtures (no real
   submissions, no personal data), with expected verdicts and expected signals
2. Implement `Submission`, `Signal`, `SpamCheck`, `createSpamFilter` and the local stage
3. Implement the default rules, with precision and recall against the corpus asserted in tests
4. Implement the scripted `memory` check

### Phase 2: Remote checks

**Priority:** Medium

1. `stop-forum-spam` and `link-blocklist`, tested with MSW
2. Parallel execution with the timeout and the `failures` report
3. `akismet`, including `report`

### Phase 3: Learning and escalation

**Priority:** Medium

1. `bayes` with the in-memory and data-table `TokenStore` implementations and the minimum-reports gate
2. `report` wiring across learning checks
3. `workers-ai` escalation, gated on the `unsure` band

### Phase 4: Adoption

**Priority:** Low

1. `apps/blog` encore-support runs the filter behind the honeypot middleware
2. Webmention and any future comment feature use the filter from the start

## Alternatives Considered

### 1. A string-only `isSpam(content)` function

The simplest API. **Rejected because**: the strongest signals (timing, author reputation,
disposable email) are about the submission, not the text. A string-only API leaves them out and
returns a boolean where moderation needs a reason.

### 2. Akismet only

Proven and already trained. **Rejected because**: it is paid for commercial use, sends every
submission to a third party, and makes the verdict depend on a service being up. It remains
available as one check.

### 3. An LLM on every submission

Accurate on ambiguous content. **Rejected because**: it costs a model call per submission to decide
cases that a link count settles for free, and it gives no stable reasons to tune. It runs only as
the escalation stage.

### 4. Extend `@sdxc/captcha`

Both packages deal with bots. **Rejected because**: a CAPTCHA verifies a token from a provider,
while spam scoring evaluates content and reputation. People hired to post pass a CAPTCHA, which is
exactly the traffic this package targets.

## References

- [Akismet API](https://akismet.com/developers/)
- [StopForumSpam API](https://www.stopforumspam.com/usage)
- [Spamhaus Data Query Service](https://www.spamhaus.com/product/data-query-service/)
- [SpamAssassin rule scoring](https://spamassassin.apache.org/)
- [Unicode Technical Standard #39: Security Mechanisms](https://www.unicode.org/reports/tr39/)
- [ADR-099: Honeypot Package](./ADR-099-honeypot-package.md)
- [A Plan for Spam, Paul Graham](https://paulgraham.com/spam.html)
- [ADR-096: Adopt the shared captcha, email, password, pricing and trailing-slash packages](./ADR-096-adopt-shared-security-and-cost-packages.md)

## Current Progress

- [x] Phase 1: Contract, local rules and corpus
- [x] Phase 2: Remote checks
- [x] Phase 3: Learning and escalation
- [ ] Phase 4: Adoption

## Notes

- The package is public from its first release.
- Homoglyphs are caught by mixed scripts within one word rather than a UTS #39 confusables table:
  it needs no generated data and catches the substitutions spam actually uses.
- The honeypot rule and the signed render timestamp moved to `@sdxc/honeypot` (ADR-099): a filled
  trap is a fact about the request that justifies refusing it before the filter runs.
