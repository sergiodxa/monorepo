/**
 * Unit tests for the URL rules in {@link "./urls"}: the serving host is always replaced
 * by the configured origin, the trailing slash survives only at the root, and a query
 * string is passed through untouched. These are the rules a canonical link regression
 * would silently break, so each one is pinned here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { absoluteUrl, canonicalUrl, normalizeBaseUrl } from "./urls";

const BASE_URL = "https://example.com";

describe("normalizeBaseUrl", () => {
	test("drops a trailing slash", () => {
		expect(normalizeBaseUrl("https://example.com/")).toBe("https://example.com");
	});

	test("accepts a URL instance", () => {
		expect(normalizeBaseUrl(new URL("https://example.com"))).toBe("https://example.com");
	});

	test("keeps a non-default port", () => {
		expect(normalizeBaseUrl("http://localhost:8787/")).toBe("http://localhost:8787");
	});
});

describe("canonicalUrl", () => {
	test("forces the configured origin over a preview host", () => {
		expect(canonicalUrl(BASE_URL, "https://example-preview.workers.dev/features/monitors")).toBe(
			"https://example.com/features/monitors",
		);
	});

	test("forces the configured origin over a custom domain", () => {
		expect(canonicalUrl(BASE_URL, "https://status.customer.dev/pricing")).toBe(
			"https://example.com/pricing",
		);
	});

	test("drops the trailing slash", () => {
		expect(canonicalUrl(BASE_URL, "https://preview.workers.dev/features/monitors/")).toBe(
			"https://example.com/features/monitors",
		);
	});

	test("keeps the trailing slash at the root", () => {
		expect(canonicalUrl(BASE_URL, "https://preview.workers.dev/")).toBe("https://example.com/");
	});

	test("preserves the query string", () => {
		expect(canonicalUrl(BASE_URL, "https://preview.workers.dev/docs?section=alerts&page=2")).toBe(
			"https://example.com/docs?section=alerts&page=2",
		);
	});

	test("keeps a trailing slash that sits before the query string", () => {
		// The slash is only dropped when it is the resolved URL's last character, so a
		// query string leaves the path exactly as the request had it.
		expect(canonicalUrl(BASE_URL, "https://preview.workers.dev/docs/?section=alerts")).toBe(
			"https://example.com/docs/?section=alerts",
		);
	});

	test("resolves a root-relative path", () => {
		expect(canonicalUrl(BASE_URL, "/features/monitors/")).toBe(
			"https://example.com/features/monitors",
		);
	});

	test("accepts a URL instance", () => {
		expect(canonicalUrl(BASE_URL, new URL("https://preview.workers.dev/about/"))).toBe(
			"https://example.com/about",
		);
	});

	test("drops the hash, which is never part of a canonical URL", () => {
		expect(canonicalUrl(BASE_URL, "https://preview.workers.dev/docs#alerts")).toBe(
			"https://example.com/docs",
		);
	});
});

describe("absoluteUrl", () => {
	test("resolves a root-relative asset path", () => {
		expect(absoluteUrl(BASE_URL, "/og/cover.png")).toBe("https://example.com/og/cover.png");
	});

	test("leaves an already-absolute URL alone", () => {
		expect(absoluteUrl(BASE_URL, "https://cdn.example.net/cover.png")).toBe(
			"https://cdn.example.net/cover.png",
		);
	});

	test("keeps a trailing slash, since an asset URL is not a page URL", () => {
		expect(absoluteUrl(BASE_URL, "/downloads/")).toBe("https://example.com/downloads/");
	});
});
