/**
 * Covers TLS-RPT policy records with RFC 8460 §3.1's two examples as fixtures, and the
 * discovery rule that only exactly one `v=TLSRPTv1` record at `_smtp._tls` counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { serveZone } from "./fixtures/dns.js";
import { discoverTlsRpt, parseTlsRptRecord } from "./tls-rpt.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("parseTlsRptRecord", () => {
	test("reads RFC 8460 §3.1.1's mailto example", () => {
		let record = unwrap(parseTlsRptRecord("v=TLSRPTv1;rua=mailto:reports@example.com"));
		expect(record.rua).toEqual(["mailto:reports@example.com"]);
	});

	test("reads RFC 8460 §3.1.2's https example", () => {
		let record = unwrap(
			parseTlsRptRecord("v=TLSRPTv1; rua=https://reporting.example.com/v1/tlsrpt"),
		);
		expect(record.rua).toEqual(["https://reporting.example.com/v1/tlsrpt"]);
	});

	test("reads several destinations and keeps unknown fields", () => {
		let record = unwrap(
			parseTlsRptRecord("v=TLSRPTv1; rua=mailto:a@example.com, https://r.example.com/; ext=1;"),
		);
		expect(record.rua).toEqual(["mailto:a@example.com", "https://r.example.com/"]);
		expect(record.fields["ext"]).toBe("1");
	});

	test.each([
		["v=TLSRPTv2;rua=mailto:a@example.com", "v=TLSRPTv1"],
		["v=TLSRPTv1", "no `rua`"],
		["v=TLSRPTv1;rua=not a uri", "not a URI"],
	])("rejects %s", (text, message) => {
		let record = parseTlsRptRecord(text);
		expect(isFailure(record) && record.error.message).toContain(message);
	});
});

describe("discoverTlsRpt", () => {
	test("finds the one TLS-RPT record among others at the name", async () => {
		serveZone(
			server,
			`_smtp._tls IN TXT "v=TLSRPTv1;rua=mailto:reports@example.com"
_smtp._tls IN TXT "unrelated"`,
		);
		let found = unwrap(await discoverTlsRpt("example.com"));
		expect(found.status).toBe("found");
	});

	test("treats two TLS-RPT records as none", async () => {
		serveZone(
			server,
			`_smtp._tls IN TXT "v=TLSRPTv1;rua=mailto:a@example.com"
_smtp._tls IN TXT "v=TLSRPTv1;rua=mailto:b@example.com"`,
		);
		expect(unwrap(await discoverTlsRpt("example.com"))).toMatchObject({
			status: "multiple",
			count: 2,
		});
	});

	test("reports none for an unpublished name", async () => {
		serveZone(server, `@ IN A 192.0.2.1`);
		expect(unwrap(await discoverTlsRpt("example.com")).status).toBe("none");
	});

	test("returns the resolver's failure instead of reading it as none", async () => {
		serveZone(server, `@ IN A 192.0.2.1`, { failing: ["_smtp._tls.example.com"] });
		expect(isFailure(await discoverTlsRpt("example.com"))).toBe(true);
	});
});
