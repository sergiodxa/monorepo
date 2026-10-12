/**
 * How a report's CSV is written for whoever opens it. The spreadsheet dialect follows the
 * reader's locale, because Excel in a decimal-comma locale splits on `;` and reads `99.5` as
 * text; the standard dialect is RFC 4180 with stable keys, for scripts and the API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cell, Delimiter } from "@sdxc/csv";

/** The dialects a download offers; the API always writes `standard`. */
export const REPORT_DIALECTS = ["spreadsheet", "standard"] as const;

export type ReportDialectName = (typeof REPORT_DIALECTS)[number];

/**
 * Everything that differs between the two dialects.
 */
export interface ReportDialect {
	name: ReportDialectName;
	delimiter: Delimiter;
	/** Excel needs the BOM to read UTF-8; programs may read it as part of the first header. */
	bom: boolean;
	decimalMark: "." | ",";
	/** Spreadsheet headers are translated; standard headers are the column keys. */
	translateHeaders: boolean;
}

/**
 * The dialect a download is written in. The spreadsheet one takes its decimal mark from the
 * locale and uses `;` wherever that mark is `,`, so a new locale needs no table entry.
 *
 * @param locale - The reader's locale, e.g. `ctx.locale`
 * @param name - The dialect the builder asked for
 * @returns The settings to write with
 */
export function reportDialect(locale: string, name: ReportDialectName): ReportDialect {
	if (name === "standard") {
		return { name, delimiter: ",", bom: false, decimalMark: ".", translateHeaders: false };
	}
	let decimalMark = decimalMarkFor(locale);
	return {
		name,
		delimiter: decimalMark === "," ? ";" : ",",
		bom: true,
		decimalMark,
		translateHeaders: true,
	};
}

/**
 * The decimal mark a locale writes, read from `Intl` so it matches what the reader's
 * spreadsheet expects.
 *
 * @param locale - A BCP 47 tag
 * @returns `","` for locales such as `es` and `de`, `"."` otherwise
 */
export function decimalMarkFor(locale: string): "." | "," {
	let parts = new Intl.NumberFormat(locale).formatToParts(1.5);
	return parts.find((part) => part.type === "decimal")?.value === "," ? "," : ".";
}

/**
 * A number as a cell in the dialect: a `number` in the standard dialect, and in the
 * spreadsheet one a string with the locale's decimal mark and no grouping, which the
 * spreadsheet reads back as a number. `null` is an empty field.
 *
 * @param value - The figure, unrounded
 * @param dialect - The dialect being written
 * @returns The cell to write
 */
export function numberCell(value: number | null, dialect: ReportDialect): Cell {
	if (value === null) return null;
	if (dialect.decimalMark === ".") return value;
	return String(value).replace(".", ",");
}
