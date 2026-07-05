/**
 * Blog-owner settings store: the {@link Settings} class wrapping the `settings`
 * key/value table with JSON encoding, a generic get/set, and typed accessors for the
 * individual keys (title, description, language, theme, custom CSS).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import type { ThemeSettings } from "../../appearance/theme/theme";

import { settings } from "../../database/schema";

/** Blog-owner settings stored as JSON-encoded values in the `settings` table. */
export class Settings {
	/** Table reference shared by all queries. */
	static table = settings;

	/**
	 * Reads a JSON-decoded setting value, returning `fallback` when the key is missing
	 * or its stored value is malformed.
	 * @param db - Database handle.
	 * @param key - The setting key.
	 * @param fallback - Value to return when absent/invalid.
	 * @returns The decoded value, or `fallback`.
	 */
	static async get<T>(db: Database, key: string, fallback: T): Promise<T> {
		let row = await db.findOne(this.table, { where: { key } });
		if (!row) return fallback;
		try {
			return JSON.parse(row.value) as T;
		} catch {
			return fallback;
		}
	}

	/**
	 * Upserts a JSON-encoded setting value (inserts when new, updates otherwise).
	 * @param db - Database handle.
	 * @param key - The setting key.
	 * @param value - The value to JSON-encode and store.
	 */
	static async set<T>(db: Database, key: string, value: T): Promise<void> {
		let encoded = JSON.stringify(value);
		let now = new Date().toISOString();
		let existing = await db.findOne(this.table, { where: { key } });
		if (existing) {
			await db.update(this.table, { key }, { value: encoded, updated_at: now });
		} else {
			await db.create(this.table, { key, value: encoded, updated_at: now });
		}
	}

	/**
	 * Reads the site title.
	 * @param db - Database handle.
	 * @returns The site title (defaults to "My Blog").
	 */
	static siteTitle(db: Database): Promise<string> {
		return this.get(db, "site_title", "My Blog");
	}

	/**
	 * Reads the site description.
	 * @param db - Database handle.
	 * @returns The site description (defaults to "").
	 */
	static siteDescription(db: Database): Promise<string> {
		return this.get(db, "site_description", "");
	}

	/**
	 * Reads the site language.
	 * @param db - Database handle.
	 * @returns The language code (defaults to "en").
	 */
	static language(db: Database): Promise<string> {
		return this.get(db, "language", "en");
	}

	/**
	 * Reads the stored theme settings.
	 * @param db - Database handle.
	 * @returns The partial theme (defaults to `{}`, meaning engine defaults apply).
	 */
	static theme(db: Database): Promise<Partial<ThemeSettings>> {
		return this.get<Partial<ThemeSettings>>(db, "theme", {});
	}

	/**
	 * Reads the owner's additional custom CSS.
	 * @param db - Database handle.
	 * @returns The custom CSS (defaults to "").
	 */
	static customCss(db: Database): Promise<string> {
		return this.get(db, "custom_css", "");
	}
}
