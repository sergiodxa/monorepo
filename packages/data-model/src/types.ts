/**
 * The types a model is described by: the shape inferred from `createModel`, the bound model
 * and its queries, the callbacks and the context they receive. Every one is an interface or a
 * mapped type over a few plain parameters, so a helper generic over a model still resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";
import type {
	AnyTable,
	Database,
	PrimaryKeyInput,
	Relation,
	RelationCardinality,
	RelationMapForTable,
	SingleTableColumn,
	SingleTableWhere,
	TableRow,
	TableRowWith,
	ValidationFailure,
	WhereInput,
	WriteResult,
} from "remix/data-table";
import type { ContextValue } from "remix/router";

import type { NotFound } from "./errors.js";
import type {
	CreateMeta,
	DecodedMeta,
	FieldItem,
	FieldMap,
	HasRequiredField,
	UpdateMeta,
} from "./fields.js";

/** A value, or a promise of one: what every callback may return. */
export type Awaitable<Value> = Value | Promise<Value>;

/** Flattens an intersection so editors show one object type. */
type Pretty<Value> = { [Key in keyof Value]: Value[Key] } & {};

/**
 * The query a scope receives: only the builder methods that keep a query's row, loaded
 * relations and phase fixed. `having`, `groupBy` and `distinct` mark the result as aggregating,
 * which is what keeps such a scope off a query passed to `from()`.
 *
 * @template Column The columns `where` and `orderBy` accept.
 * @template Aggregates Whether a method that only applies to a table query was called.
 */
export interface ScopeQuery<Column extends string = string, Aggregates extends boolean = false> {
	/** Type-only: whether this query used a method `from()` cannot apply. */
	readonly "~aggregates"?: Aggregates;
	/** Adds a predicate. */
	where(input: WhereInput<Column>): ScopeQuery<Column, Aggregates>;
	/** Appends a sort key. */
	orderBy(column: Column, direction?: "asc" | "desc"): ScopeQuery<Column, Aggregates>;
	/** Takes at most `value` rows. */
	limit(value: number): ScopeQuery<Column, Aggregates>;
	/** Skips `value` rows. */
	offset(value: number): ScopeQuery<Column, Aggregates>;
	/** Adds a predicate over grouped rows. */
	having(input: WhereInput<Column>): ScopeQuery<Column, true>;
	/** Groups rows by columns. */
	groupBy(...columns: Column[]): ScopeQuery<Column, true>;
	/** Removes duplicate rows. */
	distinct(value?: boolean): ScopeQuery<Column, true>;
}

/**
 * A named, reusable refinement of a model's queries.
 *
 * @template Column The columns of the model's table.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- each scope declares its own arguments
export type Scope<Column extends string = string> = (
	query: ScopeQuery<Column>,
	// oxlint-disable-next-line typescript/no-explicit-any -- each scope declares its own arguments
	...args: any[]
) => ScopeQuery<Column, boolean>;

/** A model's scopes, keyed by the method name they appear under. */
// oxlint-disable-next-line typescript/no-explicit-any -- the column union varies per table
export type ScopeMap = Record<string, Scope<any>>;

/** The arguments a scope takes after the query. */
type ScopeArguments<S> = S extends (query: never, ...args: infer Args) => unknown ? Args : never;

/**
 * A custom method: answers a promise or a model query, which is what lets a lazily loaded
 * model call it before its module has loaded.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- each method declares its own arguments
export type ModelMethod = (...args: any[]) => Promise<unknown> | { readonly "~modelQuery"?: true };

/**
 * The names of a model's methods that answer neither a promise nor a model query, which a
 * lazily loaded model could not produce before its module loads.
 */
type InvalidMethodNames<Methods> = {
	[Name in keyof Methods]: Methods[Name] extends ModelMethod ? never : Name & string;
}[keyof Methods];

/**
 * What `createModel` and `extend` answer in place of a definition when a custom method breaks
 * the rule, so registering or binding the model fails with the method named in the error.
 */
export interface InvalidModel<Reason extends string> {
	readonly "~error": Reason;
}

/** A definition, or the error naming the methods that answer a plain value. */
export type CheckedDefinition<S extends ModelShape, Methods> = [
	InvalidMethodNames<Methods>,
] extends [never]
	? ModelDefinition<S>
	: InvalidModel<`Custom methods must answer a promise or a model query: ${InvalidMethodNames<Methods>}`>;

