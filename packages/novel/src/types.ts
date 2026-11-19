/**
 * The types an app declares once through `NovelTypes` (its state, its message bundle and its
 * interactions) and everything derived from them: message keys and values, state paths, and
 * the callbacks scenes pass to `when`, `set` and message values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageKey, MessageValues, Messages } from "@sdxc/i18n";
import type { Random } from "@sdxc/random";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Augmented by an app to type every scene from its state, its message bundle and its
 * interactions. Without it, state is any record, any key reads as a line, and an interaction
 * frame carries unknown input.
 *
 * @example declare module "@sdxc/novel" { interface NovelTypes { state: State; messages: typeof en; interactions: typeof interactions } }
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- the seam apps augment
export interface NovelTypes {}

/** Story state as a novel's callbacks read it; the engine itself treats it as any record. */
export interface StateRecord {
	[key: string]: unknown;
}

/** The state the app declared through {@link NovelTypes}, or any record until it does. */
export type NovelState = NovelTypes extends { state: infer State } ? State : StateRecord;

/** The message bundle the app declared through {@link NovelTypes}, or untyped messages. */
export type NovelMessages = NovelTypes extends { messages: infer Bundle } ? Bundle : Messages;

/** Every message key of the app's bundle: lines, names, labels, titles and captions. */
export type LineKey = MessageKey<NovelMessages>;

/** What a callback receives beside the state: draws from the play's seeded stream. */
export interface PlayTools {
	/** The play's seeded stream; its position is saved with the play, so a reload draws the same. */
	random: Random;
}

/**
 * A callback the engine calls at play time with the current state. It reads only: a change to
 * state goes through `set`, so rollback and saves see every change.
 *
 * @template Value - What the callback answers.
 */
export type StateCallback<Value> = (state: Readonly<NovelState>, tools: PlayTools) => Value;

/** Message values written inline, or computed from state when the line is shown. */
export type ValuesInput<Values> = Values | StateCallback<Values>;

/**
 * The values argument for the message at `Key`: required when its text declares variables,
 * optional when it declares none, and in either case an object or a callback answering one.
 *
 * @template Key - The line's message key.
 */
export type LineValues<Key extends string> =
	MessageValues<NovelMessages, Key> extends [values: infer Values]
		? [values: ValuesInput<Values>]
		: MessageValues<NovelMessages, Key> extends [values?: infer Values]
			? [values?: ValuesInput<NonNullable<Values>>]
			: never;

/**
 * Dotted paths to every value of `State` that `set` can change, nested objects included and
 * arrays treated as one value. Untyped state yields `string`.
 *
 * @template State - The state the paths are read from.
 */
export type StatePath<State> = State extends readonly unknown[]
	? never
	: State extends object
		? string extends keyof State
			? string
			: { [Key in keyof State & string]: Key | NestedPath<Key, State[Key]> }[keyof State & string]
		: never;

/** Paths under `Key` when its value is an object that nests further. */
type NestedPath<Key extends string, Value> =
	NonNullable<Value> extends readonly unknown[]
		? never
		: NonNullable<Value> extends object
			? `${Key}.${StatePath<NonNullable<Value>>}`
			: never;

/**
 * The value at dotted path `Path` in `State`.
 *
 * @template State - The state the path is read from.
 * @template Path - A path from {@link StatePath}.
 */
export type PathValue<State, Path extends string> = Path extends keyof State
	? State[Path]
	: Path extends `${infer Head}.${infer Tail}`
		? Head extends keyof State
			? PathValue<NonNullable<State[Head]>, Tail>
			: unknown
		: unknown;

/**
 * The paths of `State` whose value accepts `Value`, which is where an interaction's output
 * can be stored.
 *
 * @template State - The state the paths are read from.
 * @template Value - The value being stored.
 */
export type PathAccepting<State, Value> = {
	[Path in StatePath<State>]: Value extends PathValue<State, Path> ? Path : never;
}[StatePath<State>];

/**
 * A partial copy of `Value` at any depth: the state a test or a new play starts from, with
 * every missing field taking its schema default.
 *
 * @template Value - The value made partial.
 */
export type DeepPartial<Value> = Value extends readonly unknown[]
	? Value
	: Value extends object
		? { [Key in keyof Value]?: DeepPartial<Value[Key]> }
		: Value;

/**
 * What a caller writes for a schema: its input type, or its output type when the schema takes
 * `unknown` input, so a declared interaction still checks what a scene and a reply pass it.
 *
 * @template Schema - A Standard Schema.
 */
export type SchemaInput<Schema extends StandardSchemaV1> =
	unknown extends StandardSchemaV1.InferInput<Schema>
		? StandardSchemaV1.InferOutput<Schema>
		: StandardSchemaV1.InferInput<Schema>;
