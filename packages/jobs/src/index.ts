/**
 * Public surface of the jobs package: the declaration helpers that build a job map, the
 * handler and middleware types an app writes against, the dispatcher both worker handlers
 * delegate to, and the context they all share. The endings a job throws are grouped here
 * as `Job`, and exported one by one from `@sdxc/jobs/errors`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { AnyJobContext, JobContextInit } from "./context.js";
export type {
	AnyJobHandler,
	CurrentJobContext,
	HandlerInput,
	JobHandler,
	JobHandlerContext,
	JobHandlerFunction,
	JobTypes,
} from "./handler.js";
export type { CronExpression, JobLeaf, JobOptions } from "./job.js";
export type {
	AnyJobDefinition,
	AnyJobLeaf,
	EnqueueArgs,
	EnqueueInput,
	JobArgs,
	JobDefinition,
	JobInput,
	JobMap,
	JobTree,
} from "./jobs.js";
export type {
	AnyJobMiddleware,
	ChainProperties,
	ContextEffect,
	EmptyContextEffect,
	JobMiddleware,
	NextFunction,
} from "./middleware.js";
export type {
	HandlerModule,
	InvalidMessage,
	JobDispatcher,
	JobDispatcherContext,
	JobDispatcherOptions,
	LoadHandler,
	RefusalReason,
	SendMessages,
} from "./dispatcher.js";

export { JobContext } from "./context.js";
export { createJobDispatcher } from "./dispatcher.js";
export { Ending, Job } from "./errors.js";
export { createJobContext, createJobHandler } from "./handler.js";
export { job } from "./job.js";
export { jobs, messageBody } from "./jobs.js";
