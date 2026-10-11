/**
 * Models over `remix/data-table` tables: bound per invocation to the right database, with
 * named scopes that chain on real data-table queries, custom methods, async callbacks that
 * reach the app's services, sub-models on a discriminator, and typed fields over a meta table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { ConstraintKind } from "./errors.js";
export type {
	AnyField,
	CreateMeta,
	DecodedMeta,
	EncodeResult,
	Field,
	FieldItem,
	FieldMap,
	FieldValue,
	UpdateMeta,
} from "./fields.js";
export type { CreateModel } from "./model.js";
export type { ModelRegistry } from "./registry.js";
export type {
	AnyBoundModels,
	AnyModel,
	Awaitable,
	BindOptions,
	BoundEntry,
	BoundModel,
	BoundModelMethods,
	BoundModelOf,
	BoundModelView,
	BoundModels,
	BoundRegistry,
	BulkUpdateOptions,
	CallbackFailure,
	Callbacks,
	CheckedDefinition,
	ContextHost,
	CreateEvent,
	CreateValues,
	DeleteEvent,
	EntriesOf,
	ExtendOptions,
	FromQuery,
	FromQueryMethods,
	InvalidModel,
	MetaFilterValue,
	MetaTableOptions,
	ModelContext,
	ModelBase,
	ModelContextInit,
	ModelDefinition,
	ModelEvent,
	ModelKey,
	ModelMethod,
	ModelOptions,
	ModelQuery,
	ModelQueryMethods,
	ModelQueryOf,
	ModelRow,
	ModelShape,
	ModelTypes,
	RegistryEntries,
	RegistryContextInit,
	RegistryEntry,
	ReservedName,
	Scope,
	ScopeMap,
	ScopeQuery,
	Shape,
	StructuralQuery,
	UpdateEvent,
	UpdateValues,
	UpsertOptions,
	UpsertValues,
	ValidateValues,
} from "./types.js";

export { Models } from "./context.js";
export { ConstraintViolation, NotFound } from "./errors.js";
export { field } from "./fields.js";
export { createModel, withContext } from "./model.js";
export { createModels } from "./registry.js";
