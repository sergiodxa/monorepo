/**
 * Tests of the session row mapper: the user-agent token matching, the current-session
 * flag, and the staleness threshold — including the invariant that the session a request
 * arrived on is never called stale, since that request itself just touched it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { SessionWithClient } from "~/app/data/session";

import { parseUserAgent, toSessionRow } from "~/app/http/view-models/account-session";

/** A session row shaped as the database returns it, with epoch-ms timestamps. */
function session(overrides: Partial<SessionWithClient> = {}): SessionWithClient {
	return {
		id: "session-1",
		created_at: Date.now(),
		updated_at: Date.now(),
		expires_at: Date.now() + 1000,
		subject_id: "subject-1",
		client_id: "client-1",
		user_agent: null,
		ip_address: null,
		client: null,
		...overrides,
	} as SessionWithClient;
}

describe("parseUserAgent", () => {
	test("reads a missing header as unknown rather than hiding the row", () => {
		expect(parseUserAgent(null)).toEqual({
			browser: "Unknown",
			os: "Unknown",
			deviceType: "unknown",
		});
	});

	test("recognizes Chrome on macOS as a desktop", () => {
		let ua =
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

		expect(parseUserAgent(ua)).toEqual({
			browser: "Chrome",
			os: "macOS",
			deviceType: "desktop",
		});
	});

	test("does not call Chrome Safari, since Chrome carries a Safari token too", () => {
		let ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";

		expect(parseUserAgent(ua).browser).toBe("Chrome");
	});

	test("does not call Edge Chrome, since Edge carries a Chrome token too", () => {
		let ua =
			"Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0";

		expect(parseUserAgent(ua).browser).toBe("Edge");
	});

	test("recognizes Safari on iOS as a mobile device", () => {
		let ua =
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

		expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "iOS", deviceType: "mobile" });
	});

	test("recognizes an iPad as a tablet rather than a phone", () => {
		let ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

		expect(parseUserAgent(ua).deviceType).toBe("tablet");
	});

	test("recognizes Firefox on Linux", () => {
		let ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";

		expect(parseUserAgent(ua)).toEqual({
			browser: "Firefox",
			os: "Linux",
			deviceType: "desktop",
		});
	});

	test("prefers Android over Linux, which every Android agent also carries", () => {
		let ua = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36";

		expect(parseUserAgent(ua)).toEqual({
			browser: "Chrome",
			os: "Android",
			deviceType: "mobile",
		});
	});
});

describe("toSessionRow", () => {
	test("marks the row the request arrived on and nothing else", () => {
		let row = toSessionRow(session({ id: "current" }), "current", "en");
		expect(row.isCurrent).toBe(true);

		let other = toSessionRow(session({ id: "other" }), "current", "en");
		expect(other.isCurrent).toBe(false);
	});

	test("marks a session untouched for over a week as stale", () => {
		let eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
		let row = toSessionRow(session({ updated_at: eightDaysAgo }), null, "en");

		expect(row.isStale).toBe(true);
	});

	test("never calls the current session stale, however old its row looks", () => {
		let ancient = Date.now() - 365 * 24 * 60 * 60 * 1000;
		let row = toSessionRow(session({ id: "current", updated_at: ancient }), "current", "en");

		expect(row.isStale).toBe(false);
	});

	test("carries the client's name when the registration still exists", () => {
		let row = toSessionRow(
			session({ client: { name: "Client App" } as SessionWithClient["client"] }),
			null,
			"en",
		);

		expect(row.clientName).toBe("Client App");
	});

	test("reads a missing client as no name rather than throwing", () => {
		expect(toSessionRow(session({ client: null }), null, "en").clientName).toBeNull();
	});

	test("formats both dates for the requested language", () => {
		let row = toSessionRow(
			session({ updated_at: Date.UTC(2026, 0, 15), expires_at: Date.UTC(2026, 1, 14) }),
			null,
			"en-US",
		);

		expect(row.lastAccessed).toContain("2026");
		expect(row.expires).toContain("2026");
	});
});
