import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { sanitizeCss } from "~/lib/css-sanitizer";

/**
 * Model for tenant branding configuration.
 * Manages logo, colors, and custom CSS for the authentication UI.
 */
export default class Brand {
	/** Default branding values. */
	static DEFAULTS = {
		primaryColor: "#3B82F6",
		backgroundColor: "#FFFFFF",
	};

	/** Database table schema for branding. */
	static table = createTable({
		name: "branding",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.defaulted(s.string(), "default"),
			logo_url: s.nullable(s.string()),
			primary_color: s.nullable(s.string()),
			background_color: s.nullable(s.string()),
			custom_css: s.nullable(s.string()),
			created_at: s.string(),
			updated_at: s.string(),
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
	 * Returns the default branding values.
	 * @returns Default primary and background colors
	 */
	static getDefaults() {
		return this.DEFAULTS;
	}
}
