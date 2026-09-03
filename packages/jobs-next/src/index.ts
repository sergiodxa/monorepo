/**
 * Public surface of the jobs package: the declaration helpers that build a job map,
 * the handler and middleware types an app writes against, the dispatcher both worker
 * handlers delegate to, the context they all share, and the errors that end a delivery.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { AnyJobContext, JobContextInit, RetryDeliveryOptions, Settlement } from "./context";
export type { RetryOptions } from "./errors";
export type {
	AnyJobHandler,
	CurrentJobContext,
	HandlerInput,
	JobHandler,
	JobHandlerContext,
	JobHandlerFunction,
	JobTypes,
} from "./handler";
export type { JobLeaf, JobOptions } from "./job";
export type {
	AnyJobDefinition,
	AnyJobLeaf,
	EnqueueArgs,
	EnqueueInput,
	JobDefinition,
	JobMap,
	JobsOptions,
	JobTree,
	SendMessages,
} from "./jobs";
export type {
	AnyJobMiddleware,
	ChainProperties,
	ContextEffect,
	EmptyContextEffect,
	JobMiddleware,
	NextFunction,
} from "./middleware";
export type {
	HandlerModule,
	InvalidMessage,
	JobDispatcher,
	JobDispatcherContext,
	JobDispatcherOptions,
	LoadHandler,
	RefusalReason,
} from "./dispatcher";

export { JobContext } from "./context";
export { JobTimeout, NonRetriableError, RetryError } from "./errors";
export { createJobHandler } from "./handler";
export { job } from "./job";
export { jobs } from "./jobs";
export { createJobDispatcher } from "./dispatcher";
