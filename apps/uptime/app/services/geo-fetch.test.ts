/**
 * Unit tests for `proxyProbe` and its wire format: it proxies `fetch`, reports the outcome as
 * an RFC 9209 `Proxy-Status` member and the timings as `Server-Timing`, and resolves a failed
 * proxied request with the error type the failure maps to instead of rejecting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	classifyProbeError,
	PROBE_METRIC,
	proxyProbe,
	readProbeError,
	readTiming,
	unreachableResponse,
	WALL_METRIC,
} from "~/app/services/geo-fetch";

/** The monitored endpoint each test probes. */
let PROBE_URL = "https://example.com/ping";

/** MSW server standing in for the monitored endpoint. */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Probes `PROBE_URL` through the function under test. */
function probe() {
	return proxyProbe(new Request(PROBE_URL));
}

/**
 * A mocked response whose `body` stream survives being read by the function under test.
 * Bun 1.3.14 empties a response's body stream when `clone()` follows reading `body`,
 * which the interceptor does; handing out a fresh stream per read keeps it observable.
 */
function respondWithBody(body: string, init?: ResponseInit) {
	let response = new HttpResponse(body, init);
	Object.defineProperty(response, "body", {
		configurable: true,
		get: () => new Blob([body]).stream(),
	});
	return response;
}

/** A Node-style `fetch failed` whose reason sits on its `cause`, as undici reports it. */
function fetchFailed(code: string, message: string): Error {
	return new TypeError("fetch failed", { cause: Object.assign(new Error(message), { code }) });
}

describe("proxyProbe", () => {
	test("reports the probe and wall timings and passes a 2xx response through unchanged", async () => {
		server.use(http.get(PROBE_URL, () => respondWithBody("hello world", { status: 200 })));

		let response = await probe();

		expect(readTiming(response.headers, PROBE_METRIC)).toBeGreaterThanOrEqual(0);
		expect(readTiming(response.headers, WALL_METRIC)).toBeGreaterThanOrEqual(0);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello world");
	});

	test("passes a non-2xx response's status and body through unchanged", async () => {
		server.use(http.get(PROBE_URL, () => respondWithBody("service unavailable", { status: 503 })));

		let response = await probe();

		expect(readTiming(response.headers, PROBE_METRIC)).toBeGreaterThanOrEqual(0);
		expect(response.status).toBe(503);
		expect(await response.text()).toBe("service unavailable");
	});

	test("signs a proxied response as received, with the status it got", async () => {
		server.use(http.get(PROBE_URL, () => new HttpResponse("hello world", { status: 201 })));

		let response = await probe();

		expect(response.headers.get("Proxy-Status")).toBe("uptime-probe;received-status=201");
		expect(readProbeError(response.headers)).toBeNull();
	});

	test("replaces a Proxy-Status and Server-Timing the monitored endpoint set on itself", async () => {
		server.use(
			http.get(
				PROBE_URL,
				() =>
					new HttpResponse("hello world", {
						status: 200,
						headers: {
							"Proxy-Status": "uptime-probe; error=dns_error",
							"Server-Timing": "probe;dur=99999, wall;dur=99999",
						},
					}),
			),
		);

		let response = await probe();

		expect(readProbeError(response.headers)).toBeNull();
		expect(readTiming(response.headers, PROBE_METRIC)).toBeLessThan(99_999);
	});

	test("resolves with the error type and message instead of rejecting when the request fails", async () => {
		server.use(http.get(PROBE_URL, () => HttpResponse.error()));

		let response = await probe();

		expect(response.status).toBe(204);
		let error = readProbeError(response.headers);
		expect(error?.type).toBe("destination_unavailable");
		expect(error?.details).toContain("Failed to fetch");
		expect(readTiming(response.headers, WALL_METRIC)).toBeGreaterThanOrEqual(0);
	});
});

describe("classifyProbeError", () => {
	test.each([
		["dns_error", new Error("DNS lookup failed")],
		["dns_error", fetchFailed("ENOTFOUND", "getaddrinfo ENOTFOUND example.invalid")],
		["dns_timeout", fetchFailed("EAI_AGAIN", "getaddrinfo EAI_AGAIN example.com")],
		["connection_refused", fetchFailed("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:443")],
		["connection_timeout", fetchFailed("UND_ERR_CONNECT_TIMEOUT", "Connect Timeout Error")],
		["connection_terminated", new Error("Network connection lost.")],
		["connection_terminated", fetchFailed("ECONNRESET", "read ECONNRESET")],
		["destination_ip_unroutable", fetchFailed("EHOSTUNREACH", "connect EHOSTUNREACH 10.0.0.1")],
		["tls_certificate_error", fetchFailed("CERT_HAS_EXPIRED", "certificate has expired")],
		["tls_certificate_error", new Error("TLS peer's certificate is not trusted")],
		["tls_protocol_error", new Error("TLS handshake failed")],
		["http_response_timeout", fetchFailed("UND_ERR_HEADERS_TIMEOUT", "Headers Timeout Error")],
		["http_request_error", new TypeError("Fetch API cannot load: ftp://example.com/")],
		["destination_unavailable", new Error("Something unexpected")],
		["destination_unavailable", "not an error"],
	])("maps to %s", (type, error) => {
		expect(classifyProbeError(error)).toBe(type);
	});

	test("writes a message with characters an sf-string cannot carry as legible ASCII", () => {
		let response = unreachableResponse(new Error("Verbindung abgelehnt — connection refused"));

		expect(readProbeError(response.headers)).toEqual({
			type: "connection_refused",
			details: "Verbindung abgelehnt ? connection refused",
		});
	});
});

describe("readProbeError", () => {
	test("reads the error type and details from the probe object's own member", () => {
		let headers = new Headers({
			"Proxy-Status":
				'origin-cache; received-status=200, uptime-probe; error=connection_refused; details="connect refused"',
		});

		expect(readProbeError(headers)).toEqual({
			type: "connection_refused",
			details: "connect refused",
		});
	});

	test("reads a missing or malformed field as a response, never as an error", () => {
		expect(readProbeError(new Headers())).toBeNull();
		expect(readProbeError(new Headers({ "Proxy-Status": "uptime-probe; error=" }))).toBeNull();
		expect(readProbeError(new Headers({ "Proxy-Status": "origin; error=dns_error" }))).toBeNull();
	});
});
