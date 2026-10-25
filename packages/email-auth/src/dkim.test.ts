/**
 * Covers DKIM key records with RFC 6376's Appendix C key and RFC 8460's TLS-RPT key as
 * fixtures: the defaults every absent tag takes, revocation, and the records verifiers ignore.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { lookupDkimKey, parseDkimRecord } from "./dkim.js";
import { serveZone } from "./fixtures/dns.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** RFC 6376 Appendix C's zone for the `brisbane` selector. */
const RFC6376_ZONE = `
$ORIGIN _domainkey.example.org.
brisbane IN  TXT  ("v=DKIM1; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ"
                   "KBgQDwIRP/UC3SBsEmGqZ9ZJW3/DkMoGeLnQg1fWn7/zYt"
                   "IxN2SnFCjxOCKG9v3b4jYfcTNh5ijSsq631uBItLa7od+v"
                   "/RtdC2UzJ1lWT947qR+Rcac2gbto/NMqJ0fzfVjH4OuKhi"
                   "tdY9tf6mcwGjaNBcWToIMmPSPDdQPNUYckcQ2QIDAQAB")
`;

describe("parseDkimRecord", () => {
	test("reads RFC 8460's TLS-RPT key with its service type", () => {
		let record = unwrap(parseDkimRecord("v=DKIM1;k=rsa;s=tlsrpt;p=Mlf4qwSZfase4fa=="));
		expect(record).toMatchObject({
			keyType: "rsa",
			publicKey: "Mlf4qwSZfase4fa==",
			revoked: false,
			serviceTypes: ["tlsrpt"],
			hashAlgorithms: null,
			testing: false,
		});
	});

	test("fills in the defaults of every absent tag", () => {
		let record = unwrap(parseDkimRecord("p=AAAA"));
		expect(record.keyType).toBe("rsa");
		expect(record.serviceTypes).toEqual(["*"]);
		expect(record.notes).toBeNull();
	});

	test("reads an empty p= as a revoked key", () => {
		expect(unwrap(parseDkimRecord("v=DKIM1; p=")).revoked).toBe(true);
	});

	test("reads hash algorithms and flags as colon lists", () => {
		let record = unwrap(parseDkimRecord("v=DKIM1; h=sha256 : sha1; t=y:s; k=ed25519; p=AAAA"));
		expect(record.hashAlgorithms).toEqual(["sha256", "sha1"]);
		expect(record).toMatchObject({ testing: true, strict: true, keyType: "ed25519" });
	});

	test.each([
		["k=rsa; v=DKIM1; p=AAAA", "first"],
		["v=DKIM2; p=AAAA", "DKIM1"],
		["v=DKIM1; k=rsa", "no `p=`"],
		["v=DKIM1; p=AAAA; p=BBBB", "twice"],
		["v=DKIM1; p=not base64!", "base64"],
		["v=DKIM1; p", "missing its `=`"],
	])("rejects %s", (text, message) => {
		let record = parseDkimRecord(text);
		expect(isFailure(record) && record.error.message).toContain(message);
	});
});

describe("lookupDkimKey", () => {
	test("reads RFC 6376 Appendix C's key split across five strings", async () => {
		serveZone(server, RFC6376_ZONE);
		let record = unwrap(await lookupDkimKey("example.org", "brisbane"));
		expect(record?.publicKey).toBe(
			"MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDwIRP/UC3SBsEmGqZ9ZJW3/DkMoGeLnQg1fWn7/zYtIxN2SnFCjxOCKG9v3b4jYfcTNh5ijSsq631uBItLa7od+v/RtdC2UzJ1lWT947qR+Rcac2gbto/NMqJ0fzfVjH4OuKhitdY9tf6mcwGjaNBcWToIMmPSPDdQPNUYckcQ2QIDAQAB",
		);
	});

	test("is null for a selector that publishes nothing", async () => {
		serveZone(server, RFC6376_ZONE);
		expect(unwrap(await lookupDkimKey("example.org", "sydney"))).toBeNull();
	});
});
