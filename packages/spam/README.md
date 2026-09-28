# @sdxc/spam

Spam scoring for user-generated submissions: local rules, reputation providers, a trainable
classifier and an LLM second opinion add weighted signals, and the total becomes a `ham`,
`unsure` or `spam` verdict with every reason attached.

## Installation

```bash
npm add @sdxc/spam
```

Remote checks and moderator reports return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
values, and the classifier's database store runs on
[`remix/data-table`](https://www.npmjs.com/package/remix). Both install alongside this package.

## Usage

### Score a submission

```ts
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let filter = createSpamFilter({ checks: DEFAULT_RULES });

let assessment = await filter.check({
	content: "cheap watches https://a.example https://b.example",
});
assessment.verdict; // "ham" | "unsure" | "spam"
assessment.score; // 5
assessment.signals; // [{ check: "links.count", score: 2, detail: "2 links" }, { check: "links.density", score: 3, … }]
```

### Give the rules more to work with

Only `content` is required. Every other field lets more rules fire.

```ts
let assessment = await filter.check({
	content: form.get("comment"),
	format: "markdown",
	author: {
		name: form.get("name"),
		email: form.get("email"),
		ip: request.headers.get("CF-Connecting-IP"),
	},
	renderedAt: verifiedRenderTime, // signed at render, as @sdxc/honeypot does; never a plain hidden input
	languages: ["en", "es"],
});
```

### Add reputation and a second opinion

```ts
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { akismet } from "@sdxc/spam/akismet";
import { authorEmail } from "@sdxc/spam/author-email";

let filter = createSpamFilter({
	checks: [
		...DEFAULT_RULES,
		authorEmail(),
		akismet({ apiKey: AKISMET_KEY, blog: "https://example.com" }),
	],
	thresholds: { unsure: 5, spam: 10 },
	timeout: 1500,
});
```

Local rules run first. When they already reach the spam threshold, no request leaves the Worker.

### Learn from moderators

```ts
let failures = await filter.report(submission, "ham"); // a moderator approved a held comment
```

Every check that learns receives the decision; `failures` lists the ones that could not record it.

## API

### `@sdxc/spam`

#### `createSpamFilter({ checks, thresholds?, timeout? })`

Returns a `SpamFilter` with two methods:

- `check(submission)` resolves a `SpamFilter.Assessment`: `{ verdict, score, signals, failures }`.
  Checks run in three stages: `local` in order; `remote` in parallel, only while the score is below
  the spam threshold; `escalation` in parallel, only while the score is inside the unsure band.
  A check that fails, throws or overruns `timeout` (default 1500 ms, remote and escalation only)
  adds nothing and is listed in `failures`, so an outage never decides a verdict.
- `report(submission, label)` sends `"spam"` or `"ham"` to every check with a `report` method, in
  parallel, and resolves the ones that failed.

`thresholds` defaults to `{ unsure: 5, spam: 10 }` (`DEFAULT_THRESHOLDS`). A score at or above
`spam` is spam, at or above `unsure` is unsure, and anything lower is ham.

#### `verdictFor(score, thresholds)`

The mapping `check` uses, for re-scoring stored signals under new thresholds.

#### `SpamCheck`

The contract every check implements: `name`, `stage` (`"local" | "remote" | "escalation"`),
`check(submission, { signal, score })` and an optional `report(submission, label)`. A local check
returns `Signal[]`; any other returns `Promise<Result<Signal[], SpamCheckError>>`. `signal` aborts
at the timeout, and `score` is the total earlier stages reached.

#### `Signal`

`{ check, score, detail? }`. `check` is a stable identifier such as `links.count`. A positive score
points to spam and a negative one to ham, so a provider can vouch for an author.

#### `Submission`

`{ content, format?, author?, renderedAt?, submittedAt?, languages? }`. `format` is `"text"` (the
default), `"markdown"` or `"html"`; `author` holds `name`, `email`, `url`, `ip` and `userAgent`;
`submittedAt` defaults to the time of the check; `languages` are BCP 47 tags.

#### `SpamCheckError`

A check's failure. `code` is `unavailable`, `timeout`, `misconfigured` or `invalid-response`.

#### Rules

Each rule is a function returning a local `SpamCheck`; every weight and limit is an option with a
documented default. `DEFAULT_RULES` holds all of them at their defaults, tuned together so a
submission needs more than one kind of evidence to reach the spam threshold.

| Rule            | Signals                                                             | Fires on                                                                             |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `timing()`      | `timing.fast`, `timing.future`, `timing.stale`                      | Sent under 3 s after render, rendered in the future, or rendered over a day ago      |
| `links()`       | `links.count`, `links.density`                                      | Each link past the first; fewer than 4 words per link                                |
| `linkSyntax()`  | `link-syntax.bbcode`, `link-syntax.html`, `link-syntax.markdown`    | BBCode anywhere; HTML anchors outside `html`; Markdown links in `text`               |
| `linkTargets()` | `link-targets.shortener`, `.ip-address`, `.punycode`, `.abused-tld` | Links (and `author.url`) to shorteners, IP literals, punycode hosts, abused TLDs     |
| `unicode()`     | `unicode.mixed-script`, `.hidden`, `.styled`, `.mark-stack`         | Latin mixed with Cyrillic or Greek in one word, invisible separators, styled letters |
| `contactBait()` | `contact-bait.messaging`, `.phone`, `.wallet`                       | Telegram or WhatsApp handles, international phone numbers, crypto wallet addresses   |
| `shouting()`    | `shouting.caps`, `.run`, `.repetition`, `.emoji`                    | Capitals, one character six times, a phrase three times, emoji outnumbering words    |
| `language()`    | `language.script`                                                   | Most letters in a script none of `languages` is written in                           |
| `authorName()`  | `author-name.domain`, `author-name.length`                          | A domain in the name, or a name longer than a person's                               |

`URL_SHORTENERS` and `ABUSED_TLDS` are the lists `linkTargets()` uses by default.

### `@sdxc/spam/author-email`

`authorEmail({ disposableScore? })` scores an `author.email` on a disposable-mail domain
(`author-email.disposable`, default 3), subdomains included. It ships separately because the
domain list it bundles is large, so it is not in `DEFAULT_RULES`. An address that does not parse
draws nothing.

### `@sdxc/spam/stop-forum-spam`

`stopForumSpam(options?)` looks the author's IP, email and name up in
[StopForumSpam](https://www.stopforumspam.com/usage), a free community database of addresses
reported for forum and blog spam. It sends only the fields the submission has, and nothing when it
has none. Each reported field scores its weight times the reported confidence (`ipScore` 5,
`emailScore` 6, `usernameScore` 2), reports last seen over `maxAgeDays` (90) ago are ignored, and
the total is capped at `maxScore` (10). Signals are `stop-forum-spam.ip`, `.email` and
`.username`. `endpoint` pins a regional mirror. The service has a daily query limit per IP and
receives the author's IP, email and name.

### `@sdxc/spam/link-blocklist`

`linkBlocklist(options?)` looks every linked domain and the author's website up in DNS URI
blocklists over DNS-over-HTTPS, so it runs where no DNS socket exists. Zones are `spamhaus`,
`surbl` and `uribl`; the default is `["surbl", "uribl"]`, and a `dqsKey` adds Spamhaus. A listing
scores `listedScore` (6); a low-confidence one (URIBL grey, a Spamhaus "abused legitimate" domain)
scores `weakScore` (2). At most `maxHosts` (10) domains are looked up, IP literals are skipped, and
the total is capped at `maxScore` (12). Signals are `link-blocklist.spamhaus`, `.surbl` and
`.uribl`. `resolver` routes queries through another DoH endpoint.

A blocklist's "query refused" or rate-limit answer fails as `misconfigured`, never as a listing.
Spamhaus refuses public resolvers, so it needs a
[Data Query Service](https://www.spamhaus.com/product/data-query-service/) key, which travels in the
query name. SURBL and URIBL are free for low-volume, non-commercial use and may refuse queries
relayed through large public resolvers; when they do, the check reports `misconfigured`, and a
private resolver or a commercial feed is the fix.

### `@sdxc/spam/akismet`

`akismet({ apiKey, blog })` sends each submission to Akismet's `comment-check` and turns the answer
into a signal: `akismet.spam` (default 8, the unsure band), `akismet.discard` when Akismet marks it
blatant (default 12, spam on its own), and `akismet.ham` when Akismet vouches for it (default -2).
Akismet requires the author's IP, so a submission without `author.ip` sends nothing and draws
nothing. `commentType` (default `"comment"`), `blogLang` and `isTest` pass through; the weights are
`spamScore`, `discardScore` and `hamScore`. An invalid key fails as `misconfigured`, an HTTP or
network error as `unavailable`. `report` forwards a moderator's decision to `submit-spam` or
`submit-ham`, bounded by `reportTimeout` (default 10 s).

Akismet is free for personal, non-commercial sites and paid otherwise. Each call sends the author's
IP, user agent, name, email, website and the full content.

### `@sdxc/spam/bayes`

`bayes({ store })` is a naive Bayes classifier that learns from moderators: every
`filter.report(submission, label)` trains it. It tokenizes content words, a `host:` token per
linked host and the author's website, and an `email-domain:` token, then combines the most telling
tokens (Robinson's smoothed probabilities, Fisher's method) into a spam probability. At or above
`spamCut` (0.9) it adds `bayes.spam` (`spamScore`, 6); at or below `hamCut` (0.2) it adds
`bayes.ham` (`hamScore`, -4). Until the store holds `minDocuments` (20) reports of each label it
adds nothing, so a new install relies on the rules alone. The signal's detail names the tokens
that decided it. `tokenize(submission, options?)` is exported for inspecting what it learns.

Counts live behind `TokenStore` (`read(tokens)` and `increment(tokens, label)`, both `Result`s):

- `MemoryTokenStore` keeps counts in the instance, for tests.
- `new DataTableTokenStore(db)` stores them in a `remix/data-table` database, D1 and SQLite
  included. Create its table from `SPAM_TOKENS_SCHEMA_SQL` in a migration; `spamTokens` is the
  table definition. Every write is one upsert statement, so concurrent reports never lose a count.

In a multi-tenant app, build one store per tenant database, so one tenant's training never changes
another's verdicts. The check runs in the local stage, since it reads the app's own database.

### `@sdxc/spam/workers-ai`

`workersAi({ ai, model?, site?, spamScore?, hamScore?, maxContentLength?, maxReasonLength? })` is
an escalation check: the filter calls it only for submissions the other checks left unsure, so the
model runs on the few cases rules cannot settle. Pass the Workers AI binding (`env.AI`) as `ai`,
and describe the site in `site` (`"comments on a cooking blog"`) so the model judges relevance for
the right audience.

The check sends the content (cut to `maxContentLength`, default 4000 characters), the author's name
and URL, and up to 20 of the signals earlier checks found, as escaped JSON inside delimiters, under
a system prompt that treats everything inside as data to classify. The model answers `spam`, `ham`
or `unsure` with a confidence and a reason: spam adds `workers-ai.spam` at `spamScore × confidence`
(default 5, enough to carry an unsure 5 to 10), ham adds `workers-ai.ham` at
`-(hamScore × confidence)` (default 5), and unsure adds nothing. The reason, cut to
`maxReasonLength` (200), is the signal's detail. The default model is
`@cf/meta/llama-3.1-8b-instruct-fp8` (`DEFAULT_WORKERS_AI_MODEL`); `model` takes any Workers AI
text model with JSON mode. `ai` is typed as any object with a matching `run()`, so a test passes a
plain object.

### `@sdxc/spam/memory`

`new MemoryCheck({ name?, stage?, signals? })` is a scripted check for tests. A call answers the
next queued outcome, else `signals`.

- `signalNext(signals)` / `failNext(code, message?)` queue the next answer.
- `failReports(code)` makes every later `report` fail.
- `calls`, `last` and `reports` record what the check received.
- `reset()` forgets calls, reports and queued outcomes.

`name` defaults to `"memory"` and `stage` to `"remote"`.

## Pattern: Refuse bots before scoring

A honeypot refuses what no person produces, before the body is read into a submission, so no
rule, lookup or model call runs for it. [`@sdxc/honeypot`](https://www.npmjs.com/package/@sdxc/honeypot)
does that, and what it lets through carries a signed render time for the `timing` rule.

```ts
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { unwrap } from "@sdxc/result";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let trap = new Honeypot({ secret: HONEYPOT_SECRET });
let filter = createSpamFilter({ checks: DEFAULT_RULES });

router.post("/comments", {
	middleware: [honeypot(trap)],
	async handler(ctx) {
		let form = await ctx.request.formData();
		let assessment = await filter.check({
			content: String(form.get("content") ?? ""),
			renderedAt: unwrap(ctx.honeypot).renderedAt,
		});
		return saveComment(form, assessment);
	},
});
```

## Pattern: Hold, discard or publish

The verdict is a recommendation; the app decides what each one does. Answering spam like a success
teaches a bot nothing.

```ts
import type { Submission } from "@sdxc/spam";

import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let filter = createSpamFilter({ checks: DEFAULT_RULES });

async function submitComment(submission: Submission) {
	let assessment = await filter.check(submission);
	if (assessment.verdict === "spam") return { status: "received" };
	let comment = await saveComment(submission, {
		published: assessment.verdict === "ham",
		reasons: assessment.signals,
	});
	return { status: comment.published ? "published" : "received" };
}
```

## Pattern: Writing a rule for your site

A rule is an object with a name, a stage and a `check` function. Signals from it add to every
other rule's.

```ts
import type { SpamCheck } from "@sdxc/spam";

import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let competitorLinks: SpamCheck = {
	name: "competitor-links",
	stage: "local",
	check: (submission) =>
		/rival\.example/i.test(submission.content)
			? [{ check: "competitor-links", score: 4, detail: "links to rival.example" }]
			: [],
};

let filter = createSpamFilter({ checks: [...DEFAULT_RULES, competitorLinks] });
```

## Pattern: Reweighting a rule

`DEFAULT_RULES` is a list of rule calls at their defaults. Build your own list to change one.

```ts
import { contactBait, createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let filter = createSpamFilter({
	checks: [
		...DEFAULT_RULES.filter((rule) => rule.name !== "contact-bait"),
		contactBait({ phoneScore: 0 }), // this form asks for a phone number
	],
});
```

## Pattern: Testing an action that filters

`MemoryCheck` fixes the evidence, so a test exercises each verdict without a provider.

```ts
import { createSpamFilter } from "@sdxc/spam";
import { MemoryCheck } from "@sdxc/spam/memory";
import { expect, test } from "vitest";

test("holds an unsure comment for moderation", async () => {
	let check = new MemoryCheck({ signals: [{ check: "test", score: 6 }] });
	let filter = createSpamFilter({ checks: [check] });

	let assessment = await filter.check({ content: "hello" });

	expect(assessment.verdict).toBe("unsure");
	expect(check.last).toEqual({ content: "hello" });
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
		"@sdxc/spam": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
