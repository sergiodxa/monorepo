import type { ColumnSchemas, PrimaryKeyInput, Table } from "remix/data-table";

type ColumnNameFromColumns<columns extends ColumnSchemas> = keyof columns & string;

export class RecordNotFoundError<
	name extends string,
	columns extends ColumnSchemas,
	primaryKey extends readonly ColumnNameFromColumns<columns>[],
> extends Error {
	override name = "RecordNotFoundError";

	constructor(
		public readonly table: Table<name, columns, primaryKey>,
		public readonly id: PrimaryKeyInput<Table<name, columns, primaryKey>>,
	) {
		super(`${table.name} record with id ${JSON.stringify(id)} not found`);
	}
}
