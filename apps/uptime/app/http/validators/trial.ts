/**
 * The field names the two public try-it forms submit under, and the schema the second of
 * them is validated with.
 *
 * The names live here rather than beside either form because three pages write them — the
 * landing page's box, the try page's box, and the handler that reads them — and a name
 * spelled two ways is a submission that silently arrives empty. This module imports only
 * the schema library, which also keeps the landing page out of the prober's module graph.
 *
 * The email capture is the only one of the two with anything to validate. The address is
 * required and is the only field that can fail; the URL a watch gets created for never
 * travels through it — it comes out of the session, put there by the probe that already
 * passed `guardTrialProbe` — so there is nothing else here worth a schema.
 *
 * The marketing opt-in is an unticked checkbox, which a browser does not submit at all, so
 * its absence is the ordinary case and must parse to `false` — never to a validation
 * error, and never to a default of `true`. Handing over an address to hear about one URL
 * is not consent to be marketed to, and `consented_at` is the column that keeps the two
 * apart.
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

/** Field name Turnstile's widget writes its token into; fixed by Cloudflare, not by us. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/** Validates the `POST /try/lead` form body. */
export const TrialLeadSchema = f.object({
	email: f.field(
		s.string().pipe(checks.minLength(1), checks.maxLength(MAX_EMAIL_LENGTH), checks.email()),
	),
	consent: f.field(s.defaulted(coerce.boolean(), false)),
});

export type TrialLeadValues = s.InferOutput<typeof TrialLeadSchema>;