/** Rows a relation map loads, keyed by relation name. */
type LoadedRelations<Relations> = Pretty<{
	[Name in keyof Relations]: Relations[Name] extends Relation<
		AnyTable,
		infer Target,
		infer Cardinality extends RelationCardinality,
		infer Loaded
	>
		? Cardinality extends "many"
			? Array<TableRowWith<Target, Loaded>>
			: TableRowWith<Target, Loaded> | null
		: never;
}>;

/**
 * Everything a model's types are computed from. `createModel` infers one; the bound model,
 * its queries, its rows and its write inputs are all read off it.
 */
export interface ModelShape {
	/** The data-table table the model reads and writes. */
	table: AnyTable;
	/** A row's columns, with constrained columns narrowed to their fixed value. */
	columns: Record<string, unknown>;
	/** A row as reads return it: the columns, plus `meta` when the model declares fields. */
	row: Record<string, unknown>;
	/** The primary key input: a value for one column, an object for a composite key. */
	key: unknown;
	/** What `create` takes. */
	create: Record<string, unknown>;
	/** What `update` takes. */
	update: Record<string, unknown>;
	scopes: ScopeMap;
	methods: object;
	/** The declared meta fields. */
	fields: FieldMap;
	/** The discriminator column a base model extends on, or `never`. */
	inheritance: string;
}

/** The scopes of a shape, callable as methods that answer `Self`. */
type ScopeCalls<S extends ModelShape, Loaded, Row> = {
	[Name in keyof S["scopes"]]: (
		...args: ScopeArguments<S["scopes"][Name]>
	) => ModelQueryOf<S, Loaded, Row>;
};

/** The meta keys a model declares. */
type MetaKey<S extends ModelShape> = keyof S["fields"] & string;

/** What `whereMeta` compares a key with: one value, or a list matching any of them. */
export type MetaFilterValue<F> = FieldItem<F> | readonly FieldItem<F>[];

/** A row whose `meta` holds only `Keys`, as `withMeta(keys)` loads it. */
type WithMetaKeys<Row, S extends ModelShape, Keys extends MetaKey<S>> = Pretty<
	Omit<Row, "meta"> & { meta: Pick<DecodedMeta<S["fields"]>, Keys> }
>;

/**
 * The methods of a query from a model, on top of its scopes. Builder methods answer a model
 * query again, so scopes and data-table's own methods chain in any order; terminal methods
 * decode the model's meta into the rows they return.
 *
 * @template S The model's shape.
 * @template Loaded Relations `with()` loaded.
 * @template Row The row reads return, narrowed by `select()` and `withMeta()`.
 */
export interface ModelQueryMethods<S extends ModelShape, Loaded, Row> {
	/** Type-only: marks this as a model query, which a custom method may return. */
	readonly "~modelQuery"?: true;
	/** Adds a predicate. */
	where(input: SingleTableWhere<S["table"]>): ModelQueryOf<S, Loaded, Row>;
	/** Adds a predicate over grouped rows. */
	having(input: SingleTableWhere<S["table"]>): ModelQueryOf<S, Loaded, Row>;
	/** Appends a sort key. */
	orderBy(
		column: SingleTableColumn<S["table"]>,
		direction?: "asc" | "desc",
	): ModelQueryOf<S, Loaded, Row>;
	/** Groups rows by columns. */
	groupBy(...columns: SingleTableColumn<S["table"]>[]): ModelQueryOf<S, Loaded, Row>;
	/** Takes at most `value` rows. */
	limit(value: number): ModelQueryOf<S, Loaded, Row>;
	/** Skips `value` rows. */
	offset(value: number): ModelQueryOf<S, Loaded, Row>;
	/** Removes duplicate rows. */
	distinct(value?: boolean): ModelQueryOf<S, Loaded, Row>;
	/** Eager-loads relations onto every row. */
	with<Relations extends RelationMapForTable<S["table"]>>(
		relations: Relations,
	): ModelQueryOf<S, Loaded & LoadedRelations<Relations>, Row>;
	/** Projects columns; a projected query loads no meta. */
	select<Columns extends keyof S["columns"] & string>(
		...columns: Columns[]
	): ModelQueryOf<S, Loaded, Pick<S["columns"], Columns>>;
	/** Loads only these meta keys, and narrows the row's `meta` to them; `[]` loads none. */
	withMeta<Keys extends MetaKey<S>>(
		keys: readonly Keys[],
	): ModelQueryOf<S, Loaded, WithMetaKeys<Row, S, Keys>>;
	/**
	 * Keeps the rows holding `value` under the meta key, for a list field any item; a list of
	 * values matches any of them.
	 */
	whereMeta<Key extends MetaKey<S>>(
		key: Key,
		value: MetaFilterValue<S["fields"][Key]>,
	): ModelQueryOf<S, Loaded, Row>;
	/** Runs the query. */
	all(): Promise<Array<Row & Loaded>>;
	/** Runs the query for its first row, or `null`. */
	first(): Promise<(Row & Loaded) | null>;
	/** Runs the query for the row with this primary key, or `null`. */
	find(key: S["key"]): Promise<(Row & Loaded) | null>;
	/** Counts the matching rows, ignoring any limit or offset. */
	count(): Promise<number>;
	/** Whether any row matches. */
	exists(): Promise<boolean>;
	/** Updates every matching row in one statement, running no model callbacks. */
	update(changes: Partial<S["columns"]>): Promise<WriteResult>;
	/** Deletes every matching row in one statement, running no model callbacks. */
	delete(): Promise<WriteResult>;
}

