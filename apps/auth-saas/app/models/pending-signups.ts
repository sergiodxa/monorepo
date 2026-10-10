/**
 * Pending platform signups: the organization name a `/signup` submission claimed, held until
 * its email verifies. Keyed on the subject id the verification ticket names, so verifying
 * reads it back with `find` and spends it with `delete` exactly once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { pendingSignups } from "~/database/schema";

/**
 * Pending signups, stamped with their creation time.
 *
 * @example await models.pendingSignups.create({ subject_id, organization_name: "Acme, Inc." });
 */
export const PendingSignups = createModel(pendingSignups, {
	callbacks: {
		async beforeCreate(values) {
			return { ...values, created_at: values.created_at ?? Date.now() };
		},
	},
});

/** One pending signup row as the control plane stores it. */
export type PendingSignupRow = ModelRow<typeof PendingSignups>;

export default PendingSignups;
