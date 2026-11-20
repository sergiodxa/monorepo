/**
 * Story extensions: a game's own slice of saved state, the directives scenes reach it through
 * as `ctx.<name>`, and listeners that ride along. Scenes record extension calls as data, and the
 * novel resolves them into plain directives when it loads the scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, isFailure, success } from "@sdxc/result";

import type {
	Directive,
	ExtensionDirective,
	RememberDirective,
	SceneDirectives,
	SceneModule,
	SetDirective,
} from "./directives.js";
import type { NovelEventName, NovelListener } from "./events.js";
import type { Persistent } from "./persistent.js";
import type { DeclaredState, NovelTypes, PlayTools, SchemaInput, StateRecord } from "./types.js";

import { validate } from "./state.js";

/** The directive builders an extension declares: each answers one directive or a list of them. */
export interface ExtensionMethods {
	readonly [method: string]: (...args: never[]) => Directive | Directive[];
}

/** The listeners an extension registers on the novel it is passed to, one per event at most. */
export type ExtensionListeners = { readonly [Name in NovelEventName]?: NovelListener<Name> };

/** A schema's parsed value, or `never` for an extension that declares no such schema. */
type OutputOf<Schema> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Schema>
	: never;

/**
 * The state an extension's directives read and write: the app's declared state and the
 * extension's own slice, when it has one. Other extensions' slices stay out, so extensions
 * never depend on each other's types.
 *
 * @template Name - The extension's name.
 * @template Slice - The slice's parsed value; `never` for an extension without one.
 */
export type ExtensionScope<Name extends string, Slice> = [Slice] extends [never]
	? DeclaredState
	: DeclaredState & { [Key in Name]: Slice };

/**
 * The persistent data an extension's directives read: the novel's own record and the
 * extension's lasting slice, when it has one.
 *
 * @template Name - The extension's name.
 * @template Lasting - The lasting slice's parsed value; `never` for an extension without one.
 */
export type ExtensionLasting<Name extends string, Lasting> = [Lasting] extends [never]
	? Persistent
	: Persistent & { [Key in Name]: Lasting };

/**
 * What an extension's `directives` builder receives: every scene directive, `update` for the
 * extension's own slice of state, and `remember` for its lasting slice.
 *
 * @template Name - The extension's name.
 * @template Slice - The slice's parsed value.
 * @template Lasting - The lasting slice's parsed value.
 */
export interface ExtensionContext<
	Name extends string,
	Slice,
	Lasting = never,
> extends SceneDirectives<ExtensionScope<Name, Slice>, ExtensionTools<Name, Lasting>> {
	/**
	 * Sets the extension's slice to a value or to what a function makes of the current one; the
	 * change goes through the play like `set`, so saves and rollback see it.
	 */
	update(
		update:
			| Slice
			| ((
					value: Slice,
					state: Readonly<ExtensionScope<Name, Slice>>,
					tools: ExtensionTools<Name, Lasting>,
			  ) => Slice),
	): SetDirective;
	/**
	 * Sets the extension's lasting slice to a value or to what a function makes of the current
	 * one. It outlives the playthrough: the play emits `persist` with it, a rollback keeps it, and
	 * a replay leaves it as it was. A value its schema refuses is reported on `error` and dropped.
	 */
	remember(
		update:
			| Lasting
			| ((
					value: Lasting,
					state: Readonly<ExtensionScope<Name, Slice>>,
					tools: ExtensionTools<Name, Lasting>,
			  ) => Lasting),
	): RememberDirective;
}

/** The tools an extension's callbacks receive: draws, and the persistent data it reads. */
type ExtensionTools<Name extends string, Lasting> = PlayTools<ExtensionLasting<Name, Lasting>>;

/**
 * Lasting data an extension keeps across every playthrough, beside the novel's own persistent
 * record, such as achievements.
 *
 * @template Schema - The lasting slice's Standard Schema.
 */
export interface LastingOptions<Schema extends StandardSchemaV1> {
	/** Validates the lasting slice whenever a play reads stored persistent data. */
	state: Schema;
	/** The lasting slice of a first playthrough, and of a record stored before the extension had one. */
	initial: SchemaInput<Schema>;
}

