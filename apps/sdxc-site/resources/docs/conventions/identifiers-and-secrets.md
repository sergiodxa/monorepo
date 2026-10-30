---
title: Identifiers and secrets
description: Which generator mints a record id, a random identifier and a secret, and why a UUID never stands in for a secret.
section:
    title: Conventions
    order: 3
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "When a value gets a time-ordered UUIDv7, a random UUIDv4 or a token from `randomToken`"
    - "Why a UUID is an identifier and never a secret"
    - "How to store a token as a digest and test what each generator promises"
---

An app mints three kinds of value that all look like random strings: the primary key of a row,
an identifier that only has to be unique, and a secret that grants whoever holds it access to
something. Each has its own generator, picked by what the value does once it exists.

```bash
npm add @sdxc/crypto @sdxc/data-model @sdxc/jwt @sdxc/result @sdxc/uuid
```

## Pick the generator by what the value does

| The value                                                                                  | Mint it with                        | Because                                                                      |
| ------------------------------------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------- |
| A record's primary key                                                                     | `generateUUID` from `@sdxc/uuid/v7` | it sorts by creation, so new rows append to the index and an id pages a list |
| A JWT `jti`, a request or correlation id, a job id, a test fixture's id                    | `generateUUID` from `@sdxc/uuid/v4` | it is unique and carries no creation time or order                           |
| A session or API token, an invitation or reset token, OAuth `state`, an authorization code | `randomToken` from `@sdxc/crypto`   | 256 random bits in a URL-safe string, with a prefix a scanner can flag       |

Both UUID entry points export the same `generateUUID()`, returning the branded `UUID` type from
`@sdxc/uuid`, so the import path is the whole decision. `randomToken` returns a plain `string`.

## Give every record a time-ordered id

A model's `generateId` mints the key of every row inserted without one. Pass the v7 generator:

```typescript {% title="app/models/teams.ts" %}
import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v7";

import { teams } from "~/database/schema";

export const Teams = createModel(teams, { generateId: generateUUID });
```

The timestamp comes first in a v7 value, so string order is creation order: each insert lands
at the end of the primary key's index, and the last id of a page is a complete cursor for the
next one. Anyone holding a v7 id can read when it was minted, so an id you show outside the
system whose creation time should stay private comes from `@sdxc/uuid/v4` instead.

## Mint a random id for everything else

An identifier that names an event, a token or a request only has to be unique. A v4 value has
no order and no timestamp, so it says nothing beyond itself. A token's `jti`, which a revocation
list stores, is one:

```typescript {% title="app/services/access-tokens.ts" %}
import { JWT } from "@sdxc/jwt";
import { generateUUID } from "@sdxc/uuid/v4";

export function accessToken(userId: string) {
	return new JWT({
		sub: userId,
		aud: "api",
		iat: "0s",
		exp: "15m",
		jti: generateUUID(),
	});
}
```

## Mint secrets with randomToken

A secret is a value whose holder is let in: an invitation link, a password reset, an API key,
the OAuth `state` a callback checks. `randomToken` draws 256 random bits and encodes them as 43
URL-safe characters; a `prefix` is joined with `_`, so a leaked key is recognizable by kind.

An invitation pairs both kinds of value: the row gets a v7 id, and the link gets a token. Store
the token's SHA-256 digest, so a reader of the table finds digests rather than working links:

```typescript {% title="app/services/invitations.ts" %}
import type { Result } from "@sdxc/result";
import type { UUID } from "@sdxc/uuid";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";

export interface Invitation {
	id: UUID;
	teamId: UUID;
	tokenHash: string;
}

export interface IssuedInvitation {
	invitation: Invitation;
	token: string;
}

export async function hashInvitationToken(
	token: string,
): Promise<Result<string, Error>> {
	let digest = await sha256(token);
	if (isFailure(digest)) return digest;
	return success(Hex.encode(digest.data));
}

export async function issueInvitation(
	teamId: UUID,
): Promise<Result<IssuedInvitation, Error>> {
	let token = randomToken({ prefix: "inv" });
	let tokenHash = await hashInvitationToken(token);
	if (isFailure(tokenHash)) return tokenHash;

	let invitation = { id: generateUUID(), teamId, tokenHash: tokenHash.data };
	return success({ invitation, token });
}
```

Insert `invitation` and mail a link carrying `token`. When the link comes back, hash the
presented token with `hashInvitationToken` and look the row up by `tokenHash`. A value you
compare rather than look up, such as the OAuth `state` kept in a cookie, goes through
`timingSafeEqual` from `@sdxc/crypto`, which compares in constant time.

## Keep UUIDs out of secrets

A UUID is built to be an identifier, and identifiers travel into URLs, logs, error reports and
support tickets. A v7 value leaves only 62 random bits after its timestamp and counter, and
RFC 9562, which defines both versions, tells implementations to assume a UUID is guessable.
Keep the two apart in your types: a record's id is a `UUID`, and a token is a `string` the code
only hashes or compares.

> [!WARNING]
> A link of the form `/invitations/<uuid>/accept` makes the record's id the credential. Anyone
> who sees the id in a log, a referrer header or an admin screen can accept the invitation. Put
> a `randomToken` in the link and keep the id for the row.

## Test what each generator promises

Randomness cannot be asserted, so pin the observable contract: v7 order, the token's shape, and
that the stored digest finds the token without containing it:

```typescript {% title="app/services/invitations.test.ts" %}
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";
import { expect, test } from "vitest";

import { hashInvitationToken, issueInvitation } from "~/app/services/invitations";

test("v7 ids sort in the order they were minted", () => {
	let ids = Array.from({ length: 1000 }, () => generateUUID());
	expect([...ids].sort()).toEqual(ids);
});

test("stores a digest that finds the token and never the token", async () => {
	let { invitation, token } = unwrap(await issueInvitation(generateUUID()));

	expect(token).toMatch(/^inv_[A-Za-z0-9_-]{43}$/);
	expect(invitation.tokenHash).not.toContain(token);
	expect(unwrap(await hashInvitationToken(token))).toBe(invitation.tokenHash);
});
```

## Where to go next

- [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) — reset links, scrypt
  passwords, signed links and sealed secrets built on the same tokens.
- [Dates, text and identifiers](/docs/building-remix-apps/values#mint-record-ids) — prefixed
  TypeIDs for the ids people see, from the model to the URL.
- [`@sdxc/uuid`](/api/uuid) — `isUUID`, `assertUUID` and the error each failure throws.
