# @sdxc/spam

Spam scoring for user content: local rules, reputation checks and a classifier add weighted
signals, and the total becomes a `ham`, `unsure` or `spam` verdict with every reason attached.

## Installation

```sh
npm add @sdxc/spam
```

Remote checks and stores answer [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
values, and the classifier's database store runs on `remix/data-table` from
[`remix`](https://www.npmjs.com/package/remix).

## Usage

### Score a submission

```typescript
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let filter = createSpamFilter({ checks: DEFAULT_RULES });

let assessment = await filter.check({
	content: "cheap watches https://a.example https://b.example",
});
assessment.verdict; // "ham" | "unsure" | "spam"
assessment.score; // 5
assessment.signals; // [{ check: "links.count", score: 2, detail: "2 links" }, …]
```

### Describe the submission

Only `content` is required. Every other field lets more rules fire.

```typescript
let assessment = await filter.check({
	content: String(form.get("comment") ?? ""),
	format: "markdown",
	author: {
		name: String(form.get("name") ?? ""),
		email: String(form.get("email") ?? ""),
		url: String(form.get("website") ?? ""),
		ip: request.headers.get("CF-Connecting-IP") ?? undefined,
		userAgent: request.headers.get("User-Agent") ?? undefined,
	},
	renderedAt, // from a signed field the visitor cannot forge
	languages: ["en", "es"],
});
```

### Add reputation checks

```typescript
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { akismet } from "@sdxc/spam/akismet";
import { authorEmail } from "@sdxc/spam/author-email";
import { linkBlocklist } from "@sdxc/spam/link-blocklist";
import { stopForumSpam } from "@sdxc/spam/stop-forum-spam";

let filter = createSpamFilter({
	checks: [
		...DEFAULT_RULES,
		authorEmail(),
		stopForumSpam(),
		linkBlocklist(),
		akismet({ apiKey: env.AKISMET_KEY, blog: "https://example.com" }),
	],
	thresholds: { unsure: 5, spam: 10 },
	timeout: 1500,
});
```

Local checks run first, in order. Remote checks run in parallel only while the score is below
the spam threshold, and a check that fails or overruns `timeout` adds nothing and is listed in
`assessment.failures`.

### Learn from moderators

```typescript
let failures = await filter.report(submission, "ham");
```

Every check with a `report` method receives the decision; `failures` lists the ones that could
not record it.

## API

### `@sdxc/spam`

#### `createSpamFilter(options: SpamFilter.Options): SpamFilter`

Builds a filter over `options.checks`, with `thresholds` (default `DEFAULT_THRESHOLDS`) and a
`timeout` in milliseconds for each remote and escalation check (default 1500).

#### `filter.check(submission: Submission): Promise<SpamFilter.Assessment>`

Runs `local` checks in order, then `remote` checks in parallel while the score is below `spam`,
then `escalation` checks in parallel while it sits in the unsure band. A check that fails,
throws or times out adds nothing and is listed in `failures`.

#### `filter.report(submission: Submission, label: Label): Promise<SpamFilter.Failure[]>`

Sends a moderator's decision to every check with a `report` method, in parallel, and resolves
the ones that failed.

#### `verdictFor(score: number, thresholds: SpamFilter.Thresholds): SpamFilter.Verdict`

The mapping `check` uses: at or above `spam` is spam, at or above `unsure` is unsure, below is
ham. Use it to re-score stored signals under new thresholds.

#### `DEFAULT_THRESHOLDS`

`{ unsure: 5, spam: 10 }`.

#### `SpamCheckError`

A check's failure. `code` is `unavailable`, `timeout`, `misconfigured` (a key or option the
provider refused) or `invalid-response`; the message carries the provider's detail.

#### Rules

Each rule is a function taking an options object of weights and limits and returning a `local`
`SpamCheck`. `DEFAULT_RULES` holds every rule at its defaults, tuned together so a submission
needs more than one kind of evidence to reach the spam threshold.

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

`URL_SHORTENERS` and `ABUSED_TLDS` are the lists `linkTargets()` uses unless `shorteners` or
`abusedTlds` replace them.

#### Types

- `Submission`: `{ content, format?, author?, renderedAt?, submittedAt?, languages? }`. `format` is
  `"text"` (default), `"markdown"` or `"html"`; `author` holds `name`, `email`, `url`, `ip` and
  `userAgent`; `submittedAt` defaults to the time of the check; `languages` are BCP 47 tags.
- `Signal`: `{ check, score, detail? }`. A positive score points to spam and a negative one to
  ham, so a provider can vouch for an author.
- `SpamCheck`: `name`, `stage` (`"local" | "remote" | "escalation"`), a `check(submission, options)`
  answering `Signal[]` or `Promise<Result<Signal[], SpamCheckError>>`, and an optional
  `report(submission, label)`. `options.signal` aborts at the timeout; `options.score` and
  `options.signals` are what earlier stages found.
- `SpamFilter`: the filter, with `SpamFilter.Options`, `Thresholds`, `Verdict`, `Failure`
  (`{ check, error }`) and `Assessment` (`{ verdict, score, signals, failures }`).
- `Label`: `"spam" | "ham"`.

### `@sdxc/spam/author-email`

#### `authorEmail(options?: { disposableScore?: number }): SpamCheck`

A local rule scoring an `author.email` on a disposable-mail domain, subdomains included
(`author-email.disposable`, default 3). It ships apart from `DEFAULT_RULES` because the domain
list it bundles is large.

### `@sdxc/spam/stop-forum-spam`

#### `stopForumSpam(options?: stopForumSpam.Options): SpamCheck`

A remote check looking the author's IP, email and name up in
[StopForumSpam](https://www.stopforumspam.com/usage). Each reported field scores its weight
times the reported confidence (`ipScore` 5, `emailScore` 6, `usernameScore` 2), reports older
than `maxAgeDays` (90) are ignored, and the total caps at `maxScore` (10). Signals are
`stop-forum-spam.ip`, `.email` and `.username`. `endpoint` (default `STOP_FORUM_SPAM_ENDPOINT`)
pins a regional mirror.

### `@sdxc/spam/link-blocklist`

#### `linkBlocklist(options?: linkBlocklist.Options): SpamCheck`

A remote check looking every linked domain and `author.url` up in DNS URI blocklists over
DNS-over-HTTPS. `zones` defaults to `["surbl", "uribl"]`; a Spamhaus
[Data Query Service](https://www.spamhaus.com/product/data-query-service/) `dqsKey` adds
`"spamhaus"`. A listing scores `listedScore` (6), a low-confidence one `weakScore` (2), across
at most `maxHosts` (10) domains, capped at `maxScore` (12). Signals are
`link-blocklist.spamhaus`, `.surbl` and `.uribl`. A blocklist refusing the query fails as
`misconfigured`; `resolver` routes queries through a DoH resolver the zones accept.

### `@sdxc/spam/akismet`

#### `akismet(options: akismet.Options): SpamCheck`

A remote check sending each submission to Akismet with `apiKey` and `blog`. It adds
`akismet.spam` (`spamScore` 8), `akismet.discard` for blatant spam (`discardScore` 12) or
`akismet.ham` (`hamScore` -2). Akismet requires `author.ip`; a submission without one draws
nothing. `commentType` (default `"comment"`), `blogLang` and `isTest` pass through, and `report`
forwards decisions to `submit-spam` / `submit-ham` within `reportTimeout` (10000 ms).

### `@sdxc/spam/bayes`

#### `bayes(options: bayes.Options): SpamCheck`

A local naive Bayes classifier trained by every `filter.report`. It adds `bayes.spam`
(`spamScore` 6) at or above `spamCut` (0.9) and `bayes.ham` (`hamScore` -4) at or below `hamCut`
(0.2), naming the deciding tokens in the detail, and stays silent until `store` holds
`minDocuments` (20) reports of each label. `strength`, `prior`, `interestingTokens` and
`minDeviation` tune the combination; the `tokenize` options shape the tokens.

#### `tokenize(submission: Submission, options?: tokenize.Options): string[]`

The tokens the classifier counts: content words between `minLength` (3) and `maxLength` (24),
a `host:` token per linked host and the author's website, and an `email-domain:` token unless
`emailDomain` is `false`, up to `maxTokens` (200).

#### `TokenStore`

Where counts live: `read(tokens)` and `increment(tokens, label)`, both answering a `Result`.
`TokenStore.Counts` and `TokenStore.Tally` are the shapes `read` answers.

#### `MemoryTokenStore`

Keeps counts in the instance, for tests and local development.

#### `new DataTableTokenStore(db: Database)`

Stores counts in the `spamTokens` table of a `remix/data-table` database, one upsert per write,
so concurrent reports never lose a count. `SPAM_TOKENS_SCHEMA_SQL` creates the table in a
migration; `SpamTokenRow` is its row type.

### `@sdxc/spam/workers-ai`

#### `workersAi(options: workersAi.Options): SpamCheck`

An escalation check asking a Workers AI model about submissions left in the unsure band. Pass
the binding as `ai` (any object with a matching `run`, `workersAi.Binding`) and describe the
audience in `site`. A spam answer adds `workers-ai.spam` at `spamScore × confidence` (default 5),
a ham answer `workers-ai.ham` at `-(hamScore × confidence)` (default 5), with the model's reason
cut to `maxReasonLength` (200) as the detail. Content is cut to `maxContentLength` (4000).
`model` defaults to `DEFAULT_WORKERS_AI_MODEL`, and takes any text model with JSON mode.

### `@sdxc/spam/memory`

#### `new MemoryCheck(options?: MemoryCheck.Options)`

A scripted check for tests, named `"memory"` in the `"remote"` stage unless `name` and `stage`
say otherwise. A call answers the next queued outcome, else `signals`.

- `signalNext(signals)` / `failNext(code, message?)` queue the next answer; both chain.
- `failReports(code)` makes every later `report` fail.
- `calls`, `last` and `reports` record what the check received.
- `reset()` forgets calls, reports and queued outcomes.

## Pattern: Refuse bots before scoring

[`@sdxc/honeypot`](https://www.npmjs.com/package/@sdxc/honeypot) refuses what no person
produces before any rule runs, and hands the signed render time the `timing` rule reads.

```typescript
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { unwrap } from "@sdxc/result";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

let trap = new Honeypot({ secret: env.HONEYPOT_SECRET });
let filter = createSpamFilter({ checks: DEFAULT_RULES });

router.post(routes.comments.create, {
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

## Pattern: Hold, discard or publish

The verdict is a recommendation; the app decides what each one does. Answering spam like a
success teaches a bot nothing.

```typescript
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

## Pattern: Train a classifier on your moderation queue

The classifier reads the site's own history, so build it per request from that tenant's
database, and send every moderator decision back through `report`.

```typescript
import type { Database } from "remix/data-table";
import type { Label, Submission } from "@sdxc/spam";

import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { bayes, DataTableTokenStore } from "@sdxc/spam/bayes";

function spamFilter(db: Database) {
	return createSpamFilter({
		checks: [...DEFAULT_RULES, bayes({ store: new DataTableTokenStore(db) })],
	});
}

async function moderate(db: Database, submission: Submission, label: Label) {
	let failures = await spamFilter(db).report(submission, label);
	return failures.map(({ check, error }) => `${check}: ${error.code}`);
}
```

Create the table in a migration from `SPAM_TOKENS_SCHEMA_SQL`, and store each submission
exactly as it was checked, so training sees the same tokens.

## Pattern: Escalate the unsure band to a model

Rules settle most submissions; a model call runs only on the ones they leave unsure.

```typescript
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { workersAi } from "@sdxc/spam/workers-ai";

let filter = createSpamFilter({
	checks: [...DEFAULT_RULES, workersAi({ ai: env.AI, site: "comments on a cooking blog" })],
	timeout: 3000,
});

let assessment = await filter.check({ content: "Great recipe! Visit my store for cheap pans" });
assessment.signals.find((signal) => signal.check.startsWith("workers-ai."))?.detail;
```

## Pattern: Write a rule for your site

A check is an object with a name, a stage and a `check` function; its signals add to every
other rule's.

```typescript
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

## Pattern: Reweight a rule

`DEFAULT_RULES` is the rule functions called with defaults. Swap one for your own call.

```typescript
import { contactBait, createSpamFilter, DEFAULT_RULES, links } from "@sdxc/spam";

let filter = createSpamFilter({
	checks: [
		...DEFAULT_RULES.filter((rule) => rule.name !== "contact-bait" && rule.name !== "links"),
		contactBait({ phoneScore: 0 }), // the form asks for a phone number
		links({ freeLinks: 3 }),
	],
});
```

## Pattern: Test code that filters

`MemoryCheck` fixes the evidence, so a test reaches every verdict and failure without a
provider. `MemoryTokenStore` does the same for `bayes`.

```typescript
import { createSpamFilter } from "@sdxc/spam";
import { MemoryCheck } from "@sdxc/spam/memory";
import { expect, test } from "vitest";

test("holds an unsure comment and survives a provider outage", async () => {
	let rules = new MemoryCheck({ stage: "local", signals: [{ check: "test", score: 6 }] });
	let provider = new MemoryCheck().failNext("unavailable");
	let filter = createSpamFilter({ checks: [rules, provider] });

	let assessment = await filter.check({ content: "hello" });

	expect(assessment.verdict).toBe("unsure");
	expect(assessment.failures[0]?.error.code).toBe("unavailable");
	expect(provider.last).toEqual({ content: "hello" });
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
