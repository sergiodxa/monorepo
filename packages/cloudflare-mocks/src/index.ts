/**
 * Public entry point of the Cloudflare binding mocks: one factory per binding, each
 * returning an isolated, behavior-accurate instance typed against
 * `@cloudflare/workers-types` so a mock that drifts from the platform fails typecheck.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { AnalyticsEngineMock } from "./analytics-engine.js";
export type { D1DatabaseMockOptions } from "./d1.js";
export type {
	DurableObjectNamespaceMock,
	DurableObjectStubFactory,
} from "./durable-object-namespace.js";
export type {
	DurableObjectStateMock,
	DurableObjectStateMockOptions,
} from "./durable-object-state.js";
export type { EnvMockOptions } from "./env.js";
export type { ExecutionContextMock, ExecutionContextMockOptions } from "./execution-context.js";
export type { FetcherHandler, FetcherMock } from "./fetcher.js";
export type { KVNamespaceMockOptions } from "./kv.js";
export type {
	DeferredWork,
	QueueConsumeOptions,
	QueueConsumeResult,
	QueueConsumer,
	QueueMessageRecord,
	QueueMock,
	QueueMockOptions,
} from "./queue.js";
export type { R2BucketMock } from "./r2.js";
export type { RateLimitMock, RateLimitMockOptions } from "./rate-limit.js";
export type { SecretsStoreSecretMock, SecretsStoreSecretMockOptions } from "./secrets-store.js";
export type { SendEmailMock, SendEmailMockOptions, SentEmailRecord } from "./send-email.js";
export type { SqlStorageMockOptions } from "./sql-storage.js";

export { createAnalyticsEngine } from "./analytics-engine.js";
export { createD1Database } from "./d1.js";
export { createDurableObjectNamespace } from "./durable-object-namespace.js";
export { createDurableObjectState } from "./durable-object-state.js";
export { createEnv } from "./env.js";
export { createExecutionContext } from "./execution-context.js";
export { createFetcher } from "./fetcher.js";
export { createKVNamespace } from "./kv.js";
export { createQueue } from "./queue.js";
export { createR2Bucket } from "./r2.js";
export { createRateLimit } from "./rate-limit.js";
export { createSecretsStoreSecret } from "./secrets-store.js";
export { createSendEmail } from "./send-email.js";
export { createSqlStorage, MockSqlStorageCursor, MockSqlStorageStatement } from "./sql-storage.js";
