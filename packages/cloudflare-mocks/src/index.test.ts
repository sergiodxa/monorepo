/**
 * Guards the public entry point: every binding factory must be reachable from the barrel and
 * must build an instance, so a module added without a re-export fails here instead of in the
 * first test that reaches for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import * as mocks from "./index";

describe("@pkg/cloudflare-mocks", () => {
	test("exports every binding factory", () => {
		expect(Object.keys(mocks).sort()).toEqual(
			[
				"MockSqlStorageCursor",
				"MockSqlStorageStatement",
				"createAnalyticsEngine",
				"createD1Database",
				"createDurableObjectNamespace",
				"createDurableObjectState",
				"createEnv",
				"createExecutionContext",
				"createFetcher",
				"createKVNamespace",
				"createQueue",
				"createR2Bucket",
				"createRateLimit",
				"createSecretsStoreSecret",
				"createSendEmail",
				"createSqlStorage",
			].sort(),
		);
	});

	test("builds every binding through the barrel", () => {
		let env = mocks.createEnv({
			ANALYTICS: mocks.createAnalyticsEngine(),
			ASSETS: mocks.createFetcher(() => new Response(null, { status: 404 })),
			BUCKET: mocks.createR2Bucket(),
			CACHE: mocks.createKVNamespace(),
			DB: mocks.createD1Database(),
			LIMITER: mocks.createRateLimit(),
			MAILER: mocks.createSendEmail(),
			QUEUE: mocks.createQueue(),
			SECRET: mocks.createSecretsStoreSecret({ value: "s3cr3t" }),
			SQL: mocks.createSqlStorage(),
			TENANTS: mocks.createDurableObjectNamespace(() => () => new Response("ok")),
		});

		expect(Object.keys(env).sort()).toEqual([
			"ANALYTICS",
			"ASSETS",
			"BUCKET",
			"CACHE",
			"DB",
			"LIMITER",
			"MAILER",
			"QUEUE",
			"SECRET",
			"SQL",
			"TENANTS",
		]);

		expect(mocks.createExecutionContext().waitUntilPromises).toEqual([]);
		expect(mocks.createDurableObjectState().abortReason).toBeUndefined();
	});
});
