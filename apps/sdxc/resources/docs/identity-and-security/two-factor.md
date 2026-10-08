---
title: Add two-factor sign-in with TOTP
description: Enroll an authenticator app, ask for its code after the password, spend each code once, back it up with recovery codes, and turn it off.
section:
    title: Identity & security
    order: 5
order: 8
lastUpdated: 2026-10-07
---

A time-based one-time password, the six digits an authenticator app shows, is a second thing
an attacker needs after they have guessed or phished a password. This guide adds the whole
flow to a Remix v3 app on Workers: enrolling an app and confirming its first code, asking for
a code after the password step, refusing a code that has already been used, recovery codes for
a lost phone, and turning two-factor off.

[`@sdxc/crypto`](/api/crypto) generates and checks the codes (RFC 6238), seals the shared
secret with AES-GCM and mints the recovery codes. [`@sdxc/auth`](/api/auth) reads the session
the sign-in is held in, [`@sdxc/validate`](/api/validate) checks the submitted code, and
[`@sdxc/result`](/api/result) and [`@sdxc/http`](/api/http) carry the outcomes.
[`@sdxc/qr`](/api/qr) draws the code the authenticator app scans.

```bash
npm add @sdxc/crypto @sdxc/auth @sdxc/validate @sdxc/result @sdxc/http @sdxc/qr
```

## Three tables

A user has at most one factor. Its secret is stored sealed, and `confirmed_at` stays `null`
until the user proves their app holds it. Codes already accepted and recovery codes each get
a table whose primary key does the work, as the sections below show:

```typescript {% title="database/two-factor.ts" %}
import { column as c, table } from "remix/data-table";

export const totpFactors = table({
	name: "totp_factors",
	primaryKey: ["user_id"],
	columns: {
		user_id: c.text(),
		sealed_secret: c.text(),
		confirmed_at: c.integer().nullable(),
	},
});

export const usedTotpCodes = table({
	name: "used_totp_codes",
	primaryKey: ["user_id", "code"],
	columns: { user_id: c.text(), code: c.text(), used_at: c.integer() },
});

export const recoveryCodes = table({
	name: "recovery_codes",
	primaryKey: ["user_id", "code_hash"],
	columns: { user_id: c.text(), code_hash: c.text() },
});
```

The secret is a key to the account, and it has to be read back to check every code, so it is
sealed rather than hashed. `sealSecret` and `openSecret` are the two functions of the sealing
module in [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto),
which import your `SEAL_KEY` once and wrap `seal` and `open`.

## Start enrollment

Enrollment mints a secret, seals it straight away and returns it in the two forms an
authenticator app takes: an `otpauth://` URI to scan, and the setup key to type:

```typescript {% title="app/services/two-factor/enroll.ts" %}
import type { Database } from "remix/data-table";

import { totp } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { sealSecret } from "~/app/services/sealing";
import { totpFactors } from "~/database/two-factor";

export async function beginEnrollment(
	db: Database,
	user: { id: string; email: string },
) {
	let existing = await db.find(totpFactors, { user_id: user.id });
	if (existing?.confirmed_at) return failure(new Error("Two-factor is already on"));

	let secret = totp.generateSecret();
	let sealed = await sealSecret(secret);
	if (isFailure(sealed)) return sealed;

	if (existing) await db.delete(totpFactors, { user_id: user.id });
	await db.create(totpFactors, {
		user_id: user.id,
		sealed_secret: sealed.data,
		confirmed_at: null,
	});

	let uri = totp.uri(secret, { issuer: "Invoices", account: user.email });
	return success({ uri, setupKey: secret });
}
```

`generateSecret` returns 20 random bytes as uppercase base32, the encoding authenticator apps
accept. `uri` names the entry the app shows, here "Invoices: ada@example.com", and writes the
defaults into the URI: SHA-1, six digits and a 30-second step, which is what those apps assume.
Starting over replaces an unconfirmed secret, but never an active factor: turning it off comes
first.

The setup route is a `POST`, since it writes, and renders the page:

