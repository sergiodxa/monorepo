/**
 * The vocabulary everything else in this package is written in: the context
 * targeting reads, the structures an evaluation answers with, the codes and
 * reasons it carries, and the provider's status machine.
 *
 * Types only, so importing it to write a signature costs nothing at runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Client, Flag, FlagOptions } from "./core/client.js";
export type { EvaluationContext } from "./core/context.js";
export type { EvaluationDetails, ResolutionDetails } from "./core/details.js";
export type { ErrorCode } from "./core/error.js";
export type { Hook, HookContext, HookData, HookHints, HookStage } from "./core/hook.js";
export type {
	ClientMetadata,
	EventMetadata,
	FlagMetadata,
	ProviderMetadata,
} from "./core/metadata.js";
export type { EvaluationOptions, ObjectEvaluationOptions } from "./core/options.js";
export type { Reason } from "./core/reason.js";
export type {
	EventDetails,
	EventHandler,
	ProviderEvent,
	ProviderEventDetails,
	ProviderStatus,
} from "./core/status.js";
export type { TrackingEventDetails } from "./core/tracking.js";
export type { FlagValue, FlagValueType, MaybePromise } from "./core/value.js";
