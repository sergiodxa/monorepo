/**
 * Data-access model for `user_preferences`. Currently holds a single editable field
 * — the signed-in user's preferred UI language, read by `app/http/middleware/i18n.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { SupportedLanguage } from "~/database/schema";

import { userPreferences } from "~/database/schema";

export default class UserPreferences {
	/** Finds a subject's preferences row, or `null` when they've never set any. */
	static async findBySubjectId(db: Database, subjectId: string) {
		return await db.findOne(userPreferences, { where: { subject_id: subjectId } });
	}

	/** Sets (or clears, when `null`) a subject's preferred UI language. */
	static async setLanguage(db: Database, subjectId: string, language: SupportedLanguage | null) {
		let existing = await db.findOne(userPreferences, { where: { subject_id: subjectId } });

		if (existing) {
			return await db.update(
				userPreferences,
				existing.id,
				{ preferred_language: language },
				{ touch: true },
			);
		}

		return await db.create(
			userPreferences,
			{ id: generateUUID(), subject_id: subjectId, preferred_language: language },
			{ touch: true, returnRow: true },
		);
	}
}
