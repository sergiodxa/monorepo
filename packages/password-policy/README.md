# @sdxc/password-policy

Decides whether a candidate password is acceptable under NIST SP 800-63B: length, common and breached passwords, similarity to the account, and reuse of a previous password.

## Installation

```bash
npm add @sdxc/password-policy
```

Every check answers with an [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) value, and the reuse check verifies hashes with [`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto); both install alongside this package.

The rules are the ones [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) (section 3.1.1.2) lists in place of composition rules. A refusal is a `PasswordPolicyError` whose `issue` names the rule and carries the values a message needs, so you render your own copy. Every local comparison runs on the NFKC form, lowercased, so `Ｐａｓｓｗｏｒｄ１` and `password1` are the same password to every rule.

## Usage

### Check a new password

```typescript
import { checkPassword } from "@sdxc/password-policy";
import { isFailure } from "@sdxc/result";

let result = await checkPassword(submitted, {
	identifiers: ["jane.doe@example.com", "janedoe"],
	deniedTerms: ["Example"],
});

if (isFailure(result)) {
	result.error.issue; // { reason: "too-short", minLength: 15, length: 11 }
}
```

### Add the breached-password lookup

```typescript
import { checkPassword } from "@sdxc/password-policy";

let result = await checkPassword(submitted, {
	identifiers: ["jane.doe@example.com"],
	breached: { userAgent: "example-accounts", timeout: 2000 },
});
```

The lookup is off unless `breached` is set. When enabled it runs last, after every local rule has accepted the password.

### A password only ever used with a second factor

```typescript
import { checkPassword } from "@sdxc/password-policy";

let result = await checkPassword(submitted, { minLength: 8 });
```

### Run one rule on its own

```typescript
import { checkBreachedPassword } from "@sdxc/password-policy/breached";
import { checkIdentifiers } from "@sdxc/password-policy/context";
import { checkLength } from "@sdxc/password-policy/length";

checkLength(submitted, { minLength: 8 });
checkIdentifiers(submitted, ["jane.doe@example.com"]);
await checkBreachedPassword(submitted);
```

## API

### Entry points

Only `.` and `./common` include the common-password list, about 450 KB of source (about 220 KB gzipped). Import from the other paths when you need a rule without it — a Worker that only checks length and asks Have I Been Pwned stays small.

| Path                             | Exports                                                                                                         | Includes the list |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------- |
| `@sdxc/password-policy`          | everything below except `./history`, plus `checkPassword` and `CheckPasswordOptions`                            | yes               |
| `@sdxc/password-policy/common`   | `checkCommonPassword`, `isCommonPassword`, `COMMON_PASSWORDS_MIN_LENGTH`, `COMMON_PASSWORDS_NOTICE`             | yes               |
| `@sdxc/password-policy/history`  | `checkPasswordHistory`, `DEFAULT_MAX_HISTORY`, `PasswordHistoryOptions`                                         | no                |
| `@sdxc/password-policy/length`   | `checkLength`, `DEFAULT_MIN_LENGTH`, `DEFAULT_MAX_LENGTH`, `LengthOptions`                                      | no                |
| `@sdxc/password-policy/context`  | `checkIdentifiers`, `checkDeniedTerms`                                                                          | no                |
| `@sdxc/password-policy/breached` | `checkBreachedPassword`, `PWNED_PASSWORDS_RANGE_URL`, `DEFAULT_BREACH_CHECK_TIMEOUT`, `BreachedPasswordOptions` | no                |
| `@sdxc/password-policy/error`    | `PasswordPolicyError`                                                                                           | no                |

### `checkPassword(candidate, options?)`

Runs the rules in a fixed order and resolves to the first refusal, or to success: length, common list, identifiers, denied terms, then the breached lookup when enabled. Returns `Promise<Result<void, PasswordPolicyError>>`.

| Option        | Default | Meaning                                                                    |
| ------------- | ------- | -------------------------------------------------------------------------- |
| `minLength`   | `15`    | Fewest code points, after NFKC.                                            |
| `maxLength`   | `256`   | Most code points, after NFKC.                                              |
| `common`      | `true`  | Refuse a password on the bundled list.                                     |
| `identifiers` | `[]`    | The account's emails and usernames.                                        |
| `deniedTerms` | `[]`    | Terms a password may not contain, such as the service's name.              |
| `breached`    | `false` | `true`, or `{ userAgent?, timeout? }`, enables the Pwned Passwords lookup. |

### `checkLength(candidate, options?)`

Accepts a candidate whose NFKC form has between `minLength` and `maxLength` code points, inclusive. An emoji counts once, and `e` followed by a combining acute counts as the single `é` it composes to. Where `[...candidate].length` counts code points of the raw input, this counts them after normalization.

### `checkCommonPassword(candidate)` · `isCommonPassword(candidate)`

Look the folded candidate up in the bundled list; `checkCommonPassword` refuses a match with `{ reason: "common" }`. The list holds only entries of at least `COMMON_PASSWORDS_MIN_LENGTH` (8) code points, NIST's absolute minimum, so `isCommonPassword("123456")` is `false` — any policy that follows NIST refuses it for length first. The list is the UK NCSC's 100,000 most frequent Pwned Passwords as published in [SecLists](https://github.com/danielmiessler/SecLists) (`Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`), taken on 2026-09-27 and folded the same way as a candidate: about 46,500 entries. SecLists is MIT licensed, Copyright (c) 2018 Daniel Miessler; `COMMON_PASSWORDS_NOTICE` carries that notice, and so does the package's `LICENSE.md`.

### `checkIdentifiers(candidate, identifiers)`

Refuses a candidate that contains, or is contained in, a part of one of the identifiers. An email contributes its local part and its first domain label (`jane.doe` and `example` from `jane.doe@example.com`); any other identifier contributes itself. Parts under three code points are ignored, because they would match almost any password. The failure names the part: `{ reason: "similar-to-identifier", fragment: "jane.doe" }`.

### `checkDeniedTerms(candidate, terms)`

Refuses a candidate containing any term, trimmed and folded; a blank term is skipped. The failure carries the term as you configured it: `{ reason: "denied-term", term: "Example" }`.

### `checkBreachedPassword(candidate, options?)`

Looks the password up in Have I Been Pwned's [Pwned Passwords range API](https://haveibeenpwned.com/API/v3#PwnedPasswords). It hashes the NFC form with SHA-1 through `crypto.subtle.digest`, sends the first five hex characters to `PWNED_PASSWORDS_RANGE_URL` (`https://api.pwnedpasswords.com/range/`) with `Add-Padding: true` and a `User-Agent`, and compares the other 35 characters against the answer locally, ignoring padding entries (count `0`).

- `userAgent` (default `"@sdxc/password-policy"`): identifies your app to the API, which asks every client to send one.
- `timeout` (default `3000` ms): how long before the lookup reports `timeout`.

Resolves to `{ reason: "breached", occurrences }` for a match, or `{ reason: "breach-check-unavailable", failure, status }` when no answer arrived: `failure` is `"network"`, `"timeout"`, or `"status"` with the HTTP `status`.

**Privacy.** The password and its full hash stay in your process. The API receives a five-character prefix that hundreds of unrelated hashes share, and with padding every answer holds 800 to 1,000 entries, so neither the API nor anyone watching response sizes learns which suffix you were looking for. The API does learn that your server checked some password at that moment.

### `checkPasswordHistory(candidate, previousHashes, options?)`

Refuses a password that verifies against one of the account's previous hashes, which you load and pass **newest first**; run it after `checkPassword` passes, on a change or reset. Pass `candidate` exactly as submitted, the form you hash. `maxHistory` (default `5`) caps how many of the newest hashes are verified, and `0` checks none.

Each hash is one `password.verify` from `@sdxc/crypto`, an scrypt derivation of about 100 ms of CPU through `node:crypto` (Node, Bun, Deno, and Cloudflare Workers with `nodejs_compat`). Hashes are verified one at a time, so a recent reuse stops early. That is also why this rule lives only at `./history`: every other entry point needs just Web Crypto and `fetch`.

Resolves to `{ reason: "reused", index }` (`0` is the newest), or `{ reason: "history-check-unavailable", index }` when a stored hash could not be verified and none matched; the error's `cause` is the verifier's failure, and you decide whether that accepts or refuses. A match anywhere wins over an unverifiable entry. NIST leaves password history to organizational policy, so this rule is opt-in.

### `PasswordPolicyError`

An `Error` whose `issue` is a discriminated union to switch over. `message` is an English description for logs; build user-facing copy from `issue`.

```typescript
type Issue =
	| { reason: "too-short"; minLength: number; length: number }
	| { reason: "too-long"; maxLength: number; length: number }
	| { reason: "common" }
	| { reason: "similar-to-identifier"; fragment: string }
	| { reason: "denied-term"; term: string }
	| { reason: "breached"; occurrences: number }
	| {
			reason: "breach-check-unavailable";
			failure: "network" | "timeout" | "status";
			status: number | null;
	  }
	| { reason: "reused"; index: number }
	| { reason: "history-check-unavailable"; index: number };
```

The type is `PasswordPolicyError.Issue`; each member is also named (`PasswordPolicyError.TooShort`, `PasswordPolicyError.Reused`, …), and `PasswordPolicyError.Reason` is the union of `reason` values.

### Defaults

- **`DEFAULT_MIN_LENGTH = 15`.** NIST requires at least 15 characters for a password that is the only authenticator. A password used only alongside a second factor may be shorter, but never under 8: pass `minLength: 8` for that case, and no lower.
- **`DEFAULT_MAX_LENGTH = 256`.** NIST asks verifiers to permit at least 64 characters and to never truncate. 256 leaves room for any real passphrase while keeping one submission from forcing an arbitrarily long hash derivation.
- **`DEFAULT_BREACH_CHECK_TIMEOUT = 3000`.** A range lookup is one cached `GET` that normally answers well within a second; three seconds absorbs a slow answer without stalling a sign-up form.
- **`DEFAULT_MAX_HISTORY = 5`.** Each entry costs one slow hash verification, so five bounds a password change to roughly half a second of CPU while still refusing the passwords a person is most likely to cycle back to.
- **No composition rules.** NIST forbids them, so nothing here asks for digits, symbols or mixed case.

## Pattern: Mapping a refusal to a message

```typescript
import type { PasswordPolicyError } from "@sdxc/password-policy";

function passwordMessage(issue: PasswordPolicyError.Issue): string {
	switch (issue.reason) {
		case "too-short":
			return `Use at least ${issue.minLength} characters.`;
		case "too-long":
			return `Use at most ${issue.maxLength} characters.`;
		case "common":
		case "breached":
			return "That password is too easy to guess. Choose another.";
		case "similar-to-identifier":
			return "Your password can't contain your email or username.";
		case "denied-term":
			return `Your password can't contain "${issue.term}".`;
		case "reused":
			return "Choose a password you haven't used before.";
		case "breach-check-unavailable":
		case "history-check-unavailable":
			return "We couldn't check that password right now. Try again.";
	}
}
```

## Pattern: Failing open or closed when the lookup is unavailable

The breached lookup runs only after every local rule has accepted the password, so `breach-check-unavailable` always means the password is otherwise acceptable. Pick one policy and apply it in one place.

```typescript
import { checkPassword } from "@sdxc/password-policy";
import { isSuccess } from "@sdxc/result";