/**
 * A query from a model, with the model's scopes chainable on it.
 *
 * @template S The model's shape.
 * @template Loaded Relations `with()` loaded.
 * @template Row The row reads return.
 */
export type ModelQueryOf<S extends ModelShape, Loaded = {}, Row = S["row"]> = ModelQueryMethods<
	S,
	Loaded,
	Row
> &
	ScopeCalls<S, Loaded, Row>;

/**
 * The query methods `from()` relies on, which is what `@sdxc/pagination` pages and what a
 * search query provides.
 *
 * @template Row What `all()` resolves to.
 * @template Where What `where` accepts.
 * @template Column What `orderBy` accepts.
 */
export interface StructuralQuery<Row = unknown, Where = never, Column = never> {
	where(input: Where): unknown;
	orderBy(column: Column, direction: "asc" | "desc"): unknown;
	limit(value: number): unknown;
	offset(value: number): unknown;
	count(): Promise<number>;
	all(): Promise<Row[]>;
}

/** The scopes `from()` can apply: those built only from `where`, `orderBy`, `limit` and `offset`. */
type FromScopeCalls<S extends ModelShape, Row, Where, Column> = {
	[Name in keyof S["scopes"] as ReturnType<S["scopes"][Name]> extends ScopeQuery<string, false>
		? Name
		: never]: (...args: ScopeArguments<S["scopes"][Name]>) => FromQuery<S, Row, Where, Column>;
};

/**
 * Another package's query over a model's table, with the model's constraints applied and its
 * non-aggregating scopes chainable. Rows keep the type the given query produces.
 */
export type FromQuery<S extends ModelShape, Row, Where, Column> = FromQueryMethods<
	S,
	Row,
	Where,
	Column
> &
	FromScopeCalls<S, Row, Where, Column>;

/** The methods of a query passed to `from()`, each answering it wrapped again. */
export interface FromQueryMethods<S extends ModelShape, Row, Where, Column> {
	/** Type-only: marks this as a model query, which a custom method may return. */
	readonly "~modelQuery"?: true;
	where(input: Where): FromQuery<S, Row, Where, Column>;
	orderBy(column: Column, direction: "asc" | "desc"): FromQuery<S, Row, Where, Column>;
	limit(value: number): FromQuery<S, Row, Where, Column>;
	offset(value: number): FromQuery<S, Row, Where, Column>;
	count(): Promise<number>;
	all(): Promise<Row[]>;
}

/** How `upsert` decides a row already exists. */
export interface UpsertOptions<S extends ModelShape> {
	/**
	 * The unique columns the write conflicts on, read from the values to find the existing row.
	 *
	 * @default The table's primary key.
	 */
	conflictTarget?: Array<keyof S["columns"] & string>;
}

/**
 * The built-in members of a bound model.
 *
 * @template S The model's shape.
 */
