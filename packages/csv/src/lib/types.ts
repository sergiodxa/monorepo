/**
 * The types both halves of the package share, exported at the top level so a namespace
 * import reads `CSV.Cell` and `CSV.StringifyOptions` beside `CSV.parse` and `CSV.stringify`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A value the writer can put in a field. `null` and `undefined` write an empty field,
 * a `Date` writes ISO 8601 in UTC, and a number must be finite.
 */
export type Cell = string | number | bigint | boolean | Date | null | undefined;

/**
 * The field separators both halves accept: `,` per RFC 4180, `;` for spreadsheets in
 * decimal-comma locales, and tab for TSV.
 */
export type Delimiter = "," | ";" | "\t";

/**
 * An object whose every field is a cell. Mapped over the row's own keys, so rows typed by
 * an interface qualify without declaring an index signature.
 *
 * @template Row - The row type being constrained
 */
export type CellRecord<Row> = { [Key in keyof Row]: Cell };

/**
 * Settings for one read.
 */
export interface ParseOptions {
	/** @default "," */
	delimiter?: Delimiter;
	/**
	 * Reads the first record as the keys of every later one. Without it, each record
	 * comes back as an array of fields.
	 *
	 * @default true
	 */
	header?: boolean;
}

/**
 * A recoverable departure from RFC 4180 that the reader accepted, with the 1-based line
 * it was found on.
 */
export interface ParseWarning {
	line: number;
	message: string;
}

/**
 * The outcome of a successful read.
 *
 * @template T - The shape of one record
 */
export interface Parsed<T> {
	rows: T[];
	warnings: ParseWarning[];
}

/**
 * One column the writer emits, in the order the columns are listed.
 *
 * @template Row - The row type the key belongs to
 */
export interface Column<Row> {
	key: keyof Row & string;
	/** Text of the header field; the key when omitted. */
	header?: string;
}

/**
 * Settings shared by every write, whether the rows are objects or arrays.
 */
export interface WriteOptions {
	/** @default "," */
	delimiter?: Delimiter;
	/**
	 * Prefixes a UTF-8 BOM, which Excel needs to read the file as UTF-8. Programs reading
	 * the file may take the BOM as part of the first header, so it is for spreadsheets.
	 *
	 * @default false
	 */
	bom?: boolean;
	/**
	 * Prefixes `'` to string cells starting with `=`, `+`, `-`, `@`, tab or CR, which a
	 * spreadsheet would otherwise run as a formula when the file is opened.
	 *
	 * @default true
	 */
	escapeFormulas?: boolean;
}

/**
 * Settings for writing objects.
 *
 * @template Row - The row type being written
 */
export interface StringifyOptions<Row> extends WriteOptions {
	/**
	 * The columns to write and their header text. Without it, the first row's own keys
	 * are the columns, in insertion order.
	 */
	columns?: Column<Row>[];
	/** @default true */
	header?: boolean;
}
