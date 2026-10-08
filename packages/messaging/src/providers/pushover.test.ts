/**
 * Exercises the Pushover destination over MSW against Pushover's real answers: the
 * form with its HTML message and priority, emergency priority only when configured,
 * invalid token and user keys as `unauthorized`, and that no failure carries either.
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

import { Pushover } from "./pushover.js";

const ENDPOINT = "https://api.pushover.net/1/messages.json";

const TOKEN = "azGDORePK8gMaC0QOYAMyEEuzJnyUi";

const USER = "uQiRzpo4DXghDmr9QzzfQu27cmVRsG";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every post the way Pushover accepts one, recording each form. */
function acceptMessage(forms: URLSearchParams[] = []) {
	server.use(
		http.post(ENDPOINT, async ({ request }) => {
			forms.push(new URLSearchParams(await request.text()));
			return HttpResponse.json({ status: 1, request: "647d2300-702c-4b38-8b2f-d56326ae460b" });
		}),
	);
	return forms;
}

const MESSAGE: Message = {
	title: "api.acme.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "<gru>", inline: true }],
	links: [
		{ label: "Open dashboard", url: "https://uptime.acme.com/m/1" },
		{ label: "Runbook", url: "https://wiki.acme.com/api" },
	],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
};

describeDestination({
	name: "Pushover",
	capabilities: [],
	create: () => {
		acceptMessage();
		return new Pushover({ token: TOKEN, user: USER });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				ENDPOINT,
				() =>
					HttpResponse.json(
						{ status: 0, errors: ["application has exceeded its monthly limit"] },
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("Pushover", () => {
	test("posts the form with an HTML message, priority and first link", async () => {
		let forms = acceptMessage();

		let sent = await new Pushover({ token: () => TOKEN, user: USER, sound: "siren" }).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toBeNull();
		expect(Object.fromEntries(forms[0] ?? [])).toEqual({
			token: TOKEN,
			user: USER,
			title: "api.acme.com is down",
			message: "Timed out from <b>gru</b> after 30s.\n\n<b>Region</b>: &lt;gru&gt;",
			html: "1",
			priority: "1",
			timestamp: "1791288000",
			url: "https://uptime.acme.com/m/1",
			url_title: "Open dashboard",
			sound: "siren",
		});
	});

	test.each([
		["info", "0"],
		["success", "0"],
		["warning", "0"],
		["critical", "1"],
	] as const)("writes %s as priority %s", (severity, priority) => {
		let payload = new Pushover({ token: TOKEN, user: USER }).render({ title: "Check", severity });

		expect(payload).toStrictEqual({ title: "Check", message: "Check", html: "1", priority });
	});

	test("uses emergency priority only for a critical message when configured", () => {
		let pushover = new Pushover({
			token: TOKEN,
			user: USER,
			device: "phone",
			emergency: { retry: 60, expire: 3600 },
		});

		expect(pushover.render({ title: "Down", severity: "critical" })).toMatchObject({
			priority: "2",
			retry: "60",
			expire: "3600",
			device: "phone",
		});
		let warning = pushover.render({ title: "Slow", severity: "warning" });
		expect(warning.priority).toBe("0");
		expect(warning.retry).toBeUndefined();
	});

	test("fits the title and message to Pushover's limits, keeping the fields", () => {
		let payload = new Pushover({ token: TOKEN, user: USER }).render({
			title: "t".repeat(400),
			text: "word ".repeat(500),
			fields: [{ label: "Region", value: "gru" }],
		});

		expect(payload.title.length).toBeLessThanOrEqual(250);
		expect(payload.message.length).toBeLessThanOrEqual(1024);
		expect(payload.message).toMatch(/…\n\n<b>Region<\/b>: gru$/u);
	});

	test.each([
		[{ token: "invalid", errors: ["application token is invalid"], status: 0 }, "unauthorized"],
		[{ user: "invalid", errors: ["user identifier is invalid"], status: 0 }, "unauthorized"],
		[{ device: "invalid", errors: ["device name is not valid"], status: 0 }, "rejected"],
	])("maps a 400 answering %j to %s, never naming the credentials", async (body, code) => {
		server.use(http.post(ENDPOINT, () => HttpResponse.json(body, { status: 400 })));

		let sent = await new Pushover({ token: TOKEN, user: USER }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.status).toBe(400);
		expect(sent.error.host).toBe("api.pushover.net");
		expect(sent.error.message).not.toContain(TOKEN);
		expect(sent.error.message).not.toContain(USER);
	});

	test("maps a 5xx to unavailable", async () => {
		server.use(http.post(ENDPOINT, () => new HttpResponse("oops", { status: 503 })));

		let sent = await new Pushover({ token: TOKEN, user: USER }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("unavailable");
		expect(isFailure(sent) && sent.error.retryable).toBe(true);
	});

	test("fails a redirect without following it", async () => {
		server.use(
			http.post(
				ENDPOINT,
				() => new HttpResponse(null, { status: 302, headers: { Location: "https://evil.com/" } }),
			),
		);

		let sent = await new Pushover({ token: TOKEN, user: USER }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("rejected");
	});
});