```tsx {% title="app/http/controllers/two-factor/setup.tsx" %}
import { redirect } from "@sdxc/http/response";
import { QR } from "@sdxc/qr";
import { isFailure, isSuccess } from "@sdxc/result";
import { createAction } from "remix/router";

import { currentUser } from "~/app/auth/current-user";
import { beginEnrollment } from "~/app/services/two-factor/enroll";
import { EnrollTwoFactorPage } from "~/resources/views/enroll-two-factor";
import routes from "~/routes/web";

export default createAction(routes.twoFactor.setup, async (ctx) => {
	let started = await beginEnrollment(ctx.db, currentUser(ctx));
	if (isFailure(started)) {
		ctx.log.warn("two_factor.setup_refused", { reason: started.error.message });
		return redirect(routes.account.href());
	}

	let { uri, setupKey } = started.data;
	let encoded = QR.encode(uri, { level: "M" });
	if (isFailure(encoded)) {
		ctx.log.warn("two_factor.qr_failed", { code: encoded.error.code });
	}

	return ctx.render(
		<EnrollTwoFactorPage
			uri={uri}
			setupKey={setupKey}
			qr={isSuccess(encoded) ? encoded.data : null}
		/>,
	);
});
```

`currentUser` is your own lookup of the signed-in account, behind whatever middleware protects
the route. `QR.encode` turns the URI into a QR symbol and answers a `Result`, so the action
encodes before rendering and logs the rare failure, such as a URI too long for any symbol;
the page then renders without the code. `QrCode` draws the symbol as an inline SVG, which needs
no `img-src data:` in your CSP and stays dark on light under a dark theme. The page shows the
code, the setup key for anyone who cannot scan, and the URI as a link, which opens the app
directly on a phone:

```tsx {% title="resources/views/enroll-two-factor.tsx" %}
import type { QR } from "@sdxc/qr";
import type { Handle } from "remix/component";

import { QrCode } from "@sdxc/qr/component";
import { Button, TextField } from "@sdxc/ui";

import routes from "~/routes/web";

interface EnrollTwoFactorProps {
	uri: string;
	setupKey: string;
	qr: QR | null;
}

export function EnrollTwoFactorPage(handle: Handle<EnrollTwoFactorProps>) {
	return () => {
		let { uri, setupKey, qr } = handle.props;
		return (
			<form method="post" action={routes.twoFactor.confirm.href()}>
				{qr && (
					<QrCode symbol={qr} label="QR code for your authenticator app" />
				)}
				<p>
					Can't scan it? <a href={uri}>Open it in your app</a> or enter the
					key <code>{setupKey}</code>.
				</p>
				<TextField
					label="Code from the app"
					name="code"
					autoComplete="one-time-code"
				/>
				<Button type="submit">Turn on two-factor</Button>
			</form>
		);
	};
}
```

The setup key is the secret itself. Render it on this one response, and never again.

## Accept each code once

Checking a code opens the secret and verifies with a window of one step either side, which
tolerates a phone clock that is a little off. That window keeps a code valid for up to 90
seconds, so a code read over someone's shoulder or lifted from a shared screen works a
second time unless you remember it:

```typescript {% title="app/services/two-factor/accept-code.ts" %}
import type { Database } from "remix/data-table";

import { totp } from "@sdxc/crypto";
import { isFailure, isSuccess, wrap } from "@sdxc/result";

import { openSecret } from "~/app/services/sealing";
import { usedTotpCodes } from "~/database/two-factor";

export async function acceptCode(
	db: Database,
	userId: string,
	sealedSecret: string,
	code: string,
) {
	let secret = await openSecret(sealedSecret);
	if (isFailure(secret)) return false;

	let valid = await totp.verify(secret.data, code, { window: 1 });
	if (isFailure(valid) || !valid.data) return false;

	let claimed = await wrap(() =>
		db.create(usedTotpCodes, { user_id: userId, code, used_at: Date.now() }),
	);
	return isSuccess(claimed);
}
```

`totp.verify` evaluates every step in the window, even after a match, and compares each in
constant time, so neither the time taken nor the work done reveals which step matched. A code
of the wrong shape is a plain mismatch, `success(false)`. The replay guard is the insert:
`(user_id, code)` is the primary key, so a second use of the same code violates it and the
claim fails. That is one statement, so it holds on D1 even when two submissions race, and any
database failure fails closed. Delete rows older than a few minutes from a cron job, as in
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron); nothing older than
the window can verify anyway.

## Recovery codes

A user who loses their phone needs another way past the second step. Ten single-use recovery
codes, shown once when the factor is turned on, are that way. Store only their digests, like
any other credential:

```typescript {% title="app/services/two-factor/recovery-codes.ts" %}
import type { Database } from "remix/data-table";

import { Base32, Hex, randomBytes, sha256 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { recoveryCodes } from "~/database/two-factor";

async function digest(code: string) {
	let hashed = await sha256(code.replaceAll(/[\s-]/g, "").toUpperCase());
	return isFailure(hashed) ? null : Hex.encode(hashed.data);
}

export async function mintRecoveryCodes(db: Database, userId: string) {
	let codes = Array.from({ length: 10 }, () => Base32.encode(randomBytes(10)));
	let rows = [];
	for (let code of codes) {
		let codeHash = await digest(code);
		if (codeHash === null)
			return failure(new Error("Could not hash a recovery code"));
		rows.push({ user_id: userId, code_hash: codeHash });
	}

	await db.deleteMany(recoveryCodes, { where: { user_id: userId } });
	await db.createMany(recoveryCodes, rows);
	return success(codes.map((code) => code.replace(/(.{4})(?!$)/g, "$1-")));
}

export async function spendRecoveryCode(db: Database, userId: string, code: string) {
	let codeHash = await digest(code);
	if (codeHash === null) return false;
	return await db.delete(recoveryCodes, { user_id: userId, code_hash: codeHash });
}
```

Each code is 10 random bytes, 80 bits, which no guessing budget behind a rate limit gets near.
They use `Base32` over `randomBytes` rather than `randomToken`, whose base64url suits tokens a
browser carries: a person types these, and base32 has one case and no `0` or `1`. Shown
as `ABCD-EFGH-JKLM-NPQR`, a code is folded back before hashing, so hyphens, spaces and case
never matter. A plain `sha256` is enough, as for the reset tokens in the Web Crypto guide,
because the codes carry their own entropy.

Spending is `db.delete`, which answers whether a row was removed. A code works exactly once,
in one statement, with no read before the write for a second request to slip between.
Minting replaces the whole set, so offer "regenerate recovery codes" by calling it again.

## Confirm the first code

The factor turns on only once the user submits a code that verifies, which proves their app
holds the secret. That same moment mints the recovery codes:

```typescript {% title="app/services/two-factor/confirm.ts" %}
import type { Database } from "remix/data-table";

import { failure } from "@sdxc/result";

import { acceptCode } from "~/app/services/two-factor/accept-code";
import { mintRecoveryCodes } from "~/app/services/two-factor/recovery-codes";
import { totpFactors } from "~/database/two-factor";

export async function confirmEnrollment(db: Database, userId: string, code: string) {
	let factor = await db.find(totpFactors, { user_id: userId });
	if (factor === null || factor.confirmed_at !== null) {
		return failure(new Error("No setup in progress"));
	}

	if (!(await acceptCode(db, userId, factor.sealed_secret, code))) {
		return failure(new Error("Wrong code"));
	}

	await db.update(totpFactors, { user_id: userId }, { confirmed_at: Date.now() });
	return await mintRecoveryCodes(db, userId);
}
```

The code form is shared by every step that asks for one:

```typescript {% title="app/http/validators/two-factor.ts" %}
import * as s from "remix/data-schema";
import { maxLength, minLength } from "remix/data-schema/checks";

export const CODE_FORM = s.object({
	code: s.string().pipe(minLength(6), maxLength(24)),
});
```

The confirm route shows the recovery codes on success. A wrong code sends the user back to
start again, which mints a fresh secret:

```tsx {% title="app/http/controllers/two-factor/confirm.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import { currentUser } from "~/app/auth/current-user";
import { CODE_FORM } from "~/app/http/validators/two-factor";
import { confirmEnrollment } from "~/app/services/two-factor/confirm";
import { RecoveryCodesPage } from "~/resources/views/recovery-codes";
import routes from "~/routes/web";

export default createAction(routes.twoFactor.confirm, async (ctx) => {
	let form = await validate(ctx.formData, CODE_FORM);
	if (isFailure(form)) return redirect(routes.account.href());

	let codes = await confirmEnrollment(ctx.db, currentUser(ctx).id, form.data.code);
	if (isFailure(codes)) return redirect(routes.account.href());

	return ctx.render(<RecoveryCodesPage codes={codes.data} />);
});
```

## Ask for the code after the password

The password step no longer signs the user in when they have a factor. It holds the sign-in in
the session for a few minutes and sends the browser to the code page:

