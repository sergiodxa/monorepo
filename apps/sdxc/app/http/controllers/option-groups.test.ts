/**
 * Tests for the option group a page renders from the reader's cookie. The point of
 * reading it on the server is that the first paint is already the reader's choice, so
 * these assertions are against the markup a request answers with rather than against
 * what a script would do to it afterwards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/lib/test/router";

/** What a browser sends once the reader has switched the strip to bun. */
const CHOSE_BUN = { cookie: "sdxc:options=package-manager%3Abun" };

/**
 * The control standing for one option, as the page rendered it.
 *
 * @param body - The rendered page.
 * @param option - The option the control stands for.
 * @returns The `input` element's markup.
 */
function control(body: string, option: string): string {
	let match = body.match(new RegExp(`<input[^>]*data-option-value="${option}"[^>]*>`));
	expect(match).not.toBeNull();
	return match?.[0] ?? "";
}

describe("the package manager group", () => {
	test("renders the reader's manager checked on the landing page", async () => {
		let body = await (await fetchApp("/", { headers: CHOSE_BUN })).text();

		expect(control(body, "bun")).toContain("checked");
		expect(control(body, "npm")).not.toContain("checked");
	});

	test("renders the reader's manager checked on a package page", async () => {
		let body = await (await fetchApp("/api/result", { headers: CHOSE_BUN })).text();

		expect(control(body, "bun")).toContain("checked");
		expect(control(body, "npm")).not.toContain("checked");
	});

	test("renders the first option for a reader who has chosen nothing", async () => {
		let body = await (await fetchApp("/")).text();

		expect(control(body, "npm")).toContain("checked");
		expect(control(body, "bun")).not.toContain("checked");
	});

	test("renders the first option for a cookie naming something this site does not offer", async () => {
		let headers = { cookie: "sdxc:options=package-manager%3Adeno|editor%3Avim" };
		let body = await (await fetchApp("/", { headers })).text();

		expect(control(body, "npm")).toContain("checked");
	});

	test("renders the first option for a cookie that will not decode", async () => {
		let response = await fetchApp("/", { headers: { cookie: "sdxc:options=%%broken" } });
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(control(body, "npm")).toContain("checked");
	});

	test("leaves a strip that names no group out of it", async () => {
		let body = await (await fetchApp("/", { headers: CHOSE_BUN })).text();

		expect(body.match(/data-option-value=/g)).toHaveLength(4);
		expect(body.match(/data-option-group=/g)).toHaveLength(1);
	});
});

describe("caching a page the reader has chosen on", () => {
	test("keeps a page rendered from a choice out of shared caches", async () => {
		let response = await fetchApp("/api/result", { headers: CHOSE_BUN });
		let plain = await fetchApp("/api/result");

		expect(response.headers.get("Vary")?.toLowerCase()).toContain("cookie");
		expect(response.headers.get("ETag")).not.toBe(plain.headers.get("ETag"));
	});
});
