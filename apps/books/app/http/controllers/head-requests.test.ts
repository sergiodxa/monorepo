/**
 * Tests that the router answers `HEAD` wherever it answers `GET`. The behaviour lives
 * in the shared middleware and is covered there; what these assert is that the funnel's
 * router actually installs it, because an uptime monitor probing with `HEAD` is exactly
 * the caller that would otherwise read a healthy page as a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { fetchApp } from "~/app/lib/test/router";

describe("HEAD requests", () => {
	test("answers a HEAD with the GET's status and headers and no body", async () => {
		let get = await fetchApp("/healthcheck");
		let head = await fetchApp("/healthcheck", { method: "HEAD" });

		expect(head.status).toBe(get.status);
		expect(head.headers.get("content-type")).toBe(get.headers.get("content-type"));
		expect(await head.text()).toBe("");
	});

	test("answers a HEAD to the rendered home page", async () => {
		let response = await fetchApp("/", { method: "HEAD" });

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(await response.text()).toBe("");
	});

	test("still 404s a HEAD to a path whose route has no GET", async () => {
		let response = await fetchApp("/webhooks/polar", { method: "HEAD" });

		expect(response.status).toBe(404);
	});
});
