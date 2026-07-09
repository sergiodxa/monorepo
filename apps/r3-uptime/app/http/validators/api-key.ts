/**
 * Form validation schemas for the create/delete API-key actions. `scopes` reads
 * every checked scope checkbox; `expires_at` parses an optional `date` input into
 * epoch milliseconds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

import { apiKeyScopes } from "~/database/schema";

/** Parses a `date` input value into epoch milliseconds at end of day, or `null` when blank. */
const optionalExpiresAt = s.optional(s.string()).transform((value) => {
	if (!value) return null;
	let date = new Date(`${value}T23:59:59`);
	return Number.isFinite(date.getTime()) ? date.getTime() : null;
});

/** Validates the `create-api-key` action form body. */
export const CreateApiKeySchema = f
	.object({
		name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
		scopes: f.fields(s.array(s.enum_(apiKeyScopes))),
		expires_at: f.field(optionalExpiresAt),
	})
	.refine((value) => value.scopes.length > 0, "Select at least one scope.");

export type CreateApiKeyValues = s.InferOutput<typeof CreateApiKeySchema>;

/** Validates the `delete-api-key` action form body. */
export const DeleteApiKeySchema = f.object({ api_key_id: f.field(s.string()) });
