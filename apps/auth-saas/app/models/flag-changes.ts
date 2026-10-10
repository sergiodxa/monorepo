/**
 * Flag changes: the record every accepted release-flag or kill-switch write appends. The
 * definition set itself lives in Cloudflare KV; this trail is what an operator reads to learn
 * who changed a flag, when, and from what.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

import { flagChanges } from "~/database/schema";

/** Mints a `fchg_` TypeID for a new flag change row. */
const flagChangeId = typeid("fchg");

/**
 * Flag changes, appended by `create` with a minted id and the time of the write; `before` is
 * `null` for a key the set carried no definition for yet.
 *
 * @example await models.flagChanges.create({ key, before, after, actor });
 */
export const FlagChanges = createModel(flagChanges, {
	optional: ["id", "at"],

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? flagChangeId(generateUUID()).toString(),
				at: values.at ?? Date.now(),
			};
		},
	},
});

/** One flag change row as the control plane stores it. */
export type FlagChangeRow = ModelRow<typeof FlagChanges>;

export default FlagChanges;
