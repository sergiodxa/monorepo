# ADR-096: Adopt the Shared Captcha, Email, Password, Pricing and Trailing-Slash Packages in the Apps

## Status

**Accepted** - 2026-09-28

## Background

Five pieces of behavior were written more than once across the apps, each copy slightly different:
Cloudflare Turnstile verification and its widget, Cloudflare's price list, email address validation,
password acceptance rules, and trailing-slash canonicalization. They now exist as packages:
`@sdxc/captcha`, `@sdxc/cloudflare-pricing`, `@sdxc/email-address`, `@sdxc/password-policy` and
`@sdxc/trailing-slash-middleware`.

Building them turned up defects in the app copies, and those defects only go away once the apps switch
over. The most urgent is auth-saas's rate card: it prices D1 and KV storage 100 times too low, so every
cost figure the platform reports to its billing provider understates storage.

## Context

### Where each package applies

| Package                           | App       | Current code                                                                                                                                            |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/cloudflare-pricing`        | auth-saas | `app/lib/cost-rates.ts`, consumed by `app/lib/cost-ledger.ts` and `app/services/usage-reporting.ts`                                                     |
| `@sdxc/cloudflare-pricing`        | uptime    | `app/lib/cost-rates.ts`, consumed by `app/services/cost.ts` and `app/jobs/report-costs.ts`                                                              |
| `@sdxc/captcha`                   | auth-saas | `app/services/turnstile.ts`, `app/views/hosted/turnstile-widget.tsx`, `app/http/controllers/hosted/turnstile-guard.ts`, the sign-up page's widget       |
| `@sdxc/captcha`                   | uptime    | `verifyChallenge` in `app/services/trial-guard.ts`, `resources/components/turnstile.tsx`                                                                |
| `@sdxc/email-address`             | auth-saas | `foldIdentifier("email", …)` / `encodeDomain` in `database/subject-identifiers.ts`; `checks.email()` on platform sign-up, hosted sign-up and magic link |
| `@sdxc/email-address`             | uptime    | `checks.email()` in `app/http/validators/trial.ts` (lead capture), `invite.ts`, `alert.ts`                                                              |
| `@sdxc/email-address`             | books     | `email()` in `app/http/validators/subscribe.ts` (newsletter, sample chapter) and `app/http/controllers/checkout.ts`                                     |
| `@sdxc/email-address`             | r3-auth   | `checks.email()` in `app/http/validators/authorize.ts` and `password.ts`                                                                                |
| `@sdxc/email-address`             | blog      | `EMAIL_PATTERN` regex in `app/schemas/encore-support.ts`                                                                                                |
| `@sdxc/password-policy`           | auth-saas | policy checks and the 40-entry placeholder common-password list in `database/passwords.ts`; `app/http/controllers/hosted/password-policy-issue.ts`      |
| `@sdxc/password-policy`           | r3-auth   | `MINIMUM_PASSWORD_LENGTH = 8` in `app/http/validators/authorize.ts` and `password.ts`, `MAXIMUM_PASSWORD_LENGTH = 256` in `password.ts`                 |
| `@sdxc/trailing-slash-middleware` | auth-saas | `app/http/middleware/trailing-slash.ts`, mounted in `bootstrap/app.ts` and `bootstrap/management-app.ts`                                                |
| `@sdxc/trailing-slash-middleware` | blog      | `app/http/middleware/no-trailing-slash.ts`, mounted in `bootstrap/app.tsx`                                                                              |

### Defects the app copies carry

| Defect                                                                                                                                                              | Where                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| D1 storage priced at `2.5e-2` cents/GB-day and KV storage at `1.667e-2`; Cloudflare's list prices are 2.5 and 1.667                                                 | auth-saas `cost-rates.ts`            |
| Every D1 row priced at the write rate; reads cost 1,000 times less                                                                                                  | auth-saas `cost-rates.ts`            |
| Durable Object duration priced with 128 MB as 0.125 GB; Cloudflare bills it as 0.128 GB, so both apps are 2.3% low                                                  | auth-saas and uptime `cost-rates.ts` |
| No R2 price, although the app binds R2 for subject import and export                                                                                                | auth-saas `cost-rates.ts`            |
| Analytics Engine counted as a cost although Cloudflare does not invoice it yet                                                                                      | auth-saas and uptime `cost-rates.ts` |
| Workers Logs not priced, although both apps enable `observability`                                                                                                  | auth-saas and uptime `cost-rates.ts` |
| `new URL()` parses the domain, so `a@ex%61mple.com`, `a@example.com#` and `a@0x7f.1` fold to other valid identities                                                 | auth-saas `subject-identifiers.ts`   |
| IP-literal and single-label domains accepted; `a@example.com.` and `a@example.com` are two identities; control and zero-width characters accepted in the local part | auth-saas `subject-identifiers.ts`   |
| The common-password check is a 40-entry placeholder                                                                                                                 | auth-saas `passwords.ts`             |
| A stored hash that fails to verify counts as "not reused", silently                                                                                                 | auth-saas `passwords.ts`             |

