import type { AnyTable, TableRow } from "remix/data-table";

export type InsertRow<table extends AnyTable> = Partial<TableRow<table>>;
