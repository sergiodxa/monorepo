/**
 * Drives `/sponsors` and the short `/sponsor` link through the real router inside workerd,
 * over the local `CACHE` namespace: the pitch and every way to sponsor always draw, and each
 * sponsor list draws only when the stored roster names someone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, test } from "vitest";

import type { SponsorRoster } from "~/app/services/sponsors";

import { SPONSORS_CACHE_KEY } from "~/app/services/sponsors";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

/** Requests `path` from a fresh application. */
function request(path: string) {
	return createApplication(environment()).fetch(new Request(new URL(path, ORIGIN)));
}

/** A sponsor whose every field is derived from their login. */
function sponsor(login: string) {
	return {
		login,
		name: `${login} the sponsor`,
		avatarUrl: `https://avatars.example.test/${login}`,
		url: `https://github.com/${login}`,
	};
}

/** Stores `roster` where the page reads it. */
async function store(roster: SponsorRoster) {
	await new WorkerKVCache(env.CACHE).write(SPONSORS_CACHE_KEY, roster);
}

beforeEach(async () => {
	await env.CACHE.delete(SPONSORS_CACHE_KEY);
});

describe("GET /sponsors", () => {
	test("makes the case and offers every way to sponsor while no sponsor is known", async () => {
		let response = await request("/sponsors");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('href="https://github.com/sponsors/sergiodxa"');
		expect(body).toContain('href="https://www.paypal.com/paypalme/sergiodxa/5USD"');
		expect(body).toContain('href="https://www.paypal.com/paypalme/sergiodxa/20USD"');
		expect(body).toContain('href="https://ko-fi.com/sergiodxa"');
		expect(body.replace(/<[^>]+>/g, "")).toContain(
			"Send $5, $10 or $20 through PayPal, or any amount on Ko-fi.",
		);
		expect(body).not.toContain("Current sponsors");
		expect(body).not.toContain("Past sponsors");
	});

	test("names current sponsors and lists past ones by picture", async () => {
		await store({ current: [sponsor("ada"), sponsor("alan")], past: [sponsor("grace")] });

		let body = await (await request("/sponsors")).text();
		let current = body.slice(body.indexOf("Current sponsors"), body.indexOf("Past sponsors"));
		let past = body.slice(body.indexOf("Past sponsors"));

		expect(current).toContain("ada the sponsor");
		expect(current).toContain('href="https://github.com/alan"');
		expect(past).toContain('aria-label="grace the sponsor"');
		expect(past).toContain("https://avatars.example.test/grace");
	});

	test("leaves out the past list while every sponsor is current", async () => {
		await store({ current: [sponsor("ada")], past: [] });

		let body = await (await request("/sponsors")).text();

		expect(body).toContain("Current sponsors");
		expect(body).not.toContain("Past sponsors");
	});
});

describe("GET /sponsor", () => {
	test("redirects the short link to the sponsors page", async () => {
		let response = await request("/sponsor");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/sponsors");
	});
});
