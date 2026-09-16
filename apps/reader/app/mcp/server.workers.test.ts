/**
 * Drives the agent endpoint inside workerd, through the bindings this app's wrangler config
 * declares: the real `USER` namespace, the real rate limiter, and the secret a token is
 * signed under.
 *
 * What only the deployment can show is asserted here — that the limiter the endpoint is
 * bounded by exists and counts the token that arrived rather than the address it came from,
 * and that one agent's burst leaves another's alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { AGENT_RATE_LIMIT } from "~/app/mcp/rate-limit";
import { mintAgentToken } from "~/app/mcp/token";
import application from "~/bootstrap/app";
import { TOKEN_LIFETIME_MS } from "~/database/schema";
import { userStore } from "~/database/user-do";

const ENDPOINT = "https://reader.sergiodxa.com/mcp";

/** A subject no other test in this file uses, since object storage outlives a test. */
function subject(): string {
	return `sub-${crypto.randomUUID()}`;
}

/** The router under test, built the way the worker builds it. */
function app() {
	return application({ kv: env.KV, cookieSecret: "test-cookie-secret", secure: false });
}

/** Puts a reader on the paid tier and mints a token they hold, returning its value. */
async function tokenFor(name: string): Promise<string> {
	let store = userStore(name);

	await store.setTier({
		entitled: "paid",
		cancelled: false,
		readAt: Date.now(),
		source: "billing",
	});

	let minted = await mintAgentToken(name);

	let written = await store.createAgentToken({
		id: minted.tokenId,
		name: "Laptop",
		scope: "read",
		hash: minted.hash,
	});

	if (!written.ok) throw new Error(`the token was refused: ${written.reason}`);
	expect(written.token.expiresAt - written.token.createdAt).toBe(TOKEN_LIFETIME_MS);

	return minted.token;
}

/** One `tools/list`, which is the cheapest request the endpoint answers. */
function listRequest(token: string): Request {
	return new Request(ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
			"Mcp-Method": "tools/list",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/list",
			params: {
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

describe("the deployment", () => {
	test("declares the limiter the endpoint is bounded by", () => {
		expect(env.MCP_RATE_LIMITER).toBeDefined();
	});

	test("declares the key a token is signed under", () => {
		expect(typeof env.AGENT_TOKEN_SECRET).toBe("string");
		expect(env.AGENT_TOKEN_SECRET.length).toBeGreaterThan(0);
	});

	test("answers a token minted against the real object it names", async () => {
		let token = await tokenFor(subject());
		let response = await app().fetch(listRequest(token));

		expect(response.status).toBe(200);
	});
});

describe("the burst budget", () => {
	/**
	 * Keyed on the token rather than on the address: every request in this file arrives from
	 * the same place, so a bucket keyed on the address would refuse the second token too.
	 */
	test("refuses past the minute's allowance, and leaves another token alone", async () => {
		let router = app();
		let spender = await tokenFor(subject());
		let bystander = await tokenFor(subject());

		let refused = 0;
		for (let attempt = 0; attempt <= AGENT_RATE_LIMIT; attempt++) {
			let response = await router.fetch(listRequest(spender));
			if (response.status === 429) refused++;
		}

		expect(refused).toBeGreaterThan(0);

		let other = await router.fetch(listRequest(bystander));
		expect(other.status).toBe(200);
	});
});
