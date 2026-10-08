/**
 * Drives GitHub's sponsorship webhook through the real router inside workerd, against the
 * local queue binding: only a delivery signed with the hook's secret is acted on, and a
 * signed `sponsorship` event is the one that queues a roster refresh.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hmac, Hex } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";
const SECRET = "sponsors-webhook-secret";

/** A full `App.Env` over the real bindings, with the hook's secret set to {@link SECRET}. */
function environment(overrides: Partial<App.Env> = {}): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		GITHUB_SPONSORS_WEBHOOK_SECRET: SECRET,
		waitUntil: () => {},
		...overrides,
	};
}

/**
 * Posts a delivery of `event` signed with `secret`, as GitHub sends one.
 *
 * @param event The `X-GitHub-Event` it reports.
 * @param options The secret its signature is made with, and the environment it reaches.
 */
async function deliver(
	event: string,
	options: { secret?: string; env?: Partial<App.Env> } = {},
): Promise<Response> {
	let body = JSON.stringify({ action: "created" });
	let signature = Hex.encode(unwrap(await hmac.sign(options.secret ?? SECRET, body)));

	return await createApplication(environment(options.env)).fetch(
		new Request(new URL("/webhooks/sponsors", ORIGIN), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-github-event": event,
				"x-hub-signature-256": `sha256=${signature}`,
			},
			body,
		}),
	);
}

describe("POST /webhooks/sponsors", () => {
	test("queues a roster refresh on a signed sponsorship event", async () => {
		let response = await deliver("sponsorship");
		expect(response.status).toBe(202);
	});

	test("acknowledges the ping GitHub sends when the hook is created", async () => {
		let response = await deliver("ping");
		expect(response.status).toBe(204);
	});

	test("refuses a delivery signed with another secret", async () => {
		let response = await deliver("sponsorship", { secret: "someone-else" });
		expect(response.status).toBe(401);
	});

	test("refuses every delivery while no secret is configured", async () => {
		let response = await deliver("sponsorship", {
			env: { GITHUB_SPONSORS_WEBHOOK_SECRET: undefined },
		});
		expect(response.status).toBe(401);
	});
});
