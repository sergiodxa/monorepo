/**
 * The two choices a signed-in user makes about themselves rather than about a team: the
 * language the UI and their email are produced in, and which optional emails they turned off.
 * A user who never opened the settings page has no row, which reads as "every email".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { inList } from "remix/data-table";

import type { OptionalEmail, SelectUserPreferences, SupportedLanguage } from "~/database/schema";

import { userPreferences } from "~/database/schema";

export const UserPreferences = createModel(userPreferences, {
	optional: ["id"],

	methods: {
		/**
		 * The preferences of every listed subject, keyed by subject id, in one query, for a job
		 * that needs every member's settings at once. A subject with no row stays out of the
		 * map, which the caller reads as the defaults.
		 */
		async findBySubjectIds(subjectIds: string[]): Promise<Map<string, SelectUserPreferences>> {
			if (subjectIds.length === 0) return new Map();

			let rows = await this.query()
				.where(inList("subject_id", [...new Set(subjectIds)]))
				.all();

			return new Map(rows.map((row) => [row.subject_id, row]));
		},

		/** Sets (or clears, when `null`) a subject's preferred UI language, keeping their opt-outs. */
		setLanguage(subjectId: string, language: SupportedLanguage | null) {
			return this.upsert(
				{ subject_id: subjectId, preferred_language: language },
				{ conflictTarget: ["subject_id"] },
			);
		},

		/**
		 * Records which optional emails a subject has turned off, replacing whatever was stored.
		 * The settings form posts the whole list each time, so writing it whole is what lets an
		 * unchecked switch turn an email back on. An empty list means send everything.
		 */
		setUnsubscribedEmails(subjectId: string, unsubscribed: OptionalEmail[]) {
			return this.upsert(
				{ subject_id: subjectId, unsubscribed_emails: unsubscribed },
				{ conflictTarget: ["subject_id"] },
			);
		},

		/**
		 * Adds one email to what a subject has turned off, keeping every other choice. Repeating
		 * it is harmless, so a provider that retries a one-click unsubscribe changes nothing more.
		 */
		async unsubscribe(subjectId: string, email: OptionalEmail) {
			let existing = await this.findBy({ subject_id: subjectId });
			let unsubscribed = Array.isArray(existing?.unsubscribed_emails)
				? existing.unsubscribed_emails
				: [];
			if (existing !== null && unsubscribed.includes(email)) return success(existing);

			return await this.setUnsubscribedEmails(subjectId, [...unsubscribed, email]);
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A subject's preferences row, as reads return it. */
export type UserPreference = ModelRow<typeof UserPreferences>;

/**
 * Whether one optional email may be sent to the owner of these preferences. Defaults to yes
 * unless a stored list names the email, so a retired key left in a list mutes nothing live.
 *
 * @param preferences - The subject's row, or `null` when they have none.
 * @param email - The email being sent.
 */
export function wantsEmail(preferences: UserPreference | null, email: OptionalEmail): boolean {
	let unsubscribed = preferences?.unsubscribed_emails;
	if (!Array.isArray(unsubscribed)) return true;
	return !unsubscribed.includes(email);
}

export default UserPreferences;
