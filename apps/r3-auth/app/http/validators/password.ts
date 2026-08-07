/**
 * Schemas for the password-recovery endpoints: the address a reset is asked for, the
 * token a reset link carries, the new password posted back, and the shape of the record
 * a pending reset is stored as. Everything here arrives from an unauthenticated caller,
 * so nothing is trusted beyond its shape.
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
 * fixed length; the bound exists so a megabyte of query string is refused by the
 * validator rather than digested.
 */
const MAXIMUM_TOKEN_LENGTH = 128;

/**
 * The "forgot my password" form.
 *
 * Only the address is asked for, and it is shaped rather than looked up here: whether it
 * belongs to a subject must not change what the endpoint answers, so that question is
 * asked after validation and never reported.
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
 * The token travels as a hidden field rather than on the query string of the `POST`, so
 * the request that spends it does not put it in a `Referer` or a server access log. The
 * two password fields are only shaped here; that they match is checked by the controller,
 * which owns the message a mismatch is reported with.
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
 * Validated on read rather than trusted: the value comes back from a key-value store both
 * this server and its own future versions write, and a record whose shape drifted must
 * read as "no such token" instead of resetting whatever `subject_id` happened to parse.
 */
export const PasswordResetRecordSchema = s.object({
	subject_id: s.string().pipe(checks.minLength(1)),
});

/** A validated pending-reset record. */
export type PasswordResetRecord = s.InferOutput<typeof PasswordResetRecordSchema>;
