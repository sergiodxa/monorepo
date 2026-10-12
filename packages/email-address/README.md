# @sdxc/email-address

Email address parsing, normalization, disposable-domain and mail-server checks.

Each check lives under its own export path, so code that only parses bundles neither the
~130 KB disposable-domain list nor the DNS client. Every failure carries a `reason` code that
an app maps to its own message.

## Installation

```sh
npm add @sdxc/email-address
```

Every check returns a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result);
install it alongside to narrow them with `isFailure` and `isSuccess`.

## Usage

### Parse an address

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { isSuccess } from "@sdxc/result";

let parsed = parseEmailAddress("  Jane.Doe@Bücher.Example ");

if (isSuccess(parsed)) parsed.data;
// {
//   address: "Jane.Doe@xn--bcher-kva.example",   store and send to this
//   canonical: "jane.doe@xn--bcher-kva.example", compare and index on this
//   localPart: "Jane.Doe",
//   domain: "xn--bcher-kva.example",
// }
else parsed.error.reason; // "local-part-invalid", "domain-invalid", …
```

### Refuse disposable and role addresses

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { checkDisposable } from "@sdxc/email-address/disposable";
import { checkRoleAccount } from "@sdxc/email-address/role-account";
import { isSuccess } from "@sdxc/result";

let parsed = parseEmailAddress("jane@inbox.mailinator.com");
if (isSuccess(parsed)) {
	checkDisposable(parsed.data); // failure: reason "disposable-domain", domain "mailinator.com"
	checkRoleAccount(parsed.data); // success: the same address
}
```

### Check the domain receives mail

```typescript
import { checkMailServer } from "@sdxc/email-address/mail-server";

let servers = await checkMailServer("example.com");
// success({ domain: "example.com", hosts: ["mx1.example.com"], implicit: false, ttl: 300 })
```

### Suggest a fix for a mistyped provider

```typescript
import type { EmailAddress } from "@sdxc/email-address";

import { suggestDomain } from "@sdxc/email-address/typo";

function didYouMean(address: EmailAddress) {
	return suggestDomain(address)?.address; // "jane@gmail.com" for jane@gmial.com
}
```

## API

### `@sdxc/email-address`

#### `parseEmailAddress(input: string): Result<EmailAddress, InvalidEmailAddressError>`

NFKC-normalizes and trims the input, splits it at the last `@`, and accepts an RFC 5322
dot-atom local part (non-ASCII allowed per RFC 6531) of at most 64 UTF-8 octets, a domain by
the `normalizeDomain` rule, and a whole address of at most 254 octets. Quoted local parts are
refused.

#### `normalizeDomain(input: string): Result<string, InvalidEmailAddressError>`

The domain rule on its own, for a bare domain such as one an organization claims: NFKC,
trimmed, IDNA-encoded to lowercase ASCII, at least two labels, and a top-level label that is
not all digits. IP literals, `localhost` and a trailing root dot are refused.

```typescript
normalizeDomain("Straße.DE"); // success("xn--strae-oqa.de")
```

#### `InvalidEmailAddressError`

The failure of both functions; `reason` is an `EmailAddressReason`.

| Reason                | Meaning                                                  |
| --------------------- | -------------------------------------------------------- |
| `missing-at-sign`     | No `@`, including empty input                            |
| `local-part-empty`    | Nothing before the `@`                                   |
| `local-part-too-long` | Local part over 64 octets                                |
| `local-part-invalid`  | Not a dot-atom: quoted, spaces, stray dots, a second `@` |
| `domain-empty`        | Nothing after the `@`                                    |
| `domain-too-long`     | Encoded domain over 253 characters                       |
| `domain-invalid`      | Not a public hostname                                    |
| `address-too-long`    | Whole address over 254 octets                            |

### `@sdxc/email-address/disposable`

