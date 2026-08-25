/**
 * Field names the two public try-it forms submit under, and the schema the
 * lead-capture form validates. Defined here since the landing page, the try
 * page, and the handler all write these names, so a mismatch would submit
 * silently empty; only email needs a schema, since the checked URL arrives
 * pre-verified via the session's `guardTrialProbe`.
 *
 * The checkbox field defaults to `false` when the browser omits it, and
 * `consented_at` tracks that opt-in separately from supplying an email to
 * check one URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

/** Longest address accepted, matching the practical limit on an email address. */
const MAX_EMAIL_LENGTH = 320;

/** Form field the URL to check arrives in, on the landing page and on `/try` alike. */
export const TRIAL_URL_FIELD = "url";

/** Field name Cloudflare's Turnstile widget writes its token into, per its fixed contract. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/** Validates the `POST /try/lead` form body. */
export const TrialLeadSchema = f.object({
	email: f.field(
		s.string().pipe(checks.minLength(1), checks.maxLength(MAX_EMAIL_LENGTH), checks.email()),
	),
	consent: f.field(s.defaulted(coerce.boolean(), false)),
});

export type TrialLeadValues = s.InferOutput<typeof TrialLeadSchema>;
