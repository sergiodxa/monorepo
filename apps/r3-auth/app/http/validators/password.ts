/**
 * Schemas for the password-recovery endpoints: the address a reset is asked for, the
 * token a reset link carries, the new password posted back, and the shape of the record
 * a pending reset is stored as. Everything here arrives from an unauthenticated caller,
 * so validation here confirms shape only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

/**
 * Minimum password length, the same floor the sign-in and registration form applies.
 * A reset that accepted a weaker password than registration does would be the easiest
 * way to end up with an account weaker than the rules it was created under.
 */
const MINIMUM_PASSWORD_LENGTH = 8;

/**
 * Longest password accepted, so a submission cannot turn one PBKDF2 derivation into an
 * arbitrarily long one. The bound is far above any real passphrase.
 */
const MAXIMUM_PASSWORD_LENGTH = 256;

/**
 * Longest token accepted before anything hashes it. The tokens this server issues are a
 * fixed length; the bound exists so the validator rejects a megabyte of query string
 * before it reaches the hash step.
 */
const MAXIMUM_TOKEN_LENGTH = 128;

/**
 * The "forgot my password" form.
 *
 * Only the address is asked for and validated here for shape; whether it belongs to a
 * subject is checked afterward, so the endpoint's answer stays the same either way.
 */
export const ForgotPasswordSchema = s.object({
	email: s.string().pipe(checks.email()),
});

/** A validated reset request. */
export type ForgotPassword = s.InferOutput<typeof ForgotPasswordSchema>;

/** The `token` a reset link carries on the query string. */
export const ResetTokenQuerySchema = s.object({
	token: s.string().pipe(checks.minLength(1), checks.maxLength(MAXIMUM_TOKEN_LENGTH)),
});

/** A validated reset link. */
export type ResetTokenQuery = s.InferOutput<typeof ResetTokenQuerySchema>;

/**
 * The new-password form.
 *
 * The token stays out of the `POST` URL's `Referer` trail as a hidden field;
 * the controller matches the two password fields against each other.
 */
export const ResetPasswordSchema = s.object({
	token: s.string().pipe(checks.minLength(1), checks.maxLength(MAXIMUM_TOKEN_LENGTH)),
	password: s
		.string()
		.pipe(checks.minLength(MINIMUM_PASSWORD_LENGTH), checks.maxLength(MAXIMUM_PASSWORD_LENGTH)),
	passwordConfirmation: s.string().pipe(checks.minLength(1)),
});

/** A validated new-password submission. */
export type ResetPassword = s.InferOutput<typeof ResetPasswordSchema>;

/**
 * The record a pending reset is stored as.
 *
 * Read and validated fresh from the key-value store, so a shape-drifted record reads
 * as "no such token," keeping the reset scoped to a `subject_id` that actually parsed.
 */
export const PasswordResetRecordSchema = s.object({
	subject_id: s.string().pipe(checks.minLength(1)),
});

/** A validated pending-reset record. */
export type PasswordResetRecord = s.InferOutput<typeof PasswordResetRecordSchema>;
