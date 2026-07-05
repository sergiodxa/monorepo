/**
 * Typed error classes for common database failure modes (missing record, unique
 * constraint violation, foreign-key violation). Models throw these so controllers can
 * map them to appropriate HTTP responses instead of leaking raw D1 error strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, PrimaryKeyInput, TableColumnName } from "remix/data-table";

import { getTableName } from "remix/data-table";

/**
 * Thrown when a record cannot be located for a given primary key.
 *
 * @example
 * let tenant = await db.find(Tenant.table, id);
 * if (!tenant) throw new RecordNotFoundError(Tenant.table, id);
 */
export class RecordNotFoundError<table extends AnyTable> extends Error {
	override name = "RecordNotFoundError";

	/**
	 * @param table Table the record was expected to be found in.
	 * @param id Primary-key value that was looked up.
	 */
	constructor(
		public readonly table: table,
		public readonly id: PrimaryKeyInput<table>,
	) {
		super(`${getTableName(table)} record with id ${JSON.stringify(id)} not found`);
	}
}

/**
 * Thrown when a unique constraint would be violated by a write.
 *
 * @example
 * throw new DuplicateRecordError(Tenant.table, "slug", slug);
 */
export class DuplicateRecordError<table extends AnyTable> extends Error {
	override name = "DuplicateRecordError";

	/**
	 * @param table Table the conflicting record belongs to.
	 * @param column Column whose unique constraint was violated.
	 * @param value Value that already exists for the column.
	 */
	constructor(
		public readonly table: table,
		public readonly column: TableColumnName<table>,
		public readonly value: unknown,
	) {
		super(`${getTableName(table)} record with ${column} ${JSON.stringify(value)} already exists`);
	}
}

/**
 * Thrown when a foreign-key constraint fails for a write.
 *
 * @example
 * throw new ForeignKeyError(TenantMember.table, "tenant_id", tenantId);
 */
export class ForeignKeyError<table extends AnyTable> extends Error {
	override name = "ForeignKeyError";

	/**
	 * @param table Table the failing write targeted.
	 * @param column Column whose foreign-key constraint failed.
	 * @param value Value that failed the foreign-key constraint.
	 */
	constructor(
		public readonly table: table,
		public readonly column: TableColumnName<table>,
		public readonly value: unknown,
	) {
		super(
			`${getTableName(table)} foreign key constraint failed for ${column} with value ${JSON.stringify(value)}`,
		);
	}
}
