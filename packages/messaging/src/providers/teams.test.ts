/**
 * Exercises `TeamsWorkflow` over MSW against a Workflows webhook's real answers: the
 * Adaptive Card envelope, the empty `202`, `gone` for a deleted workflow, the DNS check,
 * and that no error carries the URL's signature.
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

import { TeamsWorkflow } from "./teams.js";

/** The webhook path MSW matches, which ignores the query. */
const WORKFLOW_PATH =
	"https://prod-00.westus.logic.azure.com/workflows/abc123/triggers/manual/paths/invoke";

const WORKFLOW_URL = `${WORKFLOW_PATH}?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=secret-signature`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every post with the empty `202` Workflows sends, recording each body. */
function acceptWorkflow(bodies: unknown[] = []) {
	server.use(
		http.post(WORKFLOW_PATH, async ({ request }) => {
			bodies.push(await request.json());
			return new HttpResponse(null, { status: 202 });
		}),
	);
	return bodies;
}

/** Answers every DNS-over-HTTPS lookup with the given address for `A` and nothing for `AAAA`. */
function resolvingTo(address: string) {
	server.use(
		http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
			let url = new URL(request.url);
			let asksA = url.searchParams.get("type") === "A";
			return HttpResponse.json({
				Status: 0,
				Answer: asksA
					? [{ name: url.searchParams.get("name"), type: 1, TTL: 60, data: address }]
					: [],
			});
		}),
	);
}

const MESSAGE: Message = {
	title: "api.example.com is down",
	text: "Timed out from **gru** after `30s`.",
	severity: "critical",
	fields: [{ label: "Region", value: "gru_1", inline: true }],
	links: [{ label: "Open dashboard", url: "https://uptime.example.com/m/1" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
};

describeDestination({
	name: "TeamsWorkflow",
	capabilities: [],
	create: () => {
		acceptWorkflow();
		return new TeamsWorkflow({ url: WORKFLOW_URL });
	},
	rateLimitNext: (delayMs) =>
		server.use(
			http.post(
				WORKFLOW_PATH,
				() =>
					HttpResponse.json(
						{ error: { code: "WorkflowTriggerIsThrottled" } },
						{ status: 429, headers: { "Retry-After": String(delayMs / 1000) } },
					),
				{ once: true },
			),
		),
});

describe("TeamsWorkflow", () => {
	test("posts an Adaptive Card in the message envelope", async () => {
		let bodies = acceptWorkflow();

		let sent = await new TeamsWorkflow({ url: WORKFLOW_URL }).send(MESSAGE);

		expect(isSuccess(sent) && sent.data.ref).toBeNull();
		expect(bodies[0]).toEqual({
			type: "message",
			attachments: [
				{
					contentType: "application/vnd.microsoft.card.adaptive",
					contentUrl: null,
					content: {
						$schema: "http://adaptivecards.io/schemas/adaptive-card.json",
						type: "AdaptiveCard",
						version: "1.4",
						body: [
							{
								type: "Container",
								style: "attention",
								bleed: true,
								items: [
									{
										type: "TextBlock",
										text: "api.example.com is down",
										weight: "Bolder",
										size: "Medium",
										wrap: true,
									},
								],
							},
							{ type: "TextBlock", text: "Timed out from **gru** after 30s.", wrap: true },
							{ type: "FactSet", facts: [{ title: "Region", value: "gru\\_1" }] },
							{
								type: "TextBlock",
								text: "{{DATE(2026-10-06T12:00:00Z, SHORT)}} {{TIME(2026-10-06T12:00:00Z)}}",
								isSubtle: true,
								size: "Small",
								wrap: true,
							},
						],
						actions: [
							{
								type: "Action.OpenUrl",
								title: "Open dashboard",
								url: "https://uptime.example.com/m/1",
							},
						],
					},
				},
			],
		});
	});

	test.each([
		["info", "emphasis"],
		["success", "good"],
		["warning", "warning"],
		["critical", "attention"],
	] as const)("draws a %s header in the %s style", (severity, style) => {
		let payload = new TeamsWorkflow({ url: WORKFLOW_URL }).render({ title: "t", severity });

		expect(payload.attachments[0].content.body[0]).toMatchObject({ style });
		expect(payload.attachments[0].content.actions).toBeUndefined();
	});

	test.each([
		[404, "gone"],
		[401, "unauthorized"],
		[403, "unauthorized"],
		[400, "rejected"],
		[503, "unavailable"],
	])("maps a %i answer to %s, never naming the signature", async (status, code) => {
		server.use(
			http.post(WORKFLOW_PATH, () =>
				HttpResponse.json({ error: { code: "Failure", message: "nope" } }, { status }),
			),
		);

		let sent = await new TeamsWorkflow({ url: WORKFLOW_URL }).send(MESSAGE);

		expect(isFailure(sent)).toBe(true);
		if (!isFailure(sent)) return;
		expect(sent.error.code).toBe(code);
		expect(sent.error.status).toBe(status);
		expect(sent.error.host).toBe("prod-00.westus.logic.azure.com");
		expect(sent.error.message).not.toContain("secret-signature");
	});

	test("refuses a private or plain-HTTP URL before any request", async () => {
		let sent = await new TeamsWorkflow({ url: "https://127.0.0.1/workflows/x" }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
		expect(isFailure(TeamsWorkflow.check("https://intranet.local/workflows/x"))).toBe(true);
		expect(isSuccess(TeamsWorkflow.check(WORKFLOW_URL))).toBe(true);
	});

	test("with resolve, refuses a host that resolves to a private address", async () => {
		resolvingTo("10.0.0.1");

		let sent = await new TeamsWorkflow({ url: WORKFLOW_URL, resolve: true }).send(MESSAGE);

		expect(isFailure(sent) && sent.error.code).toBe("invalid-destination");
	});

	test("with resolve, sends to a host that resolves to a public address", async () => {
		resolvingTo("20.42.0.1");
		let bodies = acceptWorkflow();

		let sent = await new TeamsWorkflow({ url: WORKFLOW_URL, resolve: true }).send(MESSAGE);

		expect(isSuccess(sent)).toBe(true);
		expect(bodies).toHaveLength(1);
	});
});