/**
 * What every `extension()` takes: lasting data, the directives scenes reach through
 * `ctx.<name>`, and listeners registered with the novel.
 *
 * @template Name - The extension's name.
 * @template Slice - The per-play slice's parsed value; `never` without one.
 * @template Methods - The directive builders.
 * @template Lasting - The lasting slice's Standard Schema; `never` without one.
 */
export interface ExtensionBaseOptions<
	Name extends string,
	Slice,
	Methods extends ExtensionMethods,
	Lasting extends StandardSchemaV1,
> {
	/** Data kept across playthroughs, which `ctx.remember` writes and `tools.persistent.<name>` reads. */
	persistent?: LastingOptions<Lasting>;
	/** Builds the methods scenes call as `ctx.<name>.<method>(…)`; each answers directives. */
	directives?: (ctx: ExtensionContext<Name, Slice, OutputOf<Lasting>>) => Methods;
	/** Listeners for the novel's events; side effects only, as with `novel.on()`. */
	on?: ExtensionListeners;
}

/**
 * What `extension()` takes for an extension with a slice of per-play state.
 *
 * @template Name - The extension's name.
 * @template Schema - The slice's Standard Schema.
 * @template Methods - The directive builders.
 * @template Lasting - The lasting slice's Standard Schema; `never` without one.
 */
export interface ExtensionOptions<
	Name extends string,
	Schema extends StandardSchemaV1,
	Methods extends ExtensionMethods,
	Lasting extends StandardSchemaV1 = never,
> extends ExtensionBaseOptions<Name, StandardSchemaV1.InferOutput<Schema>, Methods, Lasting> {
	/** Validates the slice whenever a play starts or loads a save, like the novel's own state. */
	state: Schema;
	/** The slice of a new play, and of a save made before the extension existed. */
	initial: SchemaInput<Schema>;
}

/**
 * What `extension()` takes for an extension with no per-play state, such as one that keeps only
 * lasting data; its plays and saves carry no slice for it.
 *
 * @template Name - The extension's name.
 * @template Methods - The directive builders.
 * @template Lasting - The lasting slice's Standard Schema; `never` without one.
 */
export interface StatelessExtensionOptions<
	Name extends string,
	Methods extends ExtensionMethods,
	Lasting extends StandardSchemaV1 = never,
> extends ExtensionBaseOptions<Name, never, Methods, Lasting> {
	state?: undefined;
	initial?: undefined;
}

/** A lasting schema as an extension carries it: `undefined` for one that declared none. */
type LastingOf<Lasting> = [Lasting] extends [never] ? undefined : Lasting;

/**
 * A story extension, passed to `createNovel({ extensions })` and declared in `NovelTypes` so
 * `ctx.<name>`, `state.<name>` and `persistent.<name>` are typed.
 *
 * @template Name - The key of its slices and of its directives on the scene context.
 * @template Schema - The per-play slice's Standard Schema, or `undefined` for none.
 * @template Methods - The directive builders.
 * @template Lasting - The lasting slice's Standard Schema, or `undefined` for none.
 */
export interface Extension<
	Name extends string = string,
	Schema extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
	Methods extends ExtensionMethods = ExtensionMethods,
	Lasting extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined,
> {
	readonly name: Name;
	readonly state: Schema;
	/** The slice a new play starts from, and a save without the slice loads with. */
	readonly initial: unknown;
	/** The lasting slice's schema and the value a record without it reads as. */
	readonly persistent: Lasting extends StandardSchemaV1
		? { readonly state: Lasting; readonly initial: unknown }
		: undefined;
	/** Builds the extension's methods from the context its directives are written with. */
	directives(ctx: ExtensionContext<Name, OutputOf<Schema>, OutputOf<Lasting>>): Methods;
	readonly on: ExtensionListeners;
}

/** Any extension, as `createNovel({ extensions })` accepts it whatever its slices and methods. */
export interface AnyExtension {
	readonly name: string;
	readonly state: StandardSchemaV1 | undefined;
	readonly initial: unknown;
	readonly persistent: { readonly state: StandardSchemaV1; readonly initial: unknown } | undefined;
	/** Builds the extension's methods; the novel hands it the context bound to its slices. */
	directives(ctx: never): ExtensionMethods;
	readonly on: ExtensionListeners;
}

