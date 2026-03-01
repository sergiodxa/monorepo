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
			logoUrl: s.nullable(s.string()),
			primaryColor: s.nullable(s.string()),
			backgroundColor: s.nullable(s.string()),
			customCss: s.nullable(s.string()),
			createdAt: s.string(),
			updatedAt: s.string(),
		},
	});

	static async show(db: Database) {
		let record = await db.findOne(Brand.table, { where: { id: "default" } });

		if (!record) {
			return {
				id: "default",
				logoUrl: null,
				primaryColor: Brand.DEFAULTS.primaryColor,
				backgroundColor: Brand.DEFAULTS.backgroundColor,
				customCss: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
		}

		return {
			...record,
			primaryColor: record.primaryColor ?? Brand.DEFAULTS.primaryColor,
			backgroundColor: record.backgroundColor ?? Brand.DEFAULTS.backgroundColor,
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
					logoUrl: data.logoUrl !== undefined ? data.logoUrl : existing.logoUrl,
					primaryColor: data.primaryColor !== undefined ? data.primaryColor : existing.primaryColor,
					backgroundColor:
						data.backgroundColor !== undefined ? data.backgroundColor : existing.backgroundColor,
					customCss: data.customCss !== undefined ? data.customCss : existing.customCss,
					updatedAt: now,
				},
			);
		}

		return await db.create(Brand.table, {
			id: "default",
			logoUrl: data.logoUrl ?? null,
			primaryColor: data.primaryColor ?? null,
			backgroundColor: data.backgroundColor ?? null,
			customCss: data.customCss ?? null,
			createdAt: now,
			updatedAt: now,
		});
	}

	static getDefaults() {
		return this.DEFAULTS;
	}
}