## Decision

Each app replaces its own copy with the package, one commit per app and package, and deletes the copy
in the same commit. App-specific policy stays in the app: when to challenge a visitor, which checks a
form runs, the rate card's modelled CPU and row sizes, and the messages a refusal renders.

### Cloudflare pricing

Both rate cards build their per-unit cents from the service modules (`centsPerUnit(D1.ROWS_READ)`,
`centsPerGbDay(KV.STORAGE)`, `DurableObjects.centsPerActiveMs()`) rather than holding numbers. The
modelled CPU per handler and the mean row sizes stay in each app, since those are calibrations against
each app's own bill.

- Both apps bump `RATE_CARD_VERSION`, so a period spanning the change prices each measurement under the
  card that applied to it.
- auth-saas splits its `d1Rows` meter into rows read and rows written. `COST_RESOURCES` is append-only,
  so the two meters are appended and `d1Rows` stops being written rather than being removed.
- auth-saas adds R2 meters for the import and export runs, and both apps add Workers Logs.
- Analytics Engine stays metered but prices at zero while `AnalyticsEngine.BILLING_ACTIVE` is `false`,
  so the day it becomes billable is a package update, not a code change.

### Captcha

auth-saas and uptime verify through `Turnstile` from `@sdxc/captcha/turnstile` and render
`TurnstileWidget` from `@sdxc/captcha/turnstile/ui`.

- auth-saas keeps `turnstile-challenge.ts`, which decides when a visitor must solve a challenge after
  spending part of the sign-in budget. The verification it runs becomes the `captcha()` middleware on
  the submitting routes, with `onFailure` returning `null` on `unavailable`, which keeps sign-in failing
  open when Cloudflare is down.
- uptime's trial guard calls `turnstile.verify()` directly, since it runs the challenge as one step of
  a guard that also checks the target and the budgets.
- Both apps' tests replace their siteverify stubs with `MemoryCaptcha` from `@sdxc/captcha/memory`,
  keeping MSW only where a test is about the HTTP exchange itself.

### Email addresses

Every form that accepts an address parses it with `parseEmailAddress()`; the extra checks depend on
what the address is for.

| Form                                        | Checks                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| auth-saas platform sign-up                  | parse, disposable, mail server, typo suggestion                                  |
| auth-saas hosted sign-up and magic link     | parse; disposable and mail server stay a tenant setting, off by default          |
| uptime trial lead capture                   | parse, disposable, mail server, typo suggestion                                  |
| uptime team invites and email alert targets | parse, mail server                                                               |
| books newsletter and sample-chapter forms   | parse, disposable, typo suggestion                                               |
| r3-auth registration and password recovery  | parse; recovery keeps answering the same whether or not the address exists       |
| blog support form                           | parse only, in keeping with the form's rule that the reply proves deliverability |

- A mail-server lookup that fails (`lookup-failed`) lets the address through: a resolver outage never
  blocks a sign-up.
- auth-saas replaces the email half of `foldIdentifier` with `canonical`, and `encodeDomain` with
  `normalizeDomain`. For every address both accept, `canonical` equals today's folded value, so no
  stored identifier changes. The addresses the old folding accepted and the parser refuses (IP
  literals, single-label domains, control characters) are found with a query over
  `subject_identifiers` before the switch; any that exist are handled case by case, since their
  owners could no longer sign in with them.

### Passwords

auth-saas and r3-auth run `checkPassword()` wherever a password is set: registration, reset and
change. auth-saas also runs `checkPasswordHistory()` on change and reset, replacing its own reuse loop.

- Both apps pass `minLength` explicitly until each decides between NIST's 15 characters for a
  single-factor password and 8 alongside a second factor. The package's default of 15 applies to new
  passwords only; existing ones keep working.
- The Have I Been Pwned lookup (`breached: true`) is enabled in both. `breach-check-unavailable` lets
  the password through, since every local check has already passed by then.
- auth-saas's tenant `deniedTerms` and identifier rules map onto `deniedTerms` and `identifiers`, and
  `password-policy-issue.ts` switches over `PasswordPolicyError.issue.reason`.
- auth-saas hashes the NFKC form of a password today. `checkPasswordHistory()` verifies the value it is
  given, so auth-saas passes it the same NFKC form it hashes; otherwise a password whose NFKC form
  differs from what was typed would never match its own history.

### Trailing slash

auth-saas's two routers and the blog mount `trailingSlash()` and delete their copies. The redirect
status changes from 301 to 308. Browsers cache both, so the change is invisible to a returning visitor,
and a POST to a slashed path is now repeated with its body instead of turning into a GET.