/**
 * Declares a story extension: a slice of state saved with the play, lasting data kept across
 * playthroughs, or both, and directives scenes call as `ctx.<name>.<method>(…)`. Pass it to
 * `createNovel({ extensions })`.
 *
 * @param name - The slices' key in the state and persistent data, and the methods' key on the scene context.
 * @param options - The slices' schemas and initial values, its directives and its listeners.
 * @returns The extension.
 * @example export let affection = extension("affection", { state: s.record(s.string(), s.number()), initial: {}, directives: (ctx) => ({ increase: (who: CharacterDeclaration, by: number) => ctx.update((value) => ({ ...value, [who.id]: (value[who.id] ?? 0) + by })) }) });
 * @example export let achievements = extension("achievements", { persistent: { state: s.array(s.string()), initial: [] }, directives: (ctx) => ({ unlock: (id: string) => ctx.remember((all) => (all.includes(id) ? all : [...all, id])) }) });
 */
export function extension<
	const Name extends string,
	Schema extends StandardSchemaV1,
	Methods extends ExtensionMethods = Record<never, never>,
	Lasting extends StandardSchemaV1 = never,
>(
	name: Name,
	options: ExtensionOptions<Name, Schema, Methods, Lasting>,
): Extension<Name, Schema, Methods, LastingOf<Lasting>>;
export function extension<
	const Name extends string,
	Methods extends ExtensionMethods = Record<never, never>,
	Lasting extends StandardSchemaV1 = never,
>(
	name: Name,
	options: StatelessExtensionOptions<Name, Methods, Lasting>,
): Extension<Name, undefined, Methods, LastingOf<Lasting>>;
export function extension(
	name: string,
	options: ExtensionBaseOptions<string, unknown, ExtensionMethods, StandardSchemaV1> & {
		state?: StandardSchemaV1;
		initial?: unknown;
	},
): AnyExtension {
	let build = options.directives;
	return {
		name,
		state: options.state,
		initial: options.initial,
		persistent: options.persistent,
		directives: (ctx: never) => (build === undefined ? {} : build(ctx)),
		on: options.on ?? {},
	};
}

/** Every extension the app declared through {@link NovelTypes}, as a union. */
type NovelExtension = NovelTypes extends { extensions: infer List }
	? List extends readonly (infer Each)[]
		? Each
		: never
	: never;

/** The declared extension named `Name`. */
type ExtensionNamed<Name> = Extract<NovelExtension, { name: Name }>;

/** The methods an extension's builder answers. */
type MethodsOf<Declared> = Declared extends { directives(ctx: never): infer Methods }
	? Methods
	: never;

/**
 * Each declared extension's slice under its name, which the novel's state includes; empty until
 * the app declares extensions, and without the extensions that keep no per-play state.
 */
export type ExtensionState = {
	[
		Each in NovelExtension as Each extends { state: StandardSchemaV1 } ? Each["name"] : never
	]: OutputOf<Each["state"]>;
};

/**
 * Each declared extension's lasting slice under its name, which `tools.persistent` and the
 * `persist` payload include; empty until the app declares extensions that keep lasting data.
 */
export type ExtensionPersistent = {
	[
		Each in NovelExtension as Each extends { persistent: { state: StandardSchemaV1 } }
			? Each["name"]
			: never
	]: OutputOf<NonNullable<Each["persistent"]>["state"]>;
};

/**
 * Each declared extension's methods under its name on the scene context. A call records an
 * {@link ExtensionDirective}, which the novel replaces with what the method answers.
 */
export type ExtensionCalls = {
	[Name in NovelExtension["name"]]: CallsOf<MethodsOf<ExtensionNamed<Name>>>;
};

/** An extension's methods as a scene calls them: the same arguments, recording the call. */
type CallsOf<Methods> = {
	[Method in keyof Methods]: Methods[Method] extends (...args: infer Args) => unknown
		? (...args: Args) => ExtensionDirective
		: never;
};