export interface BoundModelMethods<S extends ModelShape> {
	/**
	 * The database the model is bound to, or the transaction it runs in, for a custom method
	 * that runs a raw statement the query builder cannot express.
	 */
	readonly db: Database;
	/** A query over the model's rows, with its constraints applied and its scopes chainable. */
	query(): ModelQueryOf<S>;
	/** A query loading only these meta keys; `query().withMeta(keys)`. */
	withMeta<Keys extends MetaKey<S>>(
		keys: readonly Keys[],
	): ModelQueryOf<S, {}, WithMetaKeys<S["row"], S, Keys>>;
	/** A query keeping the rows holding `value` under the meta key; `query().whereMeta(...)`. */
	whereMeta<Key extends MetaKey<S>>(
		key: Key,
		value: MetaFilterValue<S["fields"][Key]>,
	): ModelQueryOf<S>;
	/** Wraps a query some other package built over the same table, so the model's scopes apply. */
	from<Row, Where, Column>(
		query: StructuralQuery<Row, Where, Column>,
	): FromQuery<S, Row, Where, Column>;
	/** The row with this primary key among the model's rows, or `null` for one its constraints exclude. */
	find(key: S["key"]): Promise<S["row"] | null>;
	/** The first row matching `where`, or `null`. */
	findBy(where: SingleTableWhere<S["table"]>): Promise<S["row"] | null>;
	/** Inserts a row, running the create callbacks. */
	create(values: S["create"]): Promise<Result<S["row"], ValidationError>>;
	/** Updates the row with this key, running the update callbacks. */
	update(key: S["key"], values: S["update"]): Promise<Result<S["row"], ValidationError | NotFound>>;
	/**
	 * Inserts a row or updates the one it conflicts with, in one statement; the callbacks are the
	 * create ones when no row existed and the update ones when one did.
	 */
	upsert(
		values: S["create"],
		options?: UpsertOptions<S>,
	): Promise<Result<S["row"], ValidationError>>;
	/** Deletes the row with this key, running the delete callbacks, and answers the deleted row. */
	delete(key: S["key"]): Promise<Result<S["row"], ValidationError | NotFound>>;
	/**
	 * Opens a unit of work: `afterCommit` events defer to its end, and flush only when `fn`
	 * resolves with something other than a `Failure`.
	 */
	transaction<Value>(fn: (models: AnyBoundModels) => Promise<Value>): Promise<Value>;
	/** A query over the model's rows with its constraints applied and its default scope left off. */
	unscoped(): ModelQueryOf<S>;
	/** The bound model once its module has loaded; an eager model answers itself. */
	load(): Promise<BoundModelView<S>>;
}

/** The bound model as its own custom methods see it: built-ins, scopes and custom methods. */
export type BoundModelView<S extends ModelShape> = BoundModelMethods<S> & {
	[Name in keyof S["scopes"]]: (...args: ScopeArguments<S["scopes"][Name]>) => ModelQueryOf<S>;
} & S["methods"];

/**
 * The bound model of a shape, carrying the definition it was bound from, which is what
 * `BoundModel<M>` infers `M` from at a helper's call site.
 */
export type BoundModelOf<S extends ModelShape> = BoundModelView<S> & {
	/** Type-only: the definition this model was bound from. */
	readonly "~model"?: ModelDefinition<S>;
};

/** Type-only members a definition carries for the helper types to read. */
export interface ModelTypes<S extends ModelShape> {
	shape: S;
	bound: BoundModelOf<S>;
	row: S["row"];
	create: S["create"];
	update: S["update"];
	query: ModelQueryOf<S>;
}

/**
 * What every model definition has, which is what `AnyModel` constrains to and a bound model
 * points back at: its name, its table, its types and `bind`.
 *
 * @template S The shape `createModel` inferred.
 */
export interface ModelBase<S extends ModelShape> {
	/** The table name, followed by the discriminator value for a sub-model (`posts.article`). */
	readonly name: string;
	readonly table: S["table"];
	/** Type-only: read through `BoundModel`, `ModelRow` and the other helper types. */
	readonly "~types": ModelTypes<S>;
	/**
	 * Binds the model to a database and a host context, for a script, a seed or a test.
	 *
	 * @param context The model context's members besides `get` and `models`.
	 * @param host What `get` reads through to, such as a `RequestContext`.
	 * @param options Whether the database has real transactions.
	 */
	bind(context: ModelContextInit, host?: ContextHost, options?: BindOptions): BoundModelOf<S>;
}

