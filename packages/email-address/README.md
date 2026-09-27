# @sdxc/email-address

Email address parsing and normalization, disposable-domain detection, and mail-server checks.

## Installation

```bash
npm add @sdxc/email-address
```

Checks return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values; install it
alongside to narrow them with `isFailure` and `isSuccess`.

## Usage

### Parse An Address

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { isSuccess } from "@sdxc/result";

let parsed = parseEmailAddress("  Jane.Doe@Bücher.Example ");

if (isSuccess(parsed)) parsed.data;
// {
//   address: "Jane.Doe@xn--bcher-kva.example",
//   canonical: "jane.doe@xn--bcher-kva.example",
//   localPart: "Jane.Doe",
//   domain: "xn--bcher-kva.example",
// }
else parsed.error.reason; // "local-part-invalid", "domain-invalid", …
```

### Refuse A Disposable Address

```typescript
import type { EmailAddress } from "@sdxc/email-address";

import { checkDisposable } from "@sdxc/email-address/disposable";

function refuseDisposable(address: EmailAddress) {
	return checkDisposable(address); // failure for jane@inbox.mailinator.com
}
```

### Check The Domain Receives Mail

```typescript
import { checkMailServer } from "@sdxc/email-address/mail-server";

let servers = await checkMailServer("example.com");
// success({ domain: "example.com", hosts: ["mx1.example.com"], implicit: false, ttl: 300 })
```

### Suggest A Fix For A Mistyped Provider

```typescript
import type { EmailAddress } from "@sdxc/email-address";

import { suggestDomain } from "@sdxc/email-address/typo";

