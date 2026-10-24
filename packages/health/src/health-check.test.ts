/**
 * Tests for `HealthCheck`: how each kind of probe outcome becomes a check, how a dependency's
 * own health report is read, the report and response the checks add up to, and the log entry
 * every check that is not passing leaves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, success } from "@sdxc/result";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/** Stands in for the invocation's log, so a test can read what a check recorded. */
let warn = vi.fn();

vi.doMock("@sdxc/logger", () => ({ currentLog: () => ({ warn }) }));

let { HealthCheck } = await import("./health-check.js");

/** A response that declares itself a health report. */
function report(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/health+json" },
	});
}

beforeEach(() => {
	vi.useFakeTimers({ now: new Date("2026-10-24T12:00:00.000Z") });
	warn.mockClear();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("HealthCheck probes", () => {
	test.each([
		["undefined", undefined],
		["a value", { rows: 1 }],
		["a successful result", success(1)],
		["a 2xx response", new Response("ok")],
	])("passes a probe resolving to %s", async (_, value) => {
		let health = new HealthCheck().probe("db", () => value);

		let { checks } = await health.check();

		expect(checks).toEqual({
			"db:responseTime": [
				{ status: "pass", observedValue: 0, observedUnit: "ms", time: "2026-10-24T12:00:00.000Z" },
			],
		});
	});

	test.each([
		["a non-2xx response", () => new Response("down", { status: 502 }), "HTTP 502"],
		["a failed result", () => failure(new Error("no rows")), "error"],
		[
			"a rejection",
			() => {
				throw new Error("connection refused");
			},
			"error",
		],
	])("fails a probe resolving to %s", async (_, probe, output) => {
		let health = new HealthCheck().probe("db", probe);

		let { checks } = await health.check();

		expect(checks?.["db:responseTime"]?.[0]).toMatchObject({ status: "fail", output });
	});

	test("exposes the error message only when configured to", async () => {
		let health = new HealthCheck({ exposeErrors: true }).probe("db", () => {
			throw new Error("connection refused");
		});

		let { checks } = await health.check();

		expect(checks?.["db:responseTime"]?.[0]?.output).toBe("connection refused");
	});

	test("fails a probe that outlasts its timeout, aborting the signal it was given", async () => {
		let signal: AbortSignal | undefined;
		let health = new HealthCheck({ timeout: 1_000 }).probe("slow", (_, given) => {
			signal = given;
			return new Promise(() => {});
		});

		let checked = health.check();
		await vi.advanceTimersByTimeAsync(1_000);
		let { checks } = await checked;

		expect(checks?.["slow:responseTime"]?.[0]).toMatchObject({
			status: "fail",
			output: "timeout",
			observedValue: 1_000,
		});
		expect(signal?.reason).toMatchObject({ name: "TimeoutError" });
	});

	test("reports a probe that rejects with its signal's reason as a timeout", async () => {
		let health = new HealthCheck().probe(
			"api",
			(_, signal) =>
				new Promise((_resolve, reject) => {
					signal.addEventListener("abort", () => reject(signal.reason));
				}),
			{ timeout: 50 },
		);

		let checked = health.check();
		await vi.advanceTimersByTimeAsync(50);

		expect((await checked).checks?.["api:responseTime"]?.[0]?.output).toBe("timeout");
	});

	test("reports a non-critical failure as warn", async () => {
		let health = new HealthCheck().probe("billing", () => new Response("", { status: 500 }), {
			critical: false,
		});

		let { status, checks } = await health.check();

		expect(status).toBe("warn");
		expect(checks?.["billing:responseTime"]?.[0]?.status).toBe("warn");
	});

	test("hands every probe the context", async () => {
		let health = new HealthCheck<{ ready: boolean }>().probe("ctx", (context) => {
			if (!context.ready) throw new Error("not ready");
		});

		expect((await health.check({ ready: true })).status).toBe("pass");
		expect((await health.check({ ready: false })).status).toBe("fail");
	});

	test("keeps descriptive fields, sending affectedEndpoints only while not passing", async () => {
		let options = {
			componentType: "datastore",
			componentId: "primary",
			links: { about: "https://status.example.com" },
			affectedEndpoints: ["/checkout"],
		};
		let passing = new HealthCheck().probe("db", () => undefined, options);
		let failing = new HealthCheck().probe("db", () => failure(new Error("x")), options);

		let [passed] = (await passing.check()).checks?.["db:responseTime"] ?? [];
		let [failed] = (await failing.check()).checks?.["db:responseTime"] ?? [];

		expect(passed).toMatchObject({ componentType: "datastore", componentId: "primary" });
		expect(passed).not.toHaveProperty("affectedEndpoints");
		expect(failed).toMatchObject({ affectedEndpoints: ["/checkout"], links: options.links });
	});

	test("replaces a probe registered under the same name", async () => {
		let health = new HealthCheck()
			.probe("db", () => failure(new Error("x")))
			.probe("db", () => undefined);

		expect((await health.check()).status).toBe("pass");
	});
});

describe("HealthCheck reading a dependency's report", () => {
	test.each([
		["fail on a 200", report({ status: "fail" }), "fail", "reported fail"],
		["fail on a 503", report({ status: "fail" }, 503), "fail", "reported fail"],
		["warn on a 200", report({ status: "warn" }), "warn", "reported warn"],
		["pass on a 503", report({ status: "pass" }, 503), "fail", "HTTP 503"],
		["an alias, DOWN, on a 200", report({ status: "DOWN" }), "fail", "reported fail"],
		["an unreadable report on a 503", report("nope", 503), "fail", "unreadable health report"],
	])("judges %s", async (_, response, status, output) => {
		let health = new HealthCheck().probe("auth", () => response);

		let [check] = (await health.check()).checks?.["auth:responseTime"] ?? [];

		expect(check).toMatchObject({ status, output });
	});

	test("passes an unreadable report on a 2xx, judged by its status code", async () => {
		let health = new HealthCheck().probe("auth", () => report({ healthy: true }));

		expect((await health.check()).status).toBe("pass");
	});

	test("keeps a dependency's warn a warn even when it is critical", async () => {
		let health = new HealthCheck().probe("auth", () => report({ status: "warn" }), {
			critical: true,
		});

		expect((await health.check()).status).toBe("warn");
	});

	test("copies the dependency's serviceId, and none of its checks", async () => {
		let upstream = {
			status: "fail",
			serviceId: "auth",
			output: "Checks not passing: database:responseTime",
			checks: { "database:responseTime": [{ status: "fail" }] },
		};
		let health = new HealthCheck().probe("auth", () => report(upstream));

		let { checks } = await health.check();

		expect(Object.keys(checks ?? {})).toEqual(["auth:responseTime"]);
		expect(checks?.["auth:responseTime"]?.[0]).toMatchObject({
			componentId: "auth",
			output: "reported fail",
		});
	});

	test("shows the dependency's own output when errors are exposed", async () => {
		let health = new HealthCheck({ exposeErrors: true }).probe("auth", () =>
			report({ status: "warn", output: "Checks not passing: polar:responseTime" }),
		);

		let [check] = (await health.check()).checks?.["auth:responseTime"] ?? [];

		expect(check?.output).toBe("Checks not passing: polar:responseTime");
	});

	test("treats a report over 64 KB as unreadable", async () => {
		let large = report({ status: "fail", notes: ["x".repeat(70_000)] });
		let health = new HealthCheck().probe("auth", () => large);

		expect((await health.check()).status).toBe("pass");
	});
});

describe("HealthCheck report and response", () => {
	test("reports pass with no checks failing, and the service's own fields", async () => {
		let health = new HealthCheck({
			serviceId: "shop",
			description: "The shop",
			version: "1",
			releaseId: "abc123",
			notes: ["Deployed from main"],
			links: { about: "https://docs.example.com" },
		});

		expect(await health.check()).toEqual({
			status: "pass",
			version: "1",
			releaseId: "abc123",
			serviceId: "shop",
			description: "The shop",
			notes: ["Deployed from main"],
			checks: {},
			links: { about: "https://docs.example.com" },
		});
	});

	test("takes the worst status and lists the checks not passing", async () => {
		let health = new HealthCheck()
			.probe("db", () => undefined)
			.probe("cache", () => failure(new Error("x")), { critical: false })
			.probe("queue", () => failure(new Error("x")));

		let { status, output } = await health.check();

		expect(status).toBe("fail");
		expect(output).toBe("Checks not passing: cache:responseTime, queue:responseTime");
	});

	test("answers 200 with the media type and freshness", async () => {
		let health = new HealthCheck({ maxAge: 30 }).probe("cache", () => failure(new Error("x")), {
			critical: false,
		});

		let response = await health.respond();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/health+json");
		expect(response.headers.get("Cache-Control")).toBe("max-age=30");
		expect(await response.json()).toMatchObject({ status: "warn" });
	});

	test("answers a fail with 503, or the configured status", async () => {
		let failing = () => failure(new Error("x"));

		expect((await new HealthCheck().probe("db", failing).respond()).status).toBe(503);
		expect((await new HealthCheck({ failStatus: 500 }).probe("db", failing).respond()).status).toBe(
			500,
		);
	});

	test("logs every check not passing with its error, whatever the report exposes", async () => {
		let health = new HealthCheck()
			.probe("db", () => {
				throw new Error("connection refused");
			})
			.probe("cache", () => undefined);

		await health.check();

		expect(warn).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalledWith("health.check_not_passing", {
			check: "db",
			status: "fail",
			output: "error",
			error: "connection refused",
		});
	});
});

describe("HealthCheck configuration", () => {
	test.each([[{ timeout: 0 }], [{ maxAge: -1 }], [{ failStatus: 200 }], [{ failStatus: 600 }]])(
		"refuses %o",
		(options) => {
			expect(() => new HealthCheck(options)).toThrow(RangeError);
		},
	);

	test("refuses a probe name with a colon, which would break the check key", () => {
		expect(() => new HealthCheck().probe("db:primary", () => undefined)).toThrow(RangeError);
	});
});