/**
 * A model definition: a table plus scopes, methods, callbacks and meta fields, unbound until
 * `bind` supplies the database and the host context.
 *
 * @template S The shape `createModel` inferred.
 */
export interface ModelDefinition<S extends ModelShape> extends ModelBase<S> {
	/**
	 * A sub-model pinned to one value of the discriminator column, with every scope, method and
	 * callback of this model; its own callbacks run after this model's.
	 *
	 * @param value The discriminator value its rows hold.
	 * @param options The sub-model's own scopes, methods, callbacks and meta fields.
	 */
	extend<
		const Value extends DiscriminatorValue<S>,
		Methods extends object,
		Scopes extends ScopeMap = {},
		Fields extends FieldMap = {},
		Optional extends keyof TableRow<S["table"]> & string = never,
	>(
		value: Value,
		options: ExtendOptions<
			SubShape<S, Value, Scopes, Methods, Fields, Optional>,
			Scopes,
			Methods,
			Fields,
			Optional
		> &
			NoScopeRedeclaration<S>,
	): CheckedDefinition<SubShape<S, Value, Scopes, Methods, Fields, Optional>, Methods>;
}

/**
 * Refuses a sub-model scope named like one of the base's, so a name means the same query on
 * every model sharing it.
 */
interface NoScopeRedeclaration<S extends ModelShape> {
	scopes?: { [Name in keyof S["scopes"]]?: never };
}

/** The values a base model's discriminator column takes. */
type DiscriminatorValue<S extends ModelShape> = [S["inheritance"]] extends [never]
	? never
	: Extract<TableRow<S["table"]>[S["inheritance"]], string | number>;

/** The shape of a sub-model: the base's, constrained on its discriminator and extended. */
type SubShape<
	S extends ModelShape,
	Value,
	Scopes extends ScopeMap,
	Methods extends object,
	Fields extends FieldMap,
	Optional extends string,
> = Omit<
	Shape<
		S["table"],
		Pretty<ConstraintsOf<S> & { [Column in S["inheritance"]]: Value }>,
		Pretty<S["scopes"] & Scopes>,
		Pretty<S["methods"] & Methods>,
		Pretty<S["fields"] & Fields>,
		OptionalOf<S> | Optional,
		never
	>,
	"key"
> & { key: S["key"] };

/** The constraints a shape was built with, read back off its narrowed columns. */
type ConstraintsOf<S extends ModelShape> = S extends { constraints: infer C } ? C : {};

/** The optional columns a shape was built with. */
type OptionalOf<S extends ModelShape> = S extends { optional: infer O extends string } ? O : never;

/** Any model definition whose rows have `RowShape`; any model at all when omitted. */
export type AnyModel<RowShape extends object = {}> = ModelBase<AnyShape<RowShape>>;

/** The shape `AnyModel` constrains to: rows with `RowShape`, everything else open. */
interface AnyShape<RowShape extends object> extends ModelShape {
	// oxlint-disable-next-line typescript/no-explicit-any -- any table satisfies the constraint
	columns: any;
	row: RowShape & Record<string, unknown>;
	// oxlint-disable-next-line typescript/no-explicit-any -- any key satisfies the constraint
	key: any;
	// oxlint-disable-next-line typescript/no-explicit-any -- any input satisfies the constraint
	create: any;
	// oxlint-disable-next-line typescript/no-explicit-any -- any input satisfies the constraint
	update: any;
	/** No scopes are assumed, so a helper over any model reaches only the built-ins. */
	scopes: {};
	methods: {};
	// oxlint-disable-next-line typescript/no-explicit-any -- any fields satisfy the constraint
	fields: any;
	// oxlint-disable-next-line typescript/no-explicit-any -- any discriminator satisfies the constraint
	inheritance: any;
}

/** The bound model of a definition: built-ins, scopes and custom methods. */
export type BoundModel<M extends AnyModel> = M["~types"]["bound"] & { readonly "~model"?: M };

/** A query from a model, with its scopes chainable. */
export type ModelQuery<M extends AnyModel> = M["~types"]["query"];

