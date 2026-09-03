/**
 * Public surface of the jobs package: the declaration helpers that build a job map, the
 * handler and middleware types an app writes against, the dispatcher both worker handlers
 * delegate to, and the context they all share. The endings a job throws are grouped here
 * as `Job`, and exported one by one from `@pkg/jobs-next/errors`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { AnyJobContext, JobContextInit } from "./context";
export type {
	AnyJobHandler,
	CurrentJobContext,
	HandlerInput,
	JobHandler,
	JobHandlerContext,
	JobHandlerFunction,
	JobTypes,
} from "./handler";
export type { CronExpression, JobLeaf, JobOptions } from "./job";
export type {
	AnyJobDefinition,
	AnyJobLeaf,
	EnqueueArgs,
	EnqueueInput,
	JobDefinition,
	JobInput,
	JobMap,
	JobTree,
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
	SendMessages,
} from "./dispatcher";

export { JobContext } from "./context";
export { createJobDispatcher } from "./dispatcher";
export { Ending, Job } from "./errors";
export { createJobContext, createJobHandler } from "./handler";
export { job } from "./job";
export { jobs, messageBody } from "./jobs";