async function isAcceptable(candidate: string, email: string): Promise<boolean> {
	let result = await checkPassword(candidate, { identifiers: [email], breached: true });
	if (isSuccess(result)) return true;

	/** Fail open: an unreachable API accepts a password the local rules passed. */
	return result.error.issue.reason === "breach-check-unavailable";
}
```

To fail closed, treat `breach-check-unavailable` like any other refusal and show the "try again" message.

## Pattern: Checking, then hashing what was submitted

The normalization here is for comparison only. Hash the password exactly as submitted, not the NFKC-folded form the rules compare, so a later sign-in with the same keystrokes verifies.

```typescript
import { password } from "@sdxc/crypto";
import { checkPassword } from "@sdxc/password-policy";
import { isFailure } from "@sdxc/result";

async function choosePassword(submitted: string, email: string) {
	let accepted = await checkPassword(submitted, { identifiers: [email], breached: true });
	if (isFailure(accepted)) return accepted;

	return password.hash(submitted);
}
```

## Pattern: Refusing a reused password on change

Run the stateless policy first, then the history against the hashes you stored, newest first. Only a password that passes both is hashed and saved.

```typescript
import { password } from "@sdxc/crypto";
import { checkPassword } from "@sdxc/password-policy";
import { checkPasswordHistory } from "@sdxc/password-policy/history";
import { isFailure } from "@sdxc/result";

async function changePassword(submitted: string, email: string, storedHashes: string[]) {
	let policy = await checkPassword(submitted, { identifiers: [email] });
	if (isFailure(policy)) return policy;

	let history = await checkPasswordHistory(submitted, storedHashes, { maxHistory: 5 });
	if (isFailure(history)) return history;

	return password.hash(submitted);
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
		"@sdxc/password-policy": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