/** A row as a model's reads return it, constraints narrowed and `meta` decoded. */
export type ModelRow<M extends AnyModel> = M["~types"]["row"];

/** What a model's `create()` takes: constrained columns omitted, `meta` included. */
export type CreateValues<M extends AnyModel> = M["~types"]["create"];

/** What a model's `update()` takes, every member optional. */
export type UpdateValues<M extends AnyModel> = M["~types"]["update"];

/** Keys of `Row` whose value may be `null`. */
type NullableKeys<Row> = {
	[Key in keyof Row]-?: null extends Row[Key] ? Key : never;
}[keyof Row];

/** The timestamp columns data-table fills by default. */
type TimestampColumns = "created_at" | "updated_at";

/** Columns a `create` must supply: neither constrained, nullable, timestamped nor listed optional. */
type RequiredCreateKeys<Row, Constraints, Optional> = Exclude<
	keyof Row,
	keyof Constraints | Optional | NullableKeys<Row> | TimestampColumns
>;

/** The columns half of a `create` input. */
type CreateColumns<Row, Constraints, Optional> = {
	[Key in RequiredCreateKeys<Row, Constraints, Optional>]: Row[Key];
} & {
	[Key in Exclude<
		keyof Row,
		keyof Constraints | RequiredCreateKeys<Row, Constraints, Optional>
	>]?: Row[Key];
};

/** The `meta` half of a `create` input, required when any field is. */
type CreateMetaInput<Fields extends FieldMap> = keyof Fields extends never
	? {}
	: HasRequiredField<Fields> extends true
		? { meta: Pretty<CreateMeta<Fields>> }
		: { meta?: Pretty<CreateMeta<Fields>> };

/** The `meta` half of an `update` input. */
type UpdateMetaInput<Fields extends FieldMap> = keyof Fields extends never
	? {}
	: { meta?: Pretty<UpdateMeta<Fields>> };

/** Columns narrowed to the values a model's constraints pin them to. */
type Narrow<Row, Constraints> = Pretty<{
	[Key in keyof Row]: Key extends keyof Constraints ? Constraints[Key] : Row[Key];
}>;

/** A row with its decoded `meta`, when the model declares fields. */
type RowWithMeta<Columns, Fields extends FieldMap> = keyof Fields extends never
	? Columns
	: Pretty<Columns & { meta: Pretty<DecodedMeta<Fields>> }>;

/**
 * The shape `createModel` builds from its inferred options.
 *
 * @template T The table.
 * @template Constraints Columns pinned to fixed values.
 * @template Scopes The model's scopes.
 * @template Methods The model's custom methods.
 * @template Fields The declared meta fields.
 * @template Optional Columns `create` may leave out because a callback or the database fills them.
 * @template Inheritance The discriminator column, or `never`.
 */
export type Shape<
	T extends AnyTable,
	Constraints,
	Scopes extends ScopeMap,
	Methods extends object,
	Fields extends FieldMap,
	Optional extends string,
	Inheritance extends string,
> = {
	table: T;
	constraints: Constraints;
	optional: Optional;
	columns: Narrow<TableRow<T>, Constraints>;
	row: RowWithMeta<Narrow<TableRow<T>, Constraints>, Fields>;
	key: PrimaryKeyInput<T>;
	create: Pretty<CreateColumns<TableRow<T>, Constraints, Optional> & CreateMetaInput<Fields>>;
	update: Pretty<
		{
			[Key in Exclude<keyof TableRow<T>, keyof Constraints>]?: TableRow<T>[Key];
		} & UpdateMetaInput<Fields>
	>;
	scopes: Scopes;
	methods: Methods;
	fields: Fields;
	inheritance: Inheritance;
};

/** What a `validate` callback receives: the columns written so far and any `meta`. */
export type ValidateValues<S extends ModelShape> = Partial<S["columns"]> & {
	meta?: Partial<Record<keyof S["fields"], unknown>>;
};

/** A row was created. */
export interface CreateEvent<Row> {
	operation: "create";
	row: Row;
	before: null;
	/** Every column written and every meta key set, as `meta.<key>`. */
	changed: string[];
}

/** A row was updated. */
export interface UpdateEvent<Row> {
	operation: "update";
	row: Row;
	before: Row;
	/** The columns the update actually altered, and changed meta keys as `meta.<key>`. */
	changed: string[];
}