## Consequences

### Positive

- **Correct cost reporting**: auth-saas reports storage cost at Cloudflare's price instead of 1% of it,
  and both apps price Durable Object duration, R2 and Workers Logs as billed.
- **One place to update**: a Cloudflare price change, a new disposable domain or a refreshed
  common-password list reaches every app through the package.
- **Fewer ways to share an identity**: addresses that folded to someone else's identity, or two
  spellings of one domain, are refused before they reach a subject record.
- **Real password screening**: a list of 46,483 common passwords and the breach lookup replace the
  40-entry placeholder.
- **Uniform tests**: `MemoryCaptcha` replaces each app's hand-written siteverify stubs.

### Negative

- **Reported costs jump**: auth-saas's storage cost rises about 100-fold the day its rate card switches,
  which the billing provider's usage history will show.
- **Stricter address rules**: some addresses the apps accepted before are refused, and the sign-up
  forms with disposable checks refuse some addresses real people use.
- **Latency on sign-up**: the mail-server check adds a DNS-over-HTTPS round trip, and the breach check
  an HTTPS request, to the forms that enable them.
- **Bundle size**: an app that imports `@sdxc/password-policy` or its `./common` path carries about
  450 KB of list source, and `@sdxc/email-address/disposable` about 130 KB.

### Neutral

- **Policy stays in the apps**: when to challenge, which checks a form runs and the messages each
  refusal renders remain app code.
- **auth-saas timing**: auth-saas is being re-architected, and the modules this touches
  (`database/subject-identifiers.ts`, `database/passwords.ts`, `app/lib/cost-rates.ts`) keep their
  place in it, so adopting the packages now carries over.

## Implementation Plan

### Phase 1: Cost reporting

**Priority:** High

1. auth-saas: rebuild `cost-rates.ts` on `@sdxc/cloudflare-pricing`, split D1 reads and writes, add R2
   and Workers Logs, bump `RATE_CARD_VERSION`.
2. uptime: the same, minus the D1 split, which it already has.

### Phase 2: Middleware and captcha

**Priority:** Medium

1. auth-saas and blog: mount `trailingSlash()` and delete the copies.
2. auth-saas: verify through `@sdxc/captcha`, keep `turnstile-challenge.ts`, move tests to
   `MemoryCaptcha`.
3. uptime: the trial guard's challenge through `Turnstile`, the widget through `TurnstileWidget`.

### Phase 3: Email addresses

**Priority:** Medium

1. auth-saas: query `subject_identifiers` for addresses the parser refuses, then replace the email
   folding with `parseEmailAddress()` and `normalizeDomain()`.
2. auth-saas, uptime, books, r3-auth, blog: parse every accepted address and add the checks in the
   table above.

### Phase 4: Passwords

**Priority:** Medium

1. auth-saas: replace the policy checks and the reuse loop in `database/passwords.ts`, map the new
   issues in `password-policy-issue.ts`, enable the breach lookup.
2. r3-auth: run `checkPassword()` on registration and reset, replacing the two minimum-length
   constants, and enable the breach lookup.

## Alternatives Considered

### Keep each app's copy and fix the defects in place

Fixing auth-saas's rate card alone would take a line each, but the next Cloudflare price change would
again need to be found and applied in two files, and the email and password fixes would be written a
third and fourth time for the apps that do not have them yet.

### Move everything at once in one change per package

Each package change would then span several apps, and release notes are built from the commits that
touch a workspace. One commit per app keeps each app's notes describing what changed for that app.

## References

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [NIST SP 800-63B-4, §3.1.1.2 Password Verifiers](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [Have I Been Pwned: Pwned Passwords range API](https://haveibeenpwned.com/API/v3#PwnedPasswords)
- [RFC 7505: A "Null MX" No Service Resource Record](https://www.rfc-editor.org/rfc/rfc7505)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)

## Current Progress

- [x] Packages built and made public
- [ ] Phase 1: auth-saas cost rates
- [ ] Phase 1: uptime cost rates
- [ ] Phase 2: auth-saas trailing slash
- [ ] Phase 2: blog trailing slash
- [ ] Phase 2: auth-saas captcha
- [ ] Phase 2: uptime captcha
- [ ] Phase 3: auth-saas email folding
- [ ] Phase 3: email checks in auth-saas, uptime, books, r3-auth and blog
- [ ] Phase 4: auth-saas password policy
- [ ] Phase 4: r3-auth password policy

## Notes

- The package defaults are not the apps' current values: `minLength` is 15 where both apps use 8. Each
  app passes its value explicitly until the product decision is made.
- `@sdxc/password-policy`'s root import does not include the history check, whose scrypt verification
  needs `node:crypto`; import it from `@sdxc/password-policy/history`.
