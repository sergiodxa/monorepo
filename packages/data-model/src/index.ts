/**
 * Models over `remix/data-table` tables: bound per invocation to the right database, with
 * named scopes that chain on real data-table queries, custom methods, async callbacks that
 * reach the app's services, sub-models on a discriminator, and typed fields over a meta table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
	CallbackFailure,
	Callbacks,
	ContextHost,
	CreateEvent,
	CreateValues,
	DeleteEvent,
	ExtendOptions,
	FromQuery,
	FromQueryMethods,
	MetaFilterValue,
	MetaTableOptions,
	MethodMap,
	ModelContext,
	ModelBase,
	ModelContextInit,
	ModelDefinition,
	ModelEvent,
	ModelMethod,
	ModelOptions,
	ModelQuery,
	ModelQueryMethods,
	ModelQueryOf,
	ModelRow,
	ModelShape,
	ModelTypes,
	RegistryEntries,
	RegistryEntry,
	Scope,
	ScopeMap,
	ScopeQuery,
	Shape,
	StructuralQuery,
	UpdateEvent,
	UpdateValues,
	UpsertOptions,
	ValidateValues,
} from "./types.js";

export { Models } from "./context.js";
export { NotFound } from "./errors.js";
export { field } from "./fields.js";
export { createModel } from "./model.js";
export { createModels } from "./registry.js";