/** A row was deleted. */
export interface DeleteEvent<Row> {
	operation: "delete";
	/** The deleted row, as it read just before the statement. */
	row: Row;
	before: Row;
	changed: string[];
}

/** What `afterCommit` receives about one write. */
export type ModelEvent<Row> = CreateEvent<Row> | UpdateEvent<Row> | DeleteEvent<Row>;

/** What a callback may fail with: data-table's `fail()` result. */
export type CallbackFailure = ValidationFailure;

/**
 * Async hooks around a model's writes. Each `before*` and `validate` may fail with
 * `fail(...)` from `remix/data-table`; `afterCommit` runs once the enclosing unit of work
 * resolves with a success, or right after the write outside one.
 *
 * @template S The model's shape.
 */
export interface Callbacks<S extends ModelShape> {
	/** Runs first on every create, update and upsert; an update sees the key merged in. */
	validate?(values: ValidateValues<S>, ctx: ModelContext): Awaitable<void | CallbackFailure>;
	/** Rewrites the values a create writes. */
	beforeCreate?(
		values: S["create"],
		ctx: ModelContext,
	): Awaitable<S["create"] | void | CallbackFailure>;
	/** Rewrites the changes an update writes. */
	beforeUpdate?(
		values: S["update"],
		ctx: ModelContext,
		before: S["row"],
	): Awaitable<S["update"] | void | CallbackFailure>;
	/** Refuses a delete by failing. */
	beforeDelete?(row: S["row"], ctx: ModelContext): Awaitable<void | CallbackFailure>;
	/** Runs after the insert, with the created row. */
	afterCreate?(row: S["row"], ctx: ModelContext): Awaitable<void | CallbackFailure>;
	/** Runs after the update, with the row after and before it. */
	afterUpdate?(
		row: S["row"],
		ctx: ModelContext,
		before: S["row"],
	): Awaitable<void | CallbackFailure>;
	/** Runs after the delete, with the deleted row. */
	afterDelete?(row: S["row"], ctx: ModelContext): Awaitable<void | CallbackFailure>;
	/** Dispatches side effects once the write is committed: jobs, mail, webhooks. */
	afterCommit?(event: ModelEvent<S["row"]>, ctx: ModelContext): Awaitable<void>;
}

/** Where a model's meta rows live. */
export interface MetaTableOptions {
	/** The key/value companion table. */
	table: AnyTable;
	/** The column pointing at the owner row's primary key. */
	foreignKey: string;
	/**
	 * The column holding the meta key.
	 *
	 * @default "key"
	 */
	key?: string;
	/**
	 * The column holding the meta value, as text.
	 *
	 * @default "value"
	 */
	value?: string;
	/**
	 * Which row wins when a key holds several, compared in order, last one winning.
	 *
	 * @default ["updated_at", "id"]
	 */
	latest?: readonly string[];
	/** Creates a meta row's primary key, for a table whose database supplies none. */
	generateId?: () => unknown;
}

/**
 * What `createModel` takes.
 *
 * @template S The shape the options build, which callbacks and methods are typed by.
 */
export interface ModelOptions<
	S extends ModelShape,
	Constraints,
	Scopes extends ScopeMap,
	Methods extends object,
	Fields extends FieldMap,
	Optional extends string,
	Inheritance extends string,
> {
	/** Columns pinned to fixed values: every query filters on them and every create writes them. */
	constraints?: Constraints;
	/** The discriminator column `extend()` pins sub-models on. */
	inheritance?: Inheritance;
	/** Columns `create` may leave out because a `beforeCreate` callback or the database fills them. */
	optional?: readonly Optional[];
	/**
	 * Named refinements, each receiving a query and answering it refined. The intersection is
	 * what gives each scope's `query` parameter its type while `Scopes` is inferred.
	 */
	scopes?: Scopes & Record<string, Scope<SingleTableColumn<S["table"]>>>;
	/**
	 * A scope every read applies: queries, scopes, `find`, and the row an update or delete
	 * targets. `unscoped()` reads without it, for the code that restores what it hides.
	 */
	defaultScope?: Scope<SingleTableColumn<S["table"]>>;
	/**
	 * Custom methods. `this` is the bound model, so a method composes its scopes, its queries
	 * and the other methods; each answers a promise or a model query.
	 */
	methods?: Methods & ThisType<BoundModelView<S>>;
	callbacks?: Callbacks<S>;
	/** The key/value companion table `meta` fields are stored in. */
	metaTable?: MetaTableOptions;
	/** Typed fields over the meta table. */
	meta?: Fields;
}

