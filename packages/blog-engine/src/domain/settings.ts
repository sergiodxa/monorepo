import type { Database } from "remix/data-table";

import type { ThemeSettings } from "../theme/theme";

import { settings } from "../database/schema";

/** Blog-owner settings stored as JSON-encoded values in the `settings` table. */
export class Settings {
	/** Table reference shared by all queries. */
	static table = settings;

	/** Reads a JSON-decoded setting value, or `fallback` when missing/invalid. */
	static async get<T>(db: Database, key: string, fallback: T): Promise<T> {
		let row = await db.findOne(this.table, { where: { key } });
		if (!row) return fallback;
		try {
			return JSON.parse(row.value) as T;
		} catch {
			return fallback;
		}
	}

	/** Upserts a JSON-encoded setting value. */
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

	/** Site title (defaults to "My Blog"). */
	static siteTitle(db: Database): Promise<string> {
		return this.get(db, "site_title", "My Blog");
	}

	/** Site description (defaults to ""). */
	static siteDescription(db: Database): Promise<string> {
		return this.get(db, "site_description", "");
	}

	/** Site language (defaults to "en"). */
	static language(db: Database): Promise<string> {
		return this.get(db, "language", "en");
	}

	/** Theme settings (defaults to `{}`, meaning engine defaults apply). */
	static theme(db: Database): Promise<Partial<ThemeSettings>> {
		return this.get<Partial<ThemeSettings>>(db, "theme", {});
	}

	/** Additional custom CSS (defaults to ""). */
	static customCss(db: Database): Promise<string> {
		return this.get(db, "custom_css", "");
	}
}
