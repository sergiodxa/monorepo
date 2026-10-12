# @sdxc/password-policy

Password checks: length, common and breached passwords, similarity to the account, and reuse of a previous password.

The rules follow [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) (section 3.1.1.2), so there are no composition rules: nothing asks for digits, symbols or mixed case. Every check answers a `Result` whose failure is a `PasswordPolicyError` naming the rule, and every local comparison runs on the NFKC form, lowercased, so `Ｐａｓｓｗｏｒｄ１` and `password1` are the same password.

## Installation

```sh
npm add @sdxc/password-policy
```

Checks answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and the history check verifies hashes made with `password.hash` from [`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto).

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

The rules run in order and the first refusal wins: length, the common list, identifiers, denied terms, then the breached lookup when enabled.

### Ask Have I Been Pwned

```typescript
import { checkPassword } from "@sdxc/password-policy";

let result = await checkPassword(submitted, {
	identifiers: ["jane.doe@example.com"],
	breached: { userAgent: "example-accounts", timeout: 2000 },
});
```

`breached: true` uses the default options. Only five hex characters of the password's SHA-1 leave the process, so the API never learns the password.

### Relax the minimum for a second factor

```typescript
import { checkPassword } from "@sdxc/password-policy";

let result = await checkPassword(submitted, { minLength: 8 });
```

A password that is the only authenticator needs 15 code points, the default; one always used with a second factor may go down to 8, and no lower.

### Run one rule from a small entry point

```typescript
import { checkBreachedPassword } from "@sdxc/password-policy/breached";
import { checkIdentifiers } from "@sdxc/password-policy/context";
import { checkLength } from "@sdxc/password-policy/length";

checkLength(submitted, { minLength: 8 });
checkIdentifiers(submitted, ["jane.doe@example.com"]);
await checkBreachedPassword(submitted);
```

Only `.` and `./common` bundle the common-password list (about 220 KB gzipped); every other entry point stays small.

## API

### Entry points

| Path                             | Exports                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@sdxc/password-policy`          | `checkPassword`, `CheckPasswordOptions` and everything below except `./history`                                 |
| `@sdxc/password-policy/common`   | `checkCommonPassword`, `isCommonPassword`, `COMMON_PASSWORDS_MIN_LENGTH`, `COMMON_PASSWORDS_NOTICE`             |
| `@sdxc/password-policy/length`   | `checkLength`, `DEFAULT_MIN_LENGTH`, `DEFAULT_MAX_LENGTH`, `LengthOptions`                                      |
| `@sdxc/password-policy/context`  | `checkIdentifiers`, `checkDeniedTerms`                                                                          |
| `@sdxc/password-policy/breached` | `checkBreachedPassword`, `PWNED_PASSWORDS_RANGE_URL`, `DEFAULT_BREACH_CHECK_TIMEOUT`, `BreachedPasswordOptions` |
| `@sdxc/password-policy/history`  | `checkPasswordHistory`, `DEFAULT_MAX_HISTORY`, `PasswordHistoryOptions`                                         |
| `@sdxc/password-policy/error`    | `PasswordPolicyError`                                                                                           |

Every entry point runs on Web Crypto and `fetch` alone except `./history`, which verifies scrypt hashes through `node:crypto` (Node, Bun, Deno, and Cloudflare Workers with `nodejs_compat`).

### `checkPassword(candidate: string, options?: CheckPasswordOptions): Promise<Result<void, PasswordPolicyError>>`

Applies the whole policy and resolves to the first refusal, or to success.

- `minLength` (`15`) and `maxLength` (`256`): bounds in code points, after NFKC.
- `common` (`true`): refuse a password on the bundled list.
- `identifiers` (`[]`): the account's emails and usernames.
- `deniedTerms` (`[]`): terms a password may not contain, such as the service's name.
- `breached` (`false`): `true` or a `BreachedPasswordOptions` enables the Pwned Passwords lookup.

### `checkLength(candidate: string, options?: LengthOptions): Result<void, PasswordPolicyError>`

Accepts a candidate whose NFKC form has between `minLength` and `maxLength` code points, inclusive, so an emoji counts once and `e` plus a combining accent counts as one `é`. Refuses with `too-short` or `too-long`.

### `checkCommonPassword(candidate: string): Result<void, PasswordPolicyError>`

Refuses a candidate on the bundled list with `common`.

### `isCommonPassword(candidate: string): boolean`

Whether the folded candidate is on the bundled list: the UK NCSC's 100,000 most frequent Pwned Passwords from [SecLists](https://github.com/danielmiessler/SecLists), keeping the roughly 46,500 entries of at least `COMMON_PASSWORDS_MIN_LENGTH` (8) code points. A shorter password is refused for length first.

### `checkIdentifiers(candidate: string, identifiers: string[]): Result<void, PasswordPolicyError>`

Refuses a candidate that contains, or is contained in, part of an identifier, with `similar-to-identifier` and the matching `fragment`. An email contributes its local part and first domain label (`jane.doe` and `example` from `jane.doe@example.com`), any other identifier itself; parts under three code points are skipped.

### `checkDeniedTerms(candidate: string, terms: string[]): Result<void, PasswordPolicyError>`

Refuses a candidate containing any term, trimmed and folded, with `denied-term` and the `term` as you configured it. Blank terms are skipped.

### `checkBreachedPassword(candidate: string, options?: BreachedPasswordOptions): Promise<Result<void, PasswordPolicyError>>`

Looks the password up in the [Pwned Passwords range API](https://haveibeenpwned.com/API/v3#PwnedPasswords): it sends the first five hex characters of the SHA-1 of the NFC form, with response padding on, and compares the rest locally. Refuses with `breached` and the `occurrences`, or with `breach-check-unavailable` when no answer arrived (`failure` is `"network"`, `"timeout"` or `"status"` with the HTTP `status`).

- `userAgent` (`"@sdxc/password-policy"`): identifies your app to the API.
- `timeout` (`DEFAULT_BREACH_CHECK_TIMEOUT`, 3000 ms): when the lookup reports `timeout`.

### `checkPasswordHistory(candidate: string, previousHashes: string[], options?: PasswordHistoryOptions): Promise<Result<void, PasswordPolicyError>>`

Refuses a candidate that verifies against one of the account's previous `@sdxc/crypto` hashes, passed newest first, with `reused` and its `index` (`0` is the newest). Pass the candidate exactly as submitted. `maxHistory` (`DEFAULT_MAX_HISTORY`, 5) caps how many hashes are verified, at about 100 ms of CPU each. A hash that fails to verify, with no match elsewhere, answers `history-check-unavailable` with its `index` and the verifier's failure as `cause`.

### `PasswordPolicyError`

An `Error` whose `issue` is a discriminated union over `reason`; `message` is English for logs, so build user-facing copy from `issue`.

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

### Constants

- `DEFAULT_MIN_LENGTH`: `15`, NIST's minimum for a password that is the only authenticator.
- `DEFAULT_MAX_LENGTH`: `256`, room for any passphrase while bounding the hash work one submission causes.
- `DEFAULT_BREACH_CHECK_TIMEOUT`: `3000` ms.
- `DEFAULT_MAX_HISTORY`: `5`.
- `PWNED_PASSWORDS_RANGE_URL`: `https://api.pwnedpasswords.com/range/`.
- `COMMON_PASSWORDS_MIN_LENGTH`: `8`, the shortest entry on the bundled list.
- `COMMON_PASSWORDS_NOTICE`: the SecLists MIT notice (Copyright (c) 2018 Daniel Miessler) that ships with the list.

### Types

- `CheckPasswordOptions`: the options of `checkPassword`, extending `LengthOptions`.
- `LengthOptions`: `{ minLength?, maxLength? }`.
- `BreachedPasswordOptions`: `{ userAgent?, timeout? }`.
- `PasswordHistoryOptions`: `{ maxHistory? }`.
- `PasswordPolicyError.Issue`, the union above; `PasswordPolicyError.Reason`, its `reason` values; and one name per member: `TooShort`, `TooLong`, `Common`, `SimilarToIdentifier`, `DeniedTerm`, `Breached`, `BreachCheckUnavailable`, `Reused`, `HistoryCheckUnavailable`.

## Pattern: Mapping A Refusal To A Message

The `issue` carries every value a message interpolates, and the union is exhaustive, so the `switch` closes.

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

## Pattern: Failing Open When The Lookup Is Down

The breached lookup runs after every local rule has accepted the password, so `breach-check-unavailable` means the password is otherwise acceptable. Decide once whether that accepts it.

```typescript
import { checkPassword } from "@sdxc/password-policy";
import { isSuccess } from "@sdxc/result";

async function isAcceptable(candidate: string, email: string): Promise<boolean> {
	let result = await checkPassword(candidate, { identifiers: [email], breached: true });
	if (isSuccess(result)) return true;
	return result.error.issue.reason === "breach-check-unavailable";
}
```

To fail closed, return `isSuccess(result)` and show the "try again" message for that reason.

## Pattern: Sign-Up That Hashes What Was Submitted

The rules normalize only to compare. Hash the password exactly as submitted, so a later sign-in with the same keystrokes verifies.

```typescript
import { password } from "@sdxc/crypto";
import { checkPassword } from "@sdxc/password-policy";
import { isFailure } from "@sdxc/result";

async function choosePassword(submitted: string, email: string, username: string) {
	let accepted = await checkPassword(submitted, {
		identifiers: [email, username],
		deniedTerms: ["Example"],
		breached: { userAgent: "example-accounts" },
	});
	if (isFailure(accepted)) return accepted;

	return password.hash(submitted);
}
```

## Pattern: Refusing A Reused Password On Change

Run the stateless policy first, then the history against the stored hashes, newest first; only a password that passes both is hashed and saved.

```typescript
import { password } from "@sdxc/crypto";
import { checkPassword } from "@sdxc/password-policy";
import { checkPasswordHistory } from "@sdxc/password-policy/history";
import { isFailure } from "@sdxc/result";

async function changePassword(submitted: string, email: string, storedHashes: string[]) {
	let policy = await checkPassword(submitted, { identifiers: [email] });
	if (isFailure(policy)) return policy;

	let history = await checkPasswordHistory(submitted, storedHashes, { maxHistory: 3 });
	if (isFailure(history)) return history;

	return password.hash(submitted);
}
```

## Pattern: A Small Policy Without The Bundled List

Composing rules from the small entry points keeps the common-password list out of a bundle; the breached lookup covers common passwords too, since they are the ones breaches hold most.

```typescript
import { checkBreachedPassword } from "@sdxc/password-policy/breached";
import { checkDeniedTerms, checkIdentifiers } from "@sdxc/password-policy/context";
import { checkLength } from "@sdxc/password-policy/length";
import { isFailure } from "@sdxc/result";

async function checkLean(candidate: string, email: string) {
	for (let result of [
		checkLength(candidate),
		checkIdentifiers(candidate, [email]),
		checkDeniedTerms(candidate, ["Example"]),
	]) {
		if (isFailure(result)) return result;
	}

	return checkBreachedPassword(candidate, { userAgent: "example-accounts" });
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