/**
 * What `extend` takes: a sub-model's own scopes, methods, callbacks, meta fields and optional
 * columns. The discriminator, constraints and meta table come from the base.
 */
export interface ExtendOptions<
	S extends ModelShape,
	Scopes extends ScopeMap,
	Methods extends object,
	Fields extends FieldMap,
	Optional extends string,
> {
	optional?: readonly Optional[];
	/** The sub-model's own scopes, none of them named like one of the base's. */
	scopes?: Scopes & Record<string, Scope<SingleTableColumn<S["table"]>>>;
	/** A default scope applied after the base's. */
	defaultScope?: Scope<SingleTableColumn<S["table"]>>;
	/** The sub-model's own methods, with `this` the bound sub-model. */
	methods?: Methods & ThisType<BoundModelView<S>>;
	callbacks?: Callbacks<S>;
	meta?: Fields;
}

/**
 * What a model's callbacks receive, extended the way a router's context is: an app augments
 * this interface with the properties its callbacks read, such as `jobs` or `log`, and every
 * binding then has to supply them. `models` is always present at runtime; augmenting it with
 * `BoundRegistry<typeof models>` types the other models a callback reaches.
 *
 * @example declare module "@sdxc/data-model" { interface ModelContext { jobs: JobEnqueuer } }
 */
export interface ModelContext {
	/** The database this model is bound to, or the transaction it runs in. */
	readonly db: Database;
	/** Reads a value the host context published, or `undefined` when nothing did. */
	get<Key extends object>(key: Key): ContextValue<Key> | undefined;
}

/** What binding supplies: every model-context member besides the ones the package provides. */
export type ModelContextInit = Omit<ModelContext, "get" | "models">;

/** What a model context reads through to: a `RequestContext`, a `JobContext`, or any `get`. */
export interface ContextHost {
	get<Key extends object>(key: Key): unknown;
}

/** How a binding treats `db.transaction()`. */
export interface BindOptions {
	/**
	 * `"database"` wraps a unit of work in `db.transaction()`, for an adapter with real
	 * transactions such as SQLite; `"none"` never asks for one, which is what D1 and Durable
	 * Object SQLite need.
	 *
	 * @default "none"
	 */
	transactions?: "database" | "none";
}

/** A registry entry: a model, or a function importing the module that default-exports one. */
export type RegistryEntry = AnyModel | (() => Promise<{ default: AnyModel }>);

/** A registry's entries, keyed by the name they are bound under. */
export type RegistryEntries = Record<string, RegistryEntry>;

/** The bound model a registry entry becomes. */
export type BoundEntry<Entry> = Entry extends AnyModel
	? BoundModel<Entry>
	: Entry extends () => Promise<{ default: infer M extends AnyModel }>
		? BoundModel<M>
		: never;

/** A registry bound to one database and host: every entry as a bound model, plus `transaction`. */
export type BoundModels<Entries extends RegistryEntries> = {
	readonly [Name in keyof Entries]: BoundEntry<Entries[Name]>;
} & {
	/**
	 * Opens a unit of work: every model `fn` receives is bound to its scope and shares one
	 * `afterCommit` queue, which flushes only when `fn` resolves with something other than a
	 * `Failure`.
	 */
	transaction<Value>(fn: (models: BoundModels<Entries>) => Promise<Value>): Promise<Value>;
};

/**
 * The bound type of a registry, for augmenting `ModelContext` and the router's context.
 *
 * @example declare module "@sdxc/data-model" { interface ModelContext { models: BoundRegistry<typeof models> } }
 */
export type BoundRegistry<Registry extends { readonly entries: RegistryEntries }> = BoundModels<
	Registry["entries"]
>;

/** A bound registry whatever its entries, as a unit of work hands it to a single model. */
export interface AnyBoundModels {
	// oxlint-disable-next-line typescript/no-explicit-any -- the app's registry is not known here
	readonly [name: string]: any;
	transaction<Value>(fn: (models: AnyBoundModels) => Promise<Value>): Promise<Value>;
}