```typescript {% title="app/auth/pending-sign-in.ts" %}
import type { RequestContext } from "remix/router";

import { sessionOf } from "@sdxc/auth/remix/context";
import * as s from "remix/data-schema";

const PENDING_KEY = "two-factor:pending";
const PENDING = s.object({ userId: s.string(), until: s.number() });

export function holdSignIn(ctx: RequestContext, userId: string) {
	sessionOf(ctx).set(PENDING_KEY, { userId, until: Date.now() + 5 * 60 * 1000 });
}

export function pendingUserId(ctx: RequestContext): string | null {
	let pending = s.parseSafe(PENDING, sessionOf(ctx).get(PENDING_KEY));
	if (!pending.success || pending.value.until < Date.now()) return null;
	return pending.value.userId;
}

export function completeSignIn(ctx: RequestContext, userId: string) {
	let session = sessionOf(ctx);
	session.unset(PENDING_KEY);
	session.regenerateId?.(true);
	session.set("userId", userId);
}
```

`sessionOf` reads the session Remix's session middleware put on the context. In your password
action, once the password checks out, look the factor up: when it is confirmed, call
`holdSignIn(ctx, user.id)` and redirect to the code page; otherwise call `completeSignIn`
directly. The pending entry is not a signed-in session, since nothing reads `userId` from it,
and it expires, so a password alone never gets further than the code page.

The code page accepts a current code or a recovery code:

```typescript {% title="app/services/two-factor/check.ts" %}
import type { Database } from "remix/data-table";

import { acceptCode } from "~/app/services/two-factor/accept-code";
import { spendRecoveryCode } from "~/app/services/two-factor/recovery-codes";
import { totpFactors } from "~/database/two-factor";

export async function checkSecondFactor(db: Database, userId: string, code: string) {
	let factor = await db.find(totpFactors, { user_id: userId });
	if (factor === null || factor.confirmed_at === null) return false;

	if (await acceptCode(db, userId, factor.sealed_secret, code)) return true;
	return await spendRecoveryCode(db, userId, code);
}
```

```tsx {% title="app/http/controllers/sign-in/two-factor.tsx" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import { completeSignIn, pendingUserId } from "~/app/auth/pending-sign-in";
import { CODE_FORM } from "~/app/http/validators/two-factor";
import { checkSecondFactor } from "~/app/services/two-factor/check";
import { TwoFactorPage } from "~/resources/views/two-factor";
import routes from "~/routes/web";

export default createAction(routes.signIn.twoFactor, async (ctx) => {
	let userId = pendingUserId(ctx);
	if (userId === null) return redirect(routes.signIn.index.href());

	let form = await validate(ctx.formData, CODE_FORM);
	let passed =
		!isFailure(form) && (await checkSecondFactor(ctx.db, userId, form.data.code));
	if (!passed) {
		ctx.log.note("two_factor.refused", { user: userId });
		return ctx.render(<TwoFactorPage error="That code didn't work." />, {
			status: 400,
		});
	}

	completeSignIn(ctx, userId);
	return redirect(routes.dashboard.href(), { status: redirect.Status.SeeOther });
});
```

A wrong code, a used code and an unknown recovery code all answer the same page, so the
response never says which one it was. Six digits are a million possibilities, and the window
accepts three at a time, so put a rate limit on this route keyed on the pending user, as in
[Protect forms from bots and abuse](/docs/identity-and-security/protect-forms). Regenerating
the session id on the way in keeps the id the browser held during the password step from
becoming the signed-in one.

## Turn two-factor off

Turning the factor off should take the same proof as signing in with it, so a session left
open on a shared computer is not enough to remove it:

```typescript {% title="app/services/two-factor/disable.ts" %}
import type { Database } from "remix/data-table";

import { checkSecondFactor } from "~/app/services/two-factor/check";
import { recoveryCodes, totpFactors } from "~/database/two-factor";

export async function disableTwoFactor(db: Database, userId: string, code: string) {
	if (!(await checkSecondFactor(db, userId, code))) return false;

	await db.delete(totpFactors, { user_id: userId });
	await db.deleteMany(recoveryCodes, { where: { user_id: userId } });
	return true;
}
```

The route in front of it validates `CODE_FORM` and passes the signed-in user's id and the
code. Removing the factor removes its recovery codes with it, since they exist only to stand
in for it. Tell the user by email when it happens, as in
[Send email](/docs/data-and-background-work/send-email): if it was not them, they learn while
they can still act.

## Where to go next

- [Add passkeys](/docs/identity-and-security/passkeys): a credential bound to your origin, so
  unlike a TOTP code it cannot be relayed by a phishing page.
- [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto): the
  sealing module, password hashing and reset tokens this flow builds on.
- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms): rate limit
  the code page.
- [`@sdxc/crypto`](/api/crypto): every `totp` option, `Base32` and the error classes.
