/**
 * The reader's one settings row: preferences, tier, schedule and notification channels. The
 * row is provisioned on first use by whichever entry point reaches the object first, so no
 * caller depends on a sign-in having happened before it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";

import type { SelectSettings } from "~/database/schema";

import { settings } from "~/database/schema";

/** The key of the one row `settings` holds, which the `CHECK` on its primary key enforces. */
export const SETTINGS_ID = 1;

/** The columns a settings write may change; the key and the timestamps are the table's own. */
export interface SettingsChanges extends Partial<
	Omit<SelectSettings, "id" | "created_at" | "updated_at">
> {}

/** The settings row, read and written through `current`, `provision` and `write`. */
export const Settings = createModel(settings, {
	constraints: { id: SETTINGS_ID },
	optional: [
		"tier",
		"tier_source",
		"tier_checked_at",
		"notify_push",
		"notify_email",
		"time_zone",
		"quiet_hours",
		"quiet_from",
		"quiet_to",
		"theme",
		"reading_face",
	],

	methods: {
		/** The stored row, or `null` for an object no entry point has provisioned yet. */
		current() {
			return this.query().first();
		},

		/**
		 * The row, written on first use for `subject` when nothing has written it yet, so a
		 * reader whose object a follow created reads and writes settings like any other.
		 */
		async provision(subject: string): Promise<SelectSettings> {
			let stored = await this.current();
			if (stored !== null) return stored;

			return unwrap(await this.create({ subject, last_refreshed_at: null }));
		},

		/**
		 * Writes `changes` onto the row and answers it as stored. The row must exist, so a
		 * caller provisions it first; writing to a missing one is a programming error.
		 */
		async write(changes: SettingsChanges): Promise<SelectSettings> {
			return unwrap(await this.update({ id: SETTINGS_ID }, changes));
		},
	},
});

export default Settings;
