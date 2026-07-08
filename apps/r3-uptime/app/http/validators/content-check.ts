/**
 * Form validation schemas for the monitor content-check actions. `CreateContentCheckSchema`
 * rejects invalid regular expressions at creation time by compiling the pattern as part
 * of validation, per `docs/content-checks.md`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const CONTENT_CHECK_TYPES = ["contains", "not_contains", "regex"] as const;

/** Validates the `create-content-check` action form body. */
export const CreateContentCheckSchema = f
	.object({
		monitor_id: f.field(s.string()),
		type: f.field(s.enum_(CONTENT_CHECK_TYPES)),
		value: f.field(s.string().pipe(checks.minLength(1))),
		case_sensitive: f.field(s.defaulted(coerce.boolean(), false)),
	})
	.refine((value) => {
		if (value.type !== "regex") return true;
		try {
			new RegExp(value.value);
			return true;
		} catch {
			return false;
		}
	}, "Invalid regular expression");

export type CreateContentCheckValues = s.InferOutput<typeof CreateContentCheckSchema>;

/** Validates the `delete-content-check` action form body. */
export const DeleteContentCheckSchema = f.object({
	monitor_id: f.field(s.string()),
	content_check_id: f.field(s.string()),
});

export type DeleteContentCheckValues = s.InferOutput<typeof DeleteContentCheckSchema>;
