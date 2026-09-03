/**
 * Model for tenant branding configuration.
 *
 * Stores the single-row branding record (logo, colors, custom CSS) for the
 * tenant's authentication UI, applying defaults on read and sanitizing custom CSS
 * on write to prevent injection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { sanitizeCss } from "../../shared/lib/css-sanitizer.js";

/**
 * Single row keyed by `id: "default"`. Reads substitute default colors when
 * unset, and writes sanitize custom CSS before it reaches storage.
 */
export default class Brand {
	static DEFAULTS = {
		primaryColor: "#3B82F6",
		backgroundColor: "#FFFFFF",
	};

	static table = table({
		name: "branding",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text().default("default"),
			logo_url: c.text().nullable(),
			primary_color: c.text().nullable(),
			background_color: c.text().nullable(),
			custom_css: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Retrieves the current branding configuration.
	 * Returns default values if no branding has been configured.
	 * @param db - Database instance
	 * @returns Branding configuration with defaults applied
	 */
	static async show(db: Database) {
		let record = await db.findOne(Brand.table, { where: { id: "default" } });

		if (!record) {
			return {
				id: "default",
				logo_url: null,
				primary_color: Brand.DEFAULTS.primaryColor,
				background_color: Brand.DEFAULTS.backgroundColor,
				custom_css: null,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
		}

		return {
			...record,
			primary_color: record.primary_color ?? Brand.DEFAULTS.primaryColor,
			background_color: record.background_color ?? Brand.DEFAULTS.backgroundColor,
		};
	}

	/**
	 * Updates the branding configuration.
	 * Custom CSS is sanitized to prevent injection attacks.
	 * @param db - Database instance
	 * @param data - Branding properties to update
	 * @returns Updated branding record
	 */
	static async update(
		db: Database,
		data: {
			logoUrl?: string | null;
			primaryColor?: string | null;
			backgroundColor?: string | null;
			customCss?: string | null;
		},
	) {
		let existing = await db.findOne(Brand.table, { where: { id: "default" } });
		let now = new Date().toISOString();

		let sanitizedCss =
			data.customCss !== undefined ? sanitizeCss(data.customCss) : (existing?.custom_css ?? null);

		if (existing) {
			return await db.update(
				Brand.table,
				{ id: "default" },
				{
					logo_url: data.logoUrl !== undefined ? data.logoUrl : existing.logo_url,
					primary_color:
						data.primaryColor !== undefined ? data.primaryColor : existing.primary_color,
					background_color:
						data.backgroundColor !== undefined ? data.backgroundColor : existing.background_color,
					custom_css: sanitizedCss,
					updated_at: now,
				},
			);
		}

		return await db.create(Brand.table, {
			id: "default",
			logo_url: data.logoUrl ?? null,
			primary_color: data.primaryColor ?? null,
			background_color: data.backgroundColor ?? null,
			custom_css: sanitizedCss,
			created_at: now,
			updated_at: now,
		});
	}

	/**
	 * @returns Default primary and background colors
	 */
	static getDefaults() {
		return this.DEFAULTS;
	}
}