Checks against the bundled
[disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
blocklist ([CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)). A domain matches
when it equals a listed domain or sits under one: `x.mailinator.com` matches `mailinator.com`.

#### `checkDisposable(address: EmailAddress): Result<EmailAddress, DisposableDomainError>`

The same address, or a `DisposableDomainError` whose `reason` is `"disposable-domain"` and
whose `domain` is the listed entry it matched.

#### `findDisposableDomain(domain: string): string | null`

The listed entry an ASCII domain matches, or `null`. Case and one trailing dot are ignored;
pass an internationalized domain in the ASCII form `normalizeDomain` returns.

#### `isDisposableDomain(domain: string): boolean`

Whether `findDisposableDomain` finds an entry.

### `@sdxc/email-address/mail-server`

#### `checkMailServer(domain: string, options?: DoH.ResolveOptions): Promise<Result<MailServers, MailServerError>>`

Finds the mail hosts of an ASCII domain the way a sending server does, over DNS over HTTPS
through [`@sdxc/doh`](https://www.npmjs.com/package/@sdxc/doh). `options` go to each lookup:
`resolver` (Cloudflare by default), `timeoutMs` (default `5000`), `signal`, `dnssec` and
`checkingDisabled`.

| Answer                                   | Result                                    |
| ---------------------------------------- | ----------------------------------------- |
| MX records                               | `hosts` by ascending preference           |
| Only an RFC 7505 null MX (`0 .`)         | `null-mx`                                 |
| No MX, but an A or AAAA address          | `implicit: true`, `hosts: [domain]`       |
| No MX and no address                     | `no-mail-server`                          |
| NXDOMAIN                                 | `domain-not-found`                        |
| SERVFAIL, timeout, other resolver errors | `lookup-failed`, so the answer is unknown |

It confirms the domain receives mail; confirm the mailbox itself by sending it a link or code.

#### `MailServerError`

The failure of `checkMailServer`: `reason` is a `MailServerReason`, and `cause` holds the DNS
error behind `domain-not-found` and `lookup-failed`.

### `@sdxc/email-address/role-account`

#### `checkRoleAccount(address: EmailAddress): Result<EmailAddress, RoleAccountError>`

The same address, or a `RoleAccountError` whose `reason` is `"role-account"` and whose `role`
is the match, when the whole local part, lowercased and without its `+tag`, names a function:
`abuse`, `admin`, `administrator`, `billing`, `contact`, `do-not-reply`, `donotreply`, `ftp`,
`help`, `hostmaster`, `info`, `mailer-daemon`, `marketing`, `news`, `no-reply`, `noc`,
`noreply`, `postmaster`, `root`, `sales`, `security`, `support`, `sysadmin`, `usenet`, `uucp`,
`webmaster` or `www`. `Support+billing@` matches; `sales-jane@` passes.

### `@sdxc/email-address/typo`

#### `suggestDomain(address: EmailAddress): EmailAddress | null`

The address with its domain replaced by the provider it most likely meant, or `null`. The
providers are `gmail.com`, `yahoo.com`, `hotmail.com`, `outlook.com`, `icloud.com`,
`googlemail.com`, `protonmail.com`, `yandex.com` and `fastmail.com`; a domain one edit away
(two for providers of ten characters or more) is corrected, and `mail.com`, `email.com` and
`ymail.com` are left alone.

### Types

#### `EmailAddress`

`address` (local part as entered, ASCII domain) is the form to store and deliver to, since a
mail host may treat local-part case as significant. `canonical` lowercases the local part and
keeps dots and `+tags`, the form to key uniqueness on. `localPart` and `domain` are the halves.

#### `EmailAddressReason`

The union of `InvalidEmailAddressError` reasons in the table above.

#### `MailServers`

`domain`, `hosts`, `implicit`, and `ttl`: the smallest TTL among the records the answer rests
on, or `null` when none reported one.

#### `MailServerReason`

`"null-mx" | "no-mail-server" | "domain-not-found" | "lookup-failed"`.

## Pattern: Validate a sign-up address

Parse first, run the checks that need no network, then the DNS check, and decide what an
unknown answer means. Here `lookup-failed` fails open, so a resolver outage never blocks a
sign-up and the confirmation email stays the real test.

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { checkDisposable } from "@sdxc/email-address/disposable";
import { checkMailServer } from "@sdxc/email-address/mail-server";
import { checkRoleAccount } from "@sdxc/email-address/role-account";
import { suggestDomain } from "@sdxc/email-address/typo";
import { isFailure } from "@sdxc/result";

async function validateSignUpEmail(input: string) {
	let parsed = parseEmailAddress(input);
	if (isFailure(parsed)) return { error: parsed.error.reason };

	let suggestion = suggestDomain(parsed.data)?.address;

	let disposable = checkDisposable(parsed.data);
	if (isFailure(disposable)) return { error: disposable.error.reason };

	let role = checkRoleAccount(parsed.data);
	if (isFailure(role)) return { error: role.error.reason };

	let servers = await checkMailServer(parsed.data.domain, { timeoutMs: 2000 });
	if (isFailure(servers) && servers.error.reason !== "lookup-failed") {
		return { error: servers.error.reason, suggestion };
	}

	return { email: parsed.data, suggestion };
}
```

## Pattern: Store one form, index the other

Keep `address` for sending and a unique index on `canonical`, so a second sign-up with
different capitalization finds the existing account.

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { isFailure } from "@sdxc/result";

interface Users {
	findByCanonicalEmail(canonical: string): Promise<{ id: string } | null>;
	create(user: { email: string; emailCanonical: string }): Promise<{ id: string }>;
}

async function findOrCreateUser(users: Users, input: string) {
	let parsed = parseEmailAddress(input);
	if (isFailure(parsed)) return parsed;

	let existing = await users.findByCanonicalEmail(parsed.data.canonical);
	return (
		existing ?? users.create({ email: parsed.data.address, emailCanonical: parsed.data.canonical })
	);
}
```

## Pattern: Verify a claimed organization domain

Normalize a bare domain, refuse a disposable one unless you allow it explicitly, and confirm
it receives mail before sending a verification email to it.

```typescript
import { normalizeDomain } from "@sdxc/email-address";
import { findDisposableDomain } from "@sdxc/email-address/disposable";
import { checkMailServer } from "@sdxc/email-address/mail-server";
import { isFailure } from "@sdxc/result";

let allowedDomains = new Set(["example-partner.com"]);

async function claimDomain(input: string) {
	let domain = normalizeDomain(input);
	if (isFailure(domain)) return { error: domain.error.reason };

	let listed = findDisposableDomain(domain.data);
	if (listed !== null && !allowedDomains.has(listed)) return { error: "disposable-domain" };

	let servers = await checkMailServer(domain.data);
	if (isFailure(servers)) return { error: servers.error.reason };

	return { domain: domain.data, hosts: servers.data.hosts };
}
```

## Pattern: Cache mail-server answers

A burst of sign-ups from one domain costs one lookup when the answer is cached for its `ttl`.

```typescript
import type { MailServers } from "@sdxc/email-address/mail-server";

import { checkMailServer } from "@sdxc/email-address/mail-server";
import { isSuccess } from "@sdxc/result";

let cache = new Map<string, { servers: MailServers; expires: number }>();

async function mailServersFor(domain: string) {
	let cached = cache.get(domain);
	if (cached && cached.expires > Date.now()) return cached.servers;

	let servers = await checkMailServer(domain);
	if (!isSuccess(servers)) return null;

	let seconds = Math.max(servers.data.ttl ?? 300, 60);
	cache.set(domain, { servers: servers.data, expires: Date.now() + seconds * 1000 });
	return servers.data;
}
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
		"@sdxc/email-address": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
