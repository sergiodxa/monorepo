/**
 * The contract a flag system implements. Metadata and four resolvers is a
 * working provider; lifecycle, events, hooks and tracking are each opt-in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import type { EvaluationContext } from "../core/context.js";
import type { ResolutionDetails } from "../core/details.js";
import type { Hook } from "../core/hook.js";
import type { ProviderMetadata } from "../core/metadata.js";
import type { TrackingEventDetails } from "../core/tracking.js";
import type { MaybePromise } from "../core/value.js";

import type { ProviderEvents } from "./events.js";

/**
 * What supplies flag values. A resolver is handed the key, the default value
 * and the merged context, and answers with a details structure — `resolved` for
 * a value it found, `failed` for one it could not — rather than throwing.
 *
 * `initialize` is where the expensive work goes, and every status transition
 * after registration is announced through `events`.
 *
 * A resolver may answer synchronously, so a provider holding its rule set in
 * memory allocates no promise to report what it already knows.
 */
export interface Provider {
	readonly metadata: ProviderMetadata;
	/** Hooks that run for every evaluation this provider answers, innermost of all levels. */
	readonly hooks?: Hook[];
	/** The emitter status transitions are announced on, needed once `initialize` exists. */
	readonly events?: ProviderEvents;
	/**
	 * Declares that this instance keys state on the one domain it is bound to,
	 * so the API refuses to bind it to a second.
	 */
	readonly domainScoped?: boolean;

	resolveBoolean(
		key: string,
		defaultValue: boolean,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<boolean>>;
	resolveString(
		key: string,
		defaultValue: string,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<string>>;
	resolveNumber(
		key: string,
		defaultValue: number,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<number>>;
	resolveObject(
		key: string,
		defaultValue: JSONValue,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<JSONValue>>;

	/** Prepares the provider to resolve, and rejects when it cannot be prepared. */
	initialize?(context: EvaluationContext, domain?: string): Promise<void>;
	/** Releases what `initialize` acquired, idempotently, returning to the uninitialized state. */
	shutdown?(): Promise<void>;
	track?(name: string, context: EvaluationContext, details?: TrackingEventDetails): void;
}
