/**
 * Exercises the monitor ping as the client it is: the request it sends, and the three
 * failures it reports rather than throws — a service that refused, one that never answered,
 * and a token that never arrived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { createUptimeReporter } from "./uptime.js";

const UPTIME_URL = "https://uptime.sergiodxa.com";
const MONITOR_ID = "monitor-1";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createUptimeReporter()", () => {
	test("posts the monitor's ping with the token it resolved", async () => {
		let seen = vi.fn();

		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, ({ request }) => {
				seen(request.headers.get("Authorization"));
				return HttpResponse.json({ ok: true });
			}),
		);

		let uptime = createUptimeReporter({ token: () => "token-1" });

		expect(isSuccess(await uptime(MONITOR_ID))).toBe(true);
		expect(seen).toHaveBeenCalledWith("Bearer token-1");
	});

	test("resolves the token per call, so one rotated between runs is picked up", async () => {
		let tokens = ["first", "second"];
		let seen: (string | null)[] = [];

		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, ({ request }) => {
				seen.push(request.headers.get("Authorization"));
				return HttpResponse.json({ ok: true });
			}),
		);

		let uptime = createUptimeReporter({ token: () => tokens.shift() });

		await uptime(MONITOR_ID);
		await uptime(MONITOR_ID);

		expect(seen).toEqual(["Bearer first", "Bearer second"]);
	});

	test("reaches a service the caller named instead of the default", async () => {
		let seen = vi.fn();

		server.use(
			http.post(`https://uptime.example.com/api/v1/cron-jobs/${MONITOR_ID}/ping`, () => {
				seen();
				return HttpResponse.json({ ok: true });
			}),
		);

		let uptime = createUptimeReporter({
			token: () => "token-1",
			url: new URL("https://uptime.example.com"),
		});

		expect(isSuccess(await uptime(MONITOR_ID))).toBe(true);
		expect(seen).toHaveBeenCalled();
	});

	test("reports a service that refused, carrying the status it refused with", async () => {
		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, () =>
				HttpResponse.text("nope", { status: 500 }),
			),
		);

		let uptime = createUptimeReporter({ token: () => "token-1" });
		let result = await uptime(MONITOR_ID);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.code).toBe("refused");
			expect(result.error.status).toBe(500);
			expect(result.error.monitorId).toBe(MONITOR_ID);
		}
	});

	test("reports a ping that never got an answer", async () => {
		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, () => HttpResponse.error()),
		);

		let uptime = createUptimeReporter({ token: () => "token-1" });
		let result = await uptime(MONITOR_ID);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("unreachable");
	});

	test("sends nothing and says so when no token resolved", async () => {
		let uptime = createUptimeReporter({ token: () => undefined });
		let result = await uptime(MONITOR_ID);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("unconfigured");
	});
});