/**
 * Parses a whole story state: each extension's slice by its own schema, its `initial` value when
 * the input has none, and every other key by the novel's state schema.
 *
 * @param schema - The novel's state schema.
 * @param extensions - The novel's extensions.
 * @param input - Untrusted state: a save's, a starting one, or an edited one.
 * @returns The state callbacks read, or an error naming the slice or field that failed.
 */
export function parseState(
	schema: StandardSchemaV1<unknown, unknown>,
	extensions: readonly AnyExtension[],
	input: unknown,
): Result<StateRecord, Error> {
	let record = isRecord(input) ? input : undefined;
	let rest: unknown = input;
	if (record !== undefined && extensions.length > 0) {
		let copy = { ...record };
		for (let entry of extensions) if (entry.state !== undefined) delete copy[entry.name];
		rest = copy;
	}
	let parsed = validate(schema, rest);
	if (isFailure(parsed)) return parsed;
	let state = parsed.data as StateRecord;
	for (let entry of extensions) {
		if (entry.state === undefined) continue;
		if (Object.hasOwn(state, entry.name)) {
			return failure(
				new Error(`The state schema declares "${entry.name}", the key of an extension's slice.`),
			);
		}
		let given = record?.[entry.name];
		let schema = entry.state;
		let slice = validate(schema, given === undefined ? structuredClone(entry.initial) : given);
		if (isFailure(slice)) return failure(new Error(`${entry.name}: ${slice.error.message}`));
		state[entry.name] = slice.data;
	}
	return success(state);
}

/**
 * Replaces every extension call in a scene, nested lists included, with the directives its
 * method answers, so the engine, saves and tools read only plain directives.
 *
 * @param module - The scene's module as `createScene()` built it.
 * @param methods - Each extension's built methods, by extension name.
 * @returns The module with every call resolved, or an error naming an unknown extension or
 * method, or a method that threw.
 */
export function resolveScene(
	module: SceneModule,
	methods: ReadonlyMap<string, ExtensionMethods>,
): Result<SceneModule, Error> {
	let problems: Error[] = [];
	let directives = resolveList(module.directives, methods, problems);
	let problem = problems[0];
	if (problem !== undefined) return failure(problem);
	return success({ scene: module.scene, directives });
}

/**
 * Resolves the extension calls of one list of directives and of every list nested in it; a call
 * that cannot be resolved is dropped and recorded in `problems`.
 */
function resolveList(
	list: readonly Directive[],
	methods: ReadonlyMap<string, ExtensionMethods>,
	problems: Error[],
): Directive[] {
	return list.flatMap((directive): Directive[] => {
		if (directive.type === "extension") {
			let answered = answer(directive, methods);
			if (isFailure(answered)) {
				problems.push(answered.error);
				return [];
			}
			return resolveList(answered.data, methods, problems);
		}
		if (directive.type === "when") {
			return [
				{
					...directive,
					do: resolveList(directive.do, methods, problems),
					otherwise: resolveList(directive.otherwise, methods, problems),
				},
			];
		}
		if (directive.type === "choose") {
			let options = directive.options.map((option) => ({
				...option,
				do: resolveList(option.do, methods, problems),
			}));
			return [{ ...directive, options }];
		}
		return [directive];
	});
}

/** Calls the method a recorded call names, failing when the novel lacks it or it throws. */
function answer(
	call: ExtensionDirective,
	methods: ReadonlyMap<string, ExtensionMethods>,
): Result<Directive[], Error> {
	let built = methods.get(call.extension);
	if (built === undefined) {
		return failure(
			new Error(`The scene calls extension "${call.extension}", which the novel lacks.`),
		);
	}
	let method = Object.hasOwn(built, call.method) ? built[call.method] : undefined;
	if (method === undefined) {
		return failure(new Error(`Extension "${call.extension}" has no method "${call.method}".`));
	}
	try {
		let answered = (method as (...args: unknown[]) => Directive | Directive[])(...call.args);
		return success(Array.isArray(answered) ? answered : [answered]);
	} catch (error) {
		return failure(
			new Error(`Extension method "${call.extension}.${call.method}" failed.`, { cause: error }),
		);
	}
}

/** Reports whether a value is a plain JSON object, whose keys can hold slices. */
function isRecord(value: unknown): value is StateRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
