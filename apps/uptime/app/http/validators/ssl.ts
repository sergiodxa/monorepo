/**
 * Form validation schema for the `update-ssl` action. SSL monitoring relies on a
 * manually entered expiry date (Workers cannot read TLS certificate details from
 * `fetch()`), so this only validates that data — not a certificate itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

/** Validates the `update-ssl` action form body. */
export const UpdateSslSchema = f.object({
	monitor_id: f.field(s.string()),
	ssl_monitoring_enabled: f.field(s.defaulted(coerce.boolean(), false)),
	ssl_expiry_warning_days: f.field(
		s.defaulted(coerce.number().pipe(checks.min(1), checks.max(365)), 30),
	),
	ssl_expires_at: f.field(s.optional(s.string())),
	ssl_issuer: f.field(s.optional(s.string())),
});

export type UpdateSslValues = s.InferOutput<typeof UpdateSslSchema>;
