import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { RouterContextProvider } from "react-router";

import { BatchedLogger } from "./batched-logger";
import { createBatchedLoggerMiddleware } from "./middleware";

describe(createBatchedLoggerMiddleware.name, () => {
	let consoleInfoSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let dateNowSpy: ReturnType<typeof spyOn>;

	let testRequest = new Request("https://example.com/test");

	beforeEach(() => {
		consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		dateNowSpy = spyOn(Date, "now").mockReturnValue(1738590000000);
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		dateNowSpy.mockRestore();
	});

	test("creates a BatchedLogger and stores it in context", async () => {
		let [middleware, getLogger] = createBatchedLoggerMiddleware();
		let context = new RouterContextProvider();
		let capturedLogger: BatchedLogger | undefined;

		await middleware(
			{ context, request: testRequest, params: {}, unstable_pattern: "/test" },
			async () => {
				capturedLogger = getLogger(context);
				return new Response("OK");
			},
		);

		expect(capturedLogger).toBeInstanceOf(BatchedLogger);
	});

	test("flushes logger after handler completes", async () => {
		let [middleware, getLogger] = createBatchedLoggerMiddleware();
		let context = new RouterContextProvider();

		await middleware(
			{ context, request: testRequest, params: {}, unstable_pattern: "/test" },
			async () => {
				let logger = getLogger(context);
				logger.info("test_event");
				return new Response("OK");
			},
		);

		expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
	});

	test("flushes logger even if handler throws", async () => {
		let [middleware, getLogger] = createBatchedLoggerMiddleware();
		let context = new RouterContextProvider();

		try {
			await middleware(
				{ context, request: testRequest, params: {}, unstable_pattern: "/test" },
				async () => {
					let logger = getLogger(context);
					logger.error("error_before_throw");
					throw new Error("Handler error");
				},
			);
		} catch {
			// Expected
		}

		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
	});

	test("returns the response from the handler", async () => {
		let [middleware] = createBatchedLoggerMiddleware();
		let context = new RouterContextProvider();

		let response = await middleware(
			{ context, request: testRequest, params: {}, unstable_pattern: "/test" },
			async () => {
				return new Response("Test body", { status: 201 });
			},
		);

		expect(response).toBeInstanceOf(Response);
		expect((response as Response).status).toBe(201);
		expect(await (response as Response).text()).toBe("Test body");
	});

	test("getter retrieves the BatchedLogger from context", async () => {
		let [middleware, getLogger] = createBatchedLoggerMiddleware();
		let context = new RouterContextProvider();

		await middleware(
			{ context, request: testRequest, params: {}, unstable_pattern: "/test" },
			async () => {
				let logger = getLogger(context);
				expect(logger).toBeInstanceOf(BatchedLogger);
				return new Response("OK");
			},
		);
	});

	test("getter throws error if logger middleware was not used", () => {
		let [, getLogger] = createBatchedLoggerMiddleware();
		let context = new RouterContextProvider();

		// React Router's context.get throws "No value found for context" when key doesn't exist
		expect(() => getLogger(context)).toThrow();
	});
});
