/**
 * Data-access model for `user_preferences`. Holds the two choices a signed-in user makes
 * about themselves rather than about a team: the language the UI and their email are
 * produced in, read by `app/http/middleware/i18n.ts`, and which of the optional emails they
 * have turned off, read by the digest job.
 *
 * Both are stored on one row per subject, and neither has to exist: a user who has never
 * opened the settings page has no row, which reads as "the browser's language" and "every
 * email". That is why {@link UserPreferences.wants} takes an already-loaded, nullable row,
 * and why the writers below upsert.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { inList } from "remix/data-table";

import type { OptionalEmail, SelectUserPreferences, SupportedLanguage } from "~/database/schema";

import { userPreferences } from "~/database/schema";

export default class UserPreferences {
	/** Finds a subject's preferences row, or `null` when they've never set any. */
	static async findBySubjectId(db: Database, subjectId: string) {
		return await db.findOne(userPreferences, { where: { subject_id: subjectId } });
	}

	/**
	 * The preferences of every listed subject, keyed by subject id, in one query —
	 * for the digest job, which needs every member's settings without one query
	 * per mostly-empty recipient. An absent subject simply stays out of the map.
	 */
	static async findBySubjectIds(
		db: Database,
		subjectIds: string[],
	): Promise<Map<string, SelectUserPreferences>> {
		if (subjectIds.length === 0) return new Map();

		let rows = await db.findMany(userPreferences, {
			where: inList("subject_id", [...new Set(subjectIds)]),
		});

		return new Map(rows.map((row) => [row.subject_id, row]));
	}

	/** Sets (or clears, when `null`) a subject's preferred UI language. */
	static async setLanguage(db: Database, subjectId: string, language: SupportedLanguage | null) {
		return await UserPreferences.#upsert(db, subjectId, { preferred_language: language });
	}

	/**
	 * Records which optional emails a subject has turned off, replacing whatever
	 * was stored. The settings form posts the whole list each time, since an
	 * unchecked switch sends no value at all — writing it whole preserves every choice.
	 *
	 * @param unsubscribed - The emails to stop sending; an empty list means send everything.
	 */
	static async setUnsubscribedEmails(
		db: Database,
		subjectId: string,
		unsubscribed: OptionalEmail[],
	) {
		return await UserPreferences.#upsert(db, subjectId, { unsubscribed_emails: unsubscribed });
	}

	/**
	 * Whether one optional email may be sent to the owner of these preferences. Takes
	 * the full row since the caller already loaded it for the language. Defaults to
	 * yes unless a stored list names the email, keeping a retired key from muting a live digest.
	 *
	 * @param preferences - The subject's row, or `null` when they have none.
	 * @param email - The email being sent.
	 * @returns Whether to send it.
	 */
	static wants(preferences: SelectUserPreferences | null, email: OptionalEmail): boolean {
		let unsubscribed = preferences?.unsubscribed_emails;
		if (!Array.isArray(unsubscribed)) return true;
		return !unsubscribed.includes(email);
	}

	/** Creates or updates the one row a subject is allowed, touching only the given fields. */
	static async #upsert(
		db: Database,
		subjectId: string,
		values: Partial<Pick<SelectUserPreferences, "preferred_language" | "unsubscribed_emails">>,
	) {
		let existing = await db.findOne(userPreferences, { where: { subject_id: subjectId } });

		if (existing) {
			return await db.update(userPreferences, existing.id, values, { touch: true });
		}

		return await db.create(
			userPreferences,
			{ id: generateUUID(), subject_id: subjectId, ...values },
			{ touch: true, returnRow: true },
		);
	}
}
