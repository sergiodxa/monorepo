/**
 * The surface application code evaluates through, and the flag handles a
 * catalog declares so a call site restates neither the key nor the type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { EvaluationContext } from "./context.js";
import type { EvaluationDetails } from "./details.js";
import type { Hook } from "./hook.js";
import type { ClientMetadata } from "./metadata.js";
import type { EvaluationOptions, ObjectEvaluationOptions } from "./options.js";
import type { EventHandler, ProviderEvent, ProviderStatus } from "./status.js";
import type { TrackingEventDetails } from "./tracking.js";
import type { FlagValue, FlagValueType } from "./value.js";

/**
 * A flag as the application declares it: the key it is known by, the type it
 * evaluates to, the fallback when nothing resolves, and for a structure the
 * schema that value is checked against.
 */
export interface Flag<T extends FlagValue> {
	readonly key: string;
	readonly type: FlagValueType;
	readonly defaultValue: T;
	readonly schema?: StandardSchemaV1<unknown, T>;
}

/**
 * What one catalog evaluation may change. The bag is named rather than
 * positional because per-call context is the common case, and a positional
 * default override would put an `undefined` placeholder in front of it.
 */
export interface FlagOptions<T extends FlagValue> extends EvaluationOptions {
	/** Overrides the catalog's default for this one call. */
	defaultValue?: T;
	context?: EvaluationContext;
}

/**
 * What a handler evaluates flags through. Nothing here throws: an evaluation
 * that cannot resolve answers with the default value it was handed, and the
 * detailed variants carry why on the returned structure.
 *
 * Every method is asynchronous whether or not the provider behind it had to
 * await anything, so swapping in a provider that reaches over the network
 * changes no call site.
 */
export interface Client {
	readonly metadata: ClientMetadata;
	readonly providerStatus: ProviderStatus;

	boolean(
		key: string,
		defaultValue: boolean,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<boolean>;
	string(
		key: string,
		defaultValue: string,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<string>;
	number(
		key: string,
		defaultValue: number,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<number>;
	object<T extends JSONValue>(
		key: string,
		defaultValue: T,
		options: ObjectEvaluationOptions<T>,
		context?: EvaluationContext,
	): Promise<T>;

	booleanDetails(
		key: string,
		defaultValue: boolean,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<EvaluationDetails<boolean>>;
	stringDetails(
		key: string,
		defaultValue: string,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<EvaluationDetails<string>>;
	numberDetails(
		key: string,
		defaultValue: number,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<EvaluationDetails<number>>;
	objectDetails<T extends JSONValue>(
		key: string,
		defaultValue: T,
		options: ObjectEvaluationOptions<T>,
		context?: EvaluationContext,
	): Promise<EvaluationDetails<T>>;

	/** Evaluates a catalog handle, which carries the key, the type and the default. */
	get<T extends FlagValue>(flag: Flag<T>, options?: FlagOptions<T>): Promise<T>;
	/** The detailed form of `get`, for a caller that wants the reason and the variant. */
	details<T extends FlagValue>(
		flag: Flag<T>,
		options?: FlagOptions<T>,
	): Promise<EvaluationDetails<T>>;

	addHooks(...hooks: Hook[]): void;
	addHandler(event: ProviderEvent, handler: EventHandler): void;
	removeHandler(event: ProviderEvent, handler: EventHandler): void;
	track(name: string, context?: EvaluationContext, details?: TrackingEventDetails): void;
}
