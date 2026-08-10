import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { Logger } from "./request-logger";

describe(Logger.name, () => {
	let consoleInfoSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let dateNowSpy: ReturnType<typeof spyOn>;
	let cryptoRandomUUIDSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		dateNowSpy = spyOn(Date, "now").mockReturnValue(1738590000000);
		cryptoRandomUUIDSpy = spyOn(crypto, "randomUUID").mockReturnValue(
			"test-uuid-1234" as `${string}-${string}-${string}-${string}-${string}`,
		);
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		dateNowSpy.mockRestore();
		cryptoRandomUUIDSpy.mockRestore();
	});

	describe("constructor", () => {
		test("extracts request info", () => {
			let request = new Request("https://example.com/api/test?foo=bar", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"user-agent": "Mozilla/5.0",
				},
			});
			let logger = new Logger(request);

			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"POST https://example.com/api/test?foo=bar ???",
				expect.objectContaining({
					request: expect.objectContaining({
						method: "POST",
						url: expect.objectContaining({
							protocol: "https:",
							hostname: "example.com",
							pathname: "/api/test",
							search: "?foo=bar",
						}),
						headers: {
							"content-type": "application/json",
							"user-agent": "Mozilla/5.0",
						},
					}),
				}),
			);
		});
	});

	describe("header filtering", () => {
		test("includes allowed request headers", () => {
			let request = new Request("https://example.com/test", {
				headers: {
					"content-type": "application/json",
					accept: "text/html",
					"accept-language": "en-US",
					"user-agent": "TestAgent",
					referer: "https://google.com",
					origin: "https://example.com",
				},
			});
			let logger = new Logger(request);

			logger.flush();

			let calledWith = consoleInfoSpy.mock.calls[0]?.[1] as Record<string, unknown>;
			let headers = (calledWith.request as Record<string, unknown>).headers as Record<
				string,
				string
			>;

			expect(headers["content-type"]).toBe("application/json");
			expect(headers["accept"]).toBe("text/html");
			expect(headers["accept-language"]).toBe("en-US");
			expect(headers["user-agent"]).toBe("TestAgent");
			expect(headers["referer"]).toBe("https://google.com");
			expect(headers["origin"]).toBe("https://example.com");
		});

		test("excludes sensitive request headers", () => {
			let request = new Request("https://example.com/test", {
				headers: {
					authorization: "Bearer secret123",
					cookie: "session=abc",
					"x-api-key": "key123",
					"content-type": "application/json",
				},
			});
			let logger = new Logger(request);

			logger.flush();

			let calledWith = consoleInfoSpy.mock.calls[0]?.[1] as Record<string, unknown>;
			let headers = (calledWith.request as Record<string, unknown>).headers as Record<
				string,
				string
			>;

			expect(headers["authorization"]).toBeUndefined();
			expect(headers["cookie"]).toBeUndefined();
			expect(headers["x-api-key"]).toBeUndefined();
			expect(headers["content-type"]).toBe("application/json");
		});

		test("excludes headers containing sensitive patterns", () => {
			let request = new Request("https://example.com/test", {
				headers: {
					"x-custom-token": "token123",
					"my-secret-header": "secret",
					"api-key-custom": "key",
					"content-type": "application/json",
				},
			});
			let logger = new Logger(request);

			logger.flush();

			let calledWith = consoleInfoSpy.mock.calls[0]?.[1] as Record<string, unknown>;
			let headers = (calledWith.request as Record<string, unknown>).headers as Record<
				string,
				string
			>;

			expect(headers["x-custom-token"]).toBeUndefined();
			expect(headers["my-secret-header"]).toBeUndefined();
			expect(headers["api-key-custom"]).toBeUndefined();
		});
	});

	describe("response", () => {
		test("captures response status and headers", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			let response = new Response("OK", {
				status: 200,
				headers: {
					"content-type": "text/html; charset=utf-8",
					"content-length": "2",
					"cache-control": "max-age=3600",
				},
			});
			logger.response = response;

			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"GET https://example.com/test 200",
				expect.objectContaining({
					response: {
						status: 200,
						headers: {
							"content-type": "text/html; charset=utf-8",
							"content-length": "2",
							"cache-control": "max-age=3600",
						},
					},
				}),
			);
		});

		test("excludes set-cookie from response headers", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			let response = new Response("OK", {
				status: 200,
				headers: {
					"content-type": "text/html",
					"set-cookie": "session=abc; HttpOnly",
				},
			});
			logger.response = response;

			logger.flush();

			let calledWith = consoleInfoSpy.mock.calls[0]?.[1] as Record<string, unknown>;
			let headers = (calledWith.response as Record<string, unknown>).headers as Record<
				string,
				string
			>;

			expect(headers["set-cookie"]).toBeUndefined();
		});
	});

	describe("context setters", () => {
		test("sets subject", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.subject = { id: "user_123", email: "test@example.com" };
			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					subject: { id: "user_123", email: "test@example.com" },
				}),
			);
		});

		test("sets profile", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.profile = { role: "admin", teamId: "team_456" };
			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					profile: { role: "admin", teamId: "team_456" },
				}),
			);
		});

		test("sets billing", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.billing = { polarId: "cust_abc", plan: "pro" };
			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					billing: { polarId: "cust_abc", plan: "pro" },
				}),
			);
		});
	});

	describe("scoped loggers", () => {
		describe("middleware", () => {
			test("returns scoped logger for middleware", () => {
				let request = new Request("https://example.com/test");
				let logger = new Logger(request);

				let middlewareLog = logger.middleware("auth");
				middlewareLog.info("auth.start");
				middlewareLog.info("auth.complete", { userId: "user_123" });

				logger.flush();

				expect(consoleInfoSpy).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						middleware: {
							auth: [
								{ level: "info", event: "auth.start" },
								{ level: "info", event: "auth.complete", userId: "user_123" },
							],
						},
					}),
				);
			});

			test("returns same logger for same middleware name", () => {
				let request = new Request("https://example.com/test");
				let logger = new Logger(request);

				let first = logger.middleware("auth");
				let second = logger.middleware("auth");

				expect(first).toBe(second);
			});

			test("supports multiple middleware scopes", () => {
				let request = new Request("https://example.com/test");
				let logger = new Logger(request);

				logger.middleware("auth").info("auth.start");
				logger.middleware("i18n").info("i18n.detected", { locale: "en" });
				logger.middleware("auth").info("auth.complete");

				logger.flush();

				expect(consoleInfoSpy).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						middleware: {
							auth: [
								{ level: "info", event: "auth.start" },
								{ level: "info", event: "auth.complete" },
							],
							i18n: [{ level: "info", event: "i18n.detected", locale: "en" }],
						},
					}),
				);
			});
		});

		describe("loader", () => {
			test("returns scoped logger for loader", () => {
				let request = new Request("https://example.com/test");
				let logger = new Logger(request);

				let loaderLog = logger.loader("$team");
				loaderLog.info("team.loader.start", { teamId: "team_456" });
				loaderLog.info("team.loader.complete", { membershipCount: 5 });

				logger.flush();

				expect(consoleInfoSpy).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						loaders: {
							$team: [
								{ level: "info", event: "team.loader.start", teamId: "team_456" },
								{ level: "info", event: "team.loader.complete", membershipCount: 5 },
							],
						},
					}),
				);
			});

			test("supports parallel loader logging", () => {
				let request = new Request("https://example.com/test");
				let logger = new Logger(request);

				// Simulate parallel loaders
				let teamLog = logger.loader("$team");
				let monitorsLog = logger.loader("$team.monitors");

				teamLog.info("team.start");
				monitorsLog.info("monitors.start");
				monitorsLog.info("monitors.complete", { count: 10 });
				teamLog.info("team.complete");

				logger.flush();

				expect(consoleInfoSpy).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						loaders: {
							$team: [
								{ level: "info", event: "team.start" },
								{ level: "info", event: "team.complete" },
							],
							"$team.monitors": [
								{ level: "info", event: "monitors.start" },
								{ level: "info", event: "monitors.complete", count: 10 },
							],
						},
					}),
				);
			});
		});

		describe("action", () => {
			test("returns scoped logger for action", () => {
				let request = new Request("https://example.com/test", { method: "POST" });
				let logger = new Logger(request);

				let actionLog = logger.action("$team.settings");
				actionLog.info("settings.update.start");
				actionLog.info("settings.update.success");

				logger.flush();

				expect(consoleInfoSpy).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						action: {
							routeId: "$team.settings",
							events: [
								{ level: "info", event: "settings.update.start" },
								{ level: "info", event: "settings.update.success" },
							],
						},
					}),
				);
			});

			test("returns same logger for same action route", () => {
				let request = new Request("https://example.com/test", { method: "POST" });
				let logger = new Logger(request);

				let first = logger.action("$team");
				let second = logger.action("$team");

				expect(first).toBe(second);
			});
		});

		describe("render", () => {
			test("returns scoped logger for render", () => {
				let request = new Request("https://example.com/test");
				let logger = new Logger(request);

				let renderLog = logger.render;
				renderLog.info("render.start");
				renderLog.info("render.complete", { status: 200 });

				logger.flush();

				expect(consoleInfoSpy).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						render: [
							{ level: "info", event: "render.start" },
							{ level: "info", event: "render.complete", status: 200 },
						],
					}),
				);
			});

			test("returns same render logger each time", () => {
				let request = new Request("https://example.com/test");
				let logger = new Logger(request);

				let first = logger.render;
				let second = logger.render;

				expect(first).toBe(second);
			});
		});
	});

	describe("unscoped logging", () => {
		test("info logs to unscoped events", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.info("unhandled.event", { detail: "something" });
			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					events: [{ level: "info", event: "unhandled.event", detail: "something" }],
				}),
			);
		});

		test("error logs to unscoped events", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.error("request.unhandled_error", { error: "Something broke" });
			logger.flush();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					events: [{ level: "error", event: "request.unhandled_error", error: "Something broke" }],
				}),
			);
		});
	});

	describe("flush", () => {
		test("includes timestamp, id, and duration", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					id: "test-uuid-1234",
					timestamp: expect.any(Number),
					duration: expect.any(Number),
				}),
			);
		});

		test("omits empty scopes", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			// Only log to one scope
			logger.loader("$team").info("team.loaded");
			logger.flush();

			let calledWith = consoleInfoSpy.mock.calls[0]?.[1] as Record<string, unknown>;

			expect(calledWith.loaders).toBeDefined();
			expect(calledWith.middleware).toBeUndefined();
			expect(calledWith.action).toBeUndefined();
			expect(calledWith.render).toBeUndefined();
			expect(calledWith.events).toBeUndefined();
		});

		test("omits subject/profile/billing if not set", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.flush();

			let calledWith = consoleInfoSpy.mock.calls[0]?.[1] as Record<string, unknown>;

			expect(calledWith.subject).toBeUndefined();
			expect(calledWith.profile).toBeUndefined();
			expect(calledWith.billing).toBeUndefined();
		});

		test("uses console.error if any scope has error", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.middleware("auth").info("auth.start");
			logger.loader("$team").error("team.not_found");
			logger.flush();

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleInfoSpy).not.toHaveBeenCalled();
		});

		test("uses console.error if unscoped has error", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.error("request.failed");
			logger.flush();

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleInfoSpy).not.toHaveBeenCalled();
		});

		test("uses console.info if no errors", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.middleware("auth").info("auth.complete");
			logger.loader("$team").info("team.loaded");
			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		test("formats identifier as METHOD URL STATUS", () => {
			let request = new Request("https://example.com/api/test", { method: "POST" });
			let logger = new Logger(request);

			let response = new Response(null, { status: 201 });
			logger.response = response;

			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"POST https://example.com/api/test 201",
				expect.any(Object),
			);
		});

		test("shows ??? for status when no response set", () => {
			let request = new Request("https://example.com/test");
			let logger = new Logger(request);

			logger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"GET https://example.com/test ???",
				expect.any(Object),
			);
		});
	});
});
