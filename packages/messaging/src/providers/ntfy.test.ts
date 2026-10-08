/**
 * Exercises the ntfy destination over MSW: the JSON publish body with its priority,
 * tags and view actions, the bearer token, a self-hosted server under a path, the
 * error mapping, and that no failure carries the token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Message } from "../message.js";

import { describeDestination } from "../conformance.js";

import { Ntfy } from "./ntfy.js";

const TOKEN = "tk_secret-token";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** One publish as the server saw it. */
interface Received {
	headers: Headers;
	body: unknown;
}

/** Answers every publish to `url` the way ntfy does, recording each request. */
function acceptPublish(url = "https://ntfy.sh/", received: Received[] = []) {
	server.use(
		http.post(url, async ({ request }) => {
			received.push({ headers: request.headers, body: await request.json() });
			return HttpResponse.json({ id: "sPs71M8A2T", time: 1791288000, event: "message" });
		}),
	);
	return received;
}

const MESSAGE: Message = {
	title: "api.acme.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [
		{ label: "Region", value: "gru_*1*", inline: true },
		{ label: "Status", value: "timeout" },
	],
	links: [
		{ label: "Open dashboard", url: "https://uptime.acme.com/m/1" },
		{ label: "Runbook", url: "https://wiki.acme.com/api" },
		{ label: "Status page", url: "https://status.acme.com/" },
		{ label: "Logs", url: "https://logs.acme.com/api" },
	],
};

describeDestination({
	name: "Ntfy",
	capabilities: [],
	create: () => {
		acceptPublish();
		return new Ntfy({ topic: "alerts" });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				"https://ntfy.sh/",
				() =>
					HttpResponse.json(
						{ code: 42901, http: 429, error: "limit reached: too many requests" },
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("Ntfy", () => {
	test("publishes Markdown with the priority, tags and view actions", async () => {
		let received = acceptPublish();

		let sent = await new Ntfy({ topic: "alerts" }).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toBeNull();
		expect(received[0]?.headers.get("content-type")).toBe("application/json");
		expect(received[0]?.headers.has("authorization")).toBe(false);
		expect(received[0]?.body).toEqual({
			topic: "alerts",
			title: "api.acme.com is down",
			message: [
				"Timed out from **gru** after `30s`.",
				"",
				"- **Region**: gru\\_\\*1\\*",
				"- **Status**: timeout",
				"- [Logs](https://logs.acme.com/api)",
			].join("\n"),
			markdown: true,
			priority: 5,
			tags: ["rotating_light"],
			click: "https://uptime.acme.com/m/1",
			actions: [
				{ action: "view", label: "Open dashboard", url: "https://uptime.acme.com/m/1" },
				{ action: "view", label: "Runbook", url: "https://wiki.acme.com/api" },
				{ action: "view", label: "Status page", url: "https://status.acme.com/" },
			],
		});
	});

	test.each([
		["info", 3, undefined],
		["success", 3, ["white_check_mark"]],
		["warning", 4, ["warning"]],
		["critical", 5, ["rotating_light"]],
	] as const)("writes %s as priority %i", (severity, priority, tags) => {
		let payload = new Ntfy({ topic: "alerts" }).render({ title: "Check", severity });

		expect(payload.priority).toBe(priority);
		expect(payload.tags).toEqual(tags);
		expect(payload.message).toBe("Check");
		expect(payload.actions).toEqual([]);
		expect(payload.click).toBeUndefined();
	});

	test("cuts a long text to ntfy's message limit, keeping the fields", () => {
		let payload = new Ntfy({ topic: "alerts" }).render({
			title: "Long",
			text: "word ".repeat(2000),
			fields: [{ label: "Region", value: "gru" }],
		});

		expect(payload.message.length).toBeLessThanOrEqual(4096);
		expect(payload.message).toMatch(/…\n\n- \*\*Region\*\*: gru$/u);
	});

	test("publishes to a self-hosted server under its path with a bearer token", async () => {
		let received = acceptPublish("https://push.acme.com/ntfy/");

		let sent = await new Ntfy({
			topic: "alerts",
			server: "https://push.acme.com/ntfy",
			token: () => TOKEN,
		}).send(MESSAGE);

		expect(isSuccess(sent)).toBe(true);
		expect(received[0]?.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
	});

	test.each([
		[401, "unauthorized"],
		[403, "unauthorized"],
		[404, "gone"],
		[413, "rejected"],
		[507, "unavailable"],
	])("maps a %i answer to %s, never naming the token", async (status, code) => {
		server.use(
			http.post("https://ntfy.sh/", () =>
				HttpResponse.json({ code: status * 100 + 1, http: status, error: "refused" }, { status }),
			),
		);

		let sent = await new Ntfy({ topic: "alerts", token: TOKEN }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.host).toBe("ntfy.sh");
		expect(sent.error.message).not.toContain(TOKEN);
	});

	test("fails a redirect without following it", async () => {
		server.use(
			http.post(
				"https://ntfy.sh/",
				() => new HttpResponse(null, { status: 301, headers: { Location: "https://evil.com/" } }),
			),
		);

		let sent = await new Ntfy({ topic: "alerts" }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("rejected");
	});

	test("refuses a private or reserved server before any request", async () => {
		let sent = await new Ntfy({ topic: "alerts", server: "http://127.0.0.1/" }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(isFailure(Ntfy.check("http://ntfy.local/"))).toBe(true);
		expect(isSuccess(Ntfy.check("https://ntfy.sh"))).toBe(true);
	});
});
