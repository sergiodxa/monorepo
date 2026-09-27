/**
 * Public entry point: the combined `checkPassword` policy and every individual rule.
 * Importing it bundles the common-password list; the `./length`, `./context` and
 * `./breached` entry points leave it out. The history check lives only at `./history`, since
 * its scrypt verification needs `node:crypto`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { BreachedPasswordOptions } from "./breached.js";
export type { CheckPasswordOptions } from "./check-password.js";
export type { LengthOptions } from "./length.js";

export {
	checkBreachedPassword,
	DEFAULT_BREACH_CHECK_TIMEOUT,
	PWNED_PASSWORDS_RANGE_URL,
} from "./breached.js";
export { checkPassword } from "./check-password.js";
export {
	checkCommonPassword,
	COMMON_PASSWORDS_MIN_LENGTH,
	COMMON_PASSWORDS_NOTICE,
	isCommonPassword,
} from "./common.js";
export { checkDeniedTerms, checkIdentifiers } from "./context.js";
export { checkLength, DEFAULT_MAX_LENGTH, DEFAULT_MIN_LENGTH } from "./length.js";
export { PasswordPolicyError } from "./password-policy-error.js";
