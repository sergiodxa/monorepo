/**
 * Tests for the router middleware: `log()` opens the invocation's log or joins the one a
 * host already opened, publishes it as `ctx.log`, and records the matched route, the
 * method, and the status once the handler has run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import { createLogger } from "./create-logger.js";
import { CurrentLog, log } from "./middleware.js";

describe("log middleware", () => {
	function collectingLogger() {
		let records: Record<string, unknown>[] = [];
		let logger = createLogger({ service: "test", sink: (record) => void records.push(record) });
		return { logger, records };
	}

	test("opens a request log, publishes ctx.log, and records route, method, and status", async () => {
		let { logger, records } = collectingLogger();
		let router = createRouter({ middleware: [log(logger)] });
		router.get("/users/:id/posts/:slug", (ctx) => {
			ctx.log.set({ user: { id: ctx.params.id } });
			return new Response("ok", { status: 201 });
		});

		let response = await router.fetch(new Request("https://example.com/users/42/posts/hello"));

		expect(response.status).toBe(201);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			service: "test",
			kind: "request",
			route: "/users/:id/posts/:slug",
			"http.method": "GET",
			"http.status": 201,
			"user.id": "42",
			outcome: "ok",
		});
	});

	test("records the pathname as the route when nothing matched", async () => {
		let { logger, records } = collectingLogger();
		let router = createRouter({ middleware: [log(logger)] });

		await router.fetch(new Request("https://example.com/missing"));

		expect(records[0]).toMatchObject({ route: "/missing", "http.status": 404 });
	});

	test("joins the current log instead of opening a second one", async () => {
		let { logger, records } = collectingLogger();
		let router = createRouter({ middleware: [log()] });
		router.get("/users/:id", (ctx) => {
			ctx.log.set({ user: { id: ctx.params.id } });
			return new Response("ok");
		});

		await logger
			.open("request", { tenant: { id: "t1" } })
			.run(() => router.fetch(new Request("https://example.com/users/7")));

		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			"tenant.id": "t1",
			"user.id": "7",
			route: "/users/:id",
			"http.method": "GET",
		});
	});

	test("fails the log and rethrows when a handler throws", async () => {
		let { logger, records } = collectingLogger();
		let router = createRouter({ middleware: [log(logger)] });
		router.get("/boom", () => {
			throw new Error("boom");
		});

		await expect(router.fetch(new Request("https://example.com/boom"))).rejects.toThrow("boom");

		expect(records[0]).toMatchObject({
			route: "/boom",
			outcome: "error",
			"error.type": "Error",
			"error.message": "boom",
		});
	});

	test("opens a bare log written to the console when given no logger", async () => {
		let info = vi.spyOn(console, "log").mockImplementation(() => {});
		let router = createRouter({ middleware: [log()] });
		router.get("/", () => new Response("ok"));

		await router.fetch(new Request("https://example.com/"));

		expect(info).toHaveBeenCalledWith(expect.objectContaining({ kind: "request", route: "/" }));
		expect(info.mock.calls[0]![0]).not.toHaveProperty("service");
		info.mockRestore();
	});

	test("exposes the same log through the context key", async () => {
		let { logger } = collectingLogger();
		let router = createRouter({ middleware: [log(logger)] });
		let same = false;
		router.get("/", (ctx) => {
			same = ctx.get(CurrentLog) === ctx.log;
			return new Response("ok");
		});

		await router.fetch(new Request("https://example.com/"));

		expect(same).toBe(true);
	});
});