function didYouMean(address: EmailAddress) {
	return suggestDomain(address)?.address; // "jane@gmail.com" for jane@gmial.com
}
```

## API

Each capability has its own export path, so code that only parses bundles neither the
~130 KB disposable-domain list nor the DNS client. Every failure carries a `reason` code, so an
app maps each one to its own message.

### `@sdxc/email-address`

#### `parseEmailAddress(input): Result<EmailAddress, InvalidEmailAddressError>`

NFKC-normalizes and trims the input, splits it at the last `@`, and accepts an RFC 5322
dot-atom local part (plus non-ASCII per RFC 6531, except controls, invisible format characters,
unassigned and private-use code points, and spaces) of at most 64 UTF-8 octets. Quoted local
parts (`"jane doe"@example.com`) are refused. The domain follows `normalizeDomain`, and the
whole `address` is at most 254 octets (RFC 5321).

An `EmailAddress` holds:

- `address` - the local part as entered, `@`, and the ASCII domain. Store and send to this one:
  RFC 5321 lets a mail host treat local-part case as significant.
- `canonical` - `address` with the local part lowercased. Key uniqueness and lookups on this
  one. Dots and `+tags` stay: only the mail host knows whether `j.ane+news@` and `jane@` share a
  mailbox, and a wrong guess merges two people.
- `localPart` - NFKC-normalized, case as entered.
- `domain` - lowercased and ASCII-encoded (punycode), the form DNS and SMTP use.

#### `normalizeDomain(input): Result<string, InvalidEmailAddressError>`

The domain rule on its own, for a bare domain such as one an organization claims. The input is
NFKC-normalized and trimmed, any ASCII besides letters, digits, `-` and `.` is refused, and the
rest is IDNA-encoded the way the
[URL standard](https://developer.mozilla.org/en-US/docs/Web/API/URL/hostname) parses a host. The
result needs at least two labels of 1–63 letters, digits and inner hyphens, at most 253
characters, and a top-level label that is not all digits, so IP literals, single-label names
(`localhost`) and a trailing root dot (`example.com.`) are refused.

```typescript
normalizeDomain("Straße.DE"); // success("xn--strae-oqa.de")
```

#### `InvalidEmailAddressError`

The failure of both functions. `reason` is one of:

| Reason                | Meaning                                                  |
| --------------------- | -------------------------------------------------------- |
| `missing-at-sign`     | No `@`, including empty input                            |
| `local-part-empty`    | Nothing before the `@`                                   |
| `local-part-too-long` | Local part over 64 octets                                |
| `local-part-invalid`  | Not a dot-atom: quoted, spaces, stray dots, a second `@` |
| `domain-empty`        | Nothing after the `@`                                    |
| `domain-too-long`     | Encoded domain over 253 characters                       |
| `domain-invalid`      | Not a hostname by the rules above                        |
| `address-too-long`    | Whole address over 254 octets                            |

`EmailAddress` and `EmailAddressReason` are exported as types.

### `@sdxc/email-address/disposable`

The bundled list is the
[disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
blocklist, dedicated to the public domain under
[CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) and taken on 2026-09-27. A domain
matches when it equals a listed domain or is a subdomain of one: `x.mailinator.com` matches
`mailinator.com`. To accept a listed domain anyway, test for it before calling
`checkDisposable`.

#### `checkDisposable(address): Result<EmailAddress, DisposableDomainError>`

Passes the address through unchanged, or fails with a `DisposableDomainError` whose `reason` is
`"disposable-domain"` and whose `domain` is the listed entry it matched.

#### `isDisposableDomain(domain): boolean` / `findDisposableDomain(domain): string | null`

Whether an ASCII domain is listed, or which entry it matched. Case and one trailing dot are
ignored; pass an internationalized domain in its ASCII form, as `normalizeDomain` returns it.

### `@sdxc/email-address/mail-server`

#### `checkMailServer(domain, options?): Promise<Result<MailServers, MailServerError>>`

Checks that an ASCII domain can receive mail, the way a sending server finds its hosts, over
DNS over HTTPS through [`@sdxc/doh`](https://www.npmjs.com/package/@sdxc/doh). `options` go to
each lookup: `resolver` (Cloudflare by default), `timeoutMs` (default `5000`), `signal`,
`dnssec` and `checkingDisabled`.

| Answer                                   | Result                                  |
| ---------------------------------------- | --------------------------------------- |
| MX records                               | `hosts` by ascending preference         |
| Only an RFC 7505 null MX (`0 .`)         | `null-mx`                               |
| No MX, but an A or AAAA address          | `implicit: true`, `hosts: [domain]`     |
| No MX and no address                     | `no-mail-server`                        |
| NXDOMAIN                                 | `domain-not-found`                      |
| SERVFAIL, timeout, other resolver errors | `lookup-failed` (the answer is unknown) |

`MailServers` holds `domain`, `hosts`, `implicit`, and `ttl`, the smallest TTL among the records
the answer rests on (`null` when none reported one). `MailServerError` holds `reason` and, for
`domain-not-found` and `lookup-failed`, the DNS error as `cause`. `MailServerReason` is exported
as a type.

This proves the domain can receive mail, never that the mailbox exists: that takes an SMTP
conversation, which serverless runtimes cannot open and which gets the prober blocklisted.
Confirm a mailbox by sending it a link or code.

### `@sdxc/email-address/role-account`

#### `checkRoleAccount(address): Result<EmailAddress, RoleAccountError>`

Fails with a `RoleAccountError` whose `reason` is `"role-account"` and whose `role` is the match
when the local part, lowercased and with any `+tag` removed, names a function rather than a
person: `abuse`, `admin`, `administrator`, `billing`, `contact`, `do-not-reply`, `donotreply`,
`ftp`, `help`, `hostmaster`, `info`, `mailer-daemon`, `marketing`, `news`, `no-reply`, `noc`,
`noreply`, `postmaster`, `root`, `sales`, `security`, `support`, `sysadmin`, `usenet`, `uucp`,
`webmaster`, `www`. Only the whole local part counts, so `sales-jane@` passes.

### `@sdxc/email-address/typo`

#### `suggestDomain(address): EmailAddress | null`

The address with its domain replaced by the provider it most likely meant, or `null`. The
providers are `gmail.com`, `yahoo.com`, `hotmail.com`, `outlook.com`, `icloud.com`,
`googlemail.com`, `protonmail.com`, `yandex.com` and `fastmail.com`. A domain one edit away
(insert, delete, substitute, swap two adjacent letters) is corrected, or two edits away for
providers of ten characters or more; `mail.com`, `email.com` and `ymail.com` get no suggestion.

## Pattern: Validate A Sign-Up Address

Parse first, run the checks that need no network, then the DNS check, and decide what an
unknown answer means.

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { checkDisposable } from "@sdxc/email-address/disposable";
import { checkMailServer } from "@sdxc/email-address/mail-server";
import { suggestDomain } from "@sdxc/email-address/typo";
import { isFailure } from "@sdxc/result";

async function validateSignUpEmail(input: string) {
	let parsed = parseEmailAddress(input);
	if (isFailure(parsed)) return { error: parsed.error.reason };

	let suggestion = suggestDomain(parsed.data)?.address;

	let disposable = checkDisposable(parsed.data);
	if (isFailure(disposable)) return { error: disposable.error.reason };

	let servers = await checkMailServer(parsed.data.domain, { timeoutMs: 2000 });
	if (isFailure(servers) && servers.error.reason !== "lookup-failed") {
		return { error: servers.error.reason, suggestion };
	}

	return { email: parsed.data, suggestion };
}
```

`lookup-failed` fails open here: a resolver outage never blocks a sign-up, and the confirmation
email is the real test. Fail closed instead where a bad address costs more than a lost sign-up.

## Pattern: Store One Form, Index The Other

Keep `address` for sending and a unique index on `canonical`, so a second sign-up with different
capitalization finds the existing account.

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

## Pattern: Cache Mail-Server Answers

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
