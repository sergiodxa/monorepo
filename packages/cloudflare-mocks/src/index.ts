/**
 * Public entry point of the Cloudflare binding mocks: one factory per binding, each
 * returning an isolated, behavior-accurate instance typed against
 * `@cloudflare/workers-types` so a mock that drifts from the platform fails typecheck.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { AnalyticsEngineMock } from "./analytics-engine";
export type { D1DatabaseMockOptions } from "./d1";
export type {
	DurableObjectNamespaceMock,
	DurableObjectStubFactory,
} from "./durable-object-namespace";
export type { DurableObjectStateMock, DurableObjectStateMockOptions } from "./durable-object-state";
export type { EnvMockOptions } from "./env";
export type { ExecutionContextMock, ExecutionContextMockOptions } from "./execution-context";
export type { FetcherHandler, FetcherMock } from "./fetcher";
export type { KVNamespaceMockOptions } from "./kv";
export type {
	DeferredWork,
	QueueConsumeOptions,
	QueueConsumeResult,
	QueueConsumer,
	QueueMessageRecord,
	QueueMock,
	QueueMockOptions,
} from "./queue";
export type { R2BucketMock } from "./r2";
export type { RateLimitMock, RateLimitMockOptions } from "./rate-limit";
export type { SecretsStoreSecretMock, SecretsStoreSecretMockOptions } from "./secrets-store";
export type { SendEmailMock, SendEmailMockOptions, SentEmailRecord } from "./send-email";
export type { SqlStorageMockOptions } from "./sql-storage";

export { createAnalyticsEngine } from "./analytics-engine";
export { createD1Database } from "./d1";
export { createDurableObjectNamespace } from "./durable-object-namespace";
export { createDurableObjectState } from "./durable-object-state";
export { createEnv } from "./env";
export { createExecutionContext } from "./execution-context";
export { createFetcher } from "./fetcher";
export { createKVNamespace } from "./kv";
export { createQueue } from "./queue";
export { createR2Bucket } from "./r2";
export { createRateLimit } from "./rate-limit";
export { createSecretsStoreSecret } from "./secrets-store";
export { createSendEmail } from "./send-email";
export { createSqlStorage, MockSqlStorageCursor, MockSqlStorageStatement } from "./sql-storage";
