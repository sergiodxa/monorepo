import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export default class Brand {
	static DEFAULTS = {
		primaryColor: "#3B82F6",
		backgroundColor: "#FFFFFF",
	};

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
					custom_css: data.customCss !== undefined ? data.customCss : existing.custom_css,
					updated_at: now,
				},
			);
		}

		return await db.create(Brand.table, {
			id: "default",
			logo_url: data.logoUrl ?? null,
			primary_color: data.primaryColor ?? null,
			background_color: data.backgroundColor ?? null,
			custom_css: data.customCss ?? null,
			created_at: now,
			updated_at: now,
		});
	}

	static getDefaults() {
		return this.DEFAULTS;
	}
}
