/**
 * Tests for the pasted zone-file parser, driven by two fixtures: a genuine provider export,
 * which is what a real paste looks like, and a hand-built file whose tail carries one line for
 * every construct the parser refuses, so each refusal is asserted against the reason it reports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ZoneFileImport, ZoneFileRejectionReason } from "~/app/services/zone-file";

import { MAX_ZONE_FILE_BYTES, parseZoneFile } from "~/app/services/zone-file";

const DOMAIN = "sergiodxa.com";

/** A genuine export, so the supported subset is measured against real provider output. */
const EXPORT_FIXTURE = readFileSync(
	new URL("./fixtures/sergiodxa.com.txt", import.meta.url),
	"utf8",
);

/** Real RRsets plus one line per refused construct, which no export would contain. */
const RECONSTRUCTED_FIXTURE = readFileSync(
	new URL("./fixtures/sergiodxa.com.reconstructed.zone", import.meta.url),
	"utf8",
);

/** Parses text against `sergiodxa.com`, asserting success so a tripped cap fails the test itself. */
function parse(input: string, domain = DOMAIN): ZoneFileImport {
	let result = parseZoneFile(input, domain);
	expect(isSuccess(result)).toBe(true);
	return unwrap(result);
}

/** The reason reported for the line containing `needle`, or `undefined` when none matched. */
function reasonForLineContaining(
	imported: ZoneFileImport,
	needle: string,
): ZoneFileRejectionReason | undefined {
	return imported.rejected.find((rejection) => rejection.input.includes(needle))?.reason;
}

describe("parseZoneFile", () => {
	describe("a genuine provider export", () => {
		let imported = parse(EXPORT_FIXTURE);

		test("reads every tracked record and reports the rest", () => {
			expect(imported.records.length).toBeGreaterThan(0);
			/** The header's `;;` lines are comments, invisible to whoever reviews the import. */
			expect(imported.rejected.some((rejection) => rejection.input.startsWith(";;"))).toBe(false);
		});

		test("qualifies owners and folds hostname targets", () => {
			expect(imported.records).toContainEqual({
				line: 30,
				name: "sergiodxa.com",
				type: "NS",
				value: "dora.ns.cloudflare.com",
			});

			expect(imported.records).toContainEqual({
				line: 41,
				name: "go.sergiodxa.com",
				type: "CNAME",
				value: "cname.dub.co",
			});
		});

		test("keeps an MX preference with its host", () => {
			expect(imported.records).toContainEqual({
				line: 52,
				name: "sergiodxa.com",
				type: "MX",
				value: "5 aspmx.l.google.com",
			});
		});

		test("strips an inline comment without touching the record", () => {
			expect(imported.records).toContainEqual({
				line: 76,
				name: "send.sergiodxa.com",
				type: "TXT",
				value: "v=spf1 include:amazonses.com ~all",
			});
		});

		test("concatenates a split DKIM key with nothing between the pieces", () => {
			let dkim = imported.records.find(
				(record) => record.name === "cf-bounce._domainkey.auth.sergiodxa.com",
			);

			expect(dkim?.value).toMatch(/^v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkq/);
			expect(dkim?.value).toMatch(/TixDSJwIDAQAB$/);
			expect(dkim?.value).not.toContain('"');
		});

		test("counts a record written twice as the one record it is", () => {
			/** The export carries `_dmarc` twice with different trailing comments; identity is the value. */
			let dmarc = imported.records.filter(
				(record) => record.name === "_dmarc.sergiodxa.com" && record.value === "v=DMARC1; p=none;",
			);

			expect(dmarc).toHaveLength(1);
			expect(dmarc[0]?.line).toBe(67);
		});

		test("lists the repeated line as informational, not as a line that was skipped", () => {
			expect(imported.duplicates).toEqual([
				{
					line: 68,
					input: expect.stringContaining("v=DMARC1; p=none;"),
					firstLine: 67,
					name: "_dmarc.sergiodxa.com",
					type: "TXT",
				},
			]);

			expect(imported.rejected.some((rejection) => rejection.line === 68)).toBe(false);
		});

		test("reads the apex owner the export writes without its trailing dot", () => {
			/** The export qualifies every owner but the SOA's; both spellings mean the apex. */
			let imported = parse('sergiodxa.com\t3600\tIN\tTXT\t"one"');
			expect(imported.records[0]?.name).toBe("sergiodxa.com");
		});

		test("reports the records it does not track", () => {
			/** A real export writes SOA on one line, with no parentheses, and it is still not tracked. */
			expect(reasonForLineContaining(imported, "IN\tSOA")).toBe("unsupportedType");
			expect(reasonForLineContaining(imported, "IN\tCAA")).toBe("unsupportedType");
		});
	});

	describe("owner resolution", () => {
		test("resolves `@` to the apex", () => {
			let imported = parse('@\t1\tIN\tTXT\t"v=spf1 ~all"');
			expect(imported.records[0]?.name).toBe("sergiodxa.com");
		});

		test("qualifies a relative owner with the monitor's domain", () => {
			let imported = parse("www\t1\tIN\tCNAME\tsergiodxa.com.");
			expect(imported.records[0]?.name).toBe("www.sergiodxa.com");
		});

		test("drops the trailing dot and the case of an absolute owner", () => {
			let imported = parse("WWW.SergioDXA.com.\t1\tIN\tA\t192.0.2.1");
			expect(imported.records[0]?.name).toBe("www.sergiodxa.com");
		});

		test("reports a name that belongs to another zone instead of sweeping it", () => {
			let imported = parse("www.example.com.\t1\tIN\tA\t192.0.2.1");
			expect(imported.records).toHaveLength(0);
			expect(imported.rejected[0]?.reason).toBe("outOfZone");
		});

		test("does not mistake a lookalike suffix for the zone", () => {
			let imported = parse("notsergiodxa.com.\t1\tIN\tA\t192.0.2.1");
			expect(imported.rejected[0]?.reason).toBe("outOfZone");
		});

		test("qualifies a relative target in the record's data", () => {
			let imported = parse("alias\t1\tIN\tCNAME\twww");
			expect(imported.records[0]?.value).toBe("www.sergiodxa.com");
		});

		test("accepts a target outside the zone, which a CNAME legitimately is", () => {
			let imported = parse("gh\t1\tIN\tCNAME\tgh-ds9.pages.dev.");
			expect(imported.records[0]?.value).toBe("gh-ds9.pages.dev");
		});
	});

	describe("optional fields", () => {
		test("reads a line with neither TTL nor class", () => {
			let imported = parse("alias.sergiodxa.com.\tCNAME\tsergiodxa.com.");
			expect(imported.records[0]).toEqual({
				line: 1,
				name: "alias.sergiodxa.com",
				type: "CNAME",
				value: "sergiodxa.com",
			});
		});

		test("reads a TTL written with a unit", () => {
			let imported = parse("www\t1h\tIN\tCNAME\tsergiodxa.com.");
			expect(imported.records).toHaveLength(1);
		});

		test("reads a class written before the TTL", () => {
			let imported = parse("www\tIN\t3600\tCNAME\tsergiodxa.com.");
			expect(imported.records).toHaveLength(1);
		});

		test("reads a lowercase type", () => {
			let imported = parse("www\t1\tin\tcname\tsergiodxa.com.");
			expect(imported.records[0]?.type).toBe("CNAME");
		});
	});

	describe("value normalization", () => {
		test("compresses an IPv6 address to one canonical spelling", () => {
			let expanded = parse("@\t1\tIN\tAAAA\t2606:4700:3030:0000:0000:0000:6815:3AF9");
			let compressed = parse("@\t1\tIN\tAAAA\t2606:4700:3030::6815:3af9");

			expect(expanded.records[0]?.value).toBe("2606:4700:3030::6815:3af9");
			expect(compressed.records[0]?.value).toBe(expanded.records[0]?.value);
		});

		test("stores an IPv4 address as written", () => {
			let imported = parse("@\t1\tIN\tA\t104.21.58.249");
			expect(imported.records[0]?.value).toBe("104.21.58.249");
		});

		test("normalizes an MX preference written with a leading zero", () => {
			let imported = parse("@\t1\tIN\tMX\t05 ASPMX.L.google.com.");
			expect(imported.records[0]?.value).toBe("5 aspmx.l.google.com");
		});

		test("treats a semicolon inside a quoted string as data", () => {
			let imported = parse('@\t1\tIN\tTXT\t"v=spf1 a; mx; ~all"\t; a real comment');
			expect(imported.records[0]?.value).toBe("v=spf1 a; mx; ~all");
			expect(imported.rejected).toHaveLength(0);
		});

		test("unescapes a quote inside a character-string", () => {
			let imported = parse('@\t1\tIN\tTXT\t"say \\"hi\\""');
			expect(imported.records[0]?.value).toBe('say "hi"');
		});

		test("keeps the case and the spacing of a TXT payload", () => {
			let imported = parse('@\t1\tIN\tTXT\t"v=DMARC1;  p=none;"');
			expect(imported.records[0]?.value).toBe("v=DMARC1;  p=none;");
		});
	});

	describe("blank lines and comments", () => {
		test("skips them without reporting anything", () => {
			let imported = parse("\n; just a comment\n\n   \n\t; indented comment\n");
			expect(imported.records).toHaveLength(0);
			expect(imported.rejected).toHaveLength(0);
		});
	});

	describe("every construct outside the supported subset", () => {
		let imported = parse(RECONSTRUCTED_FIXTURE);

		test.each([
			["$ORIGIN", "originDirective"],
			["$TTL", "ttlDirective"],
			["$INCLUDE", "includeDirective"],
			["$GENERATE", "generateDirective"],
			["IN\tSOA", "multiLineRecord"],
			["inherits the owner above", "blankOwnerContinuation"],
			["CH\tTXT", "nonInternetClass"],
			["IN\tCAA", "unsupportedType"],
			["IN\tSRV", "unsupportedType"],
			["IN\tPTR", "unsupportedType"],
			["IN\tDS", "unsupportedType"],
			["IN\tHTTPS", "unsupportedType"],
			["this line is not a resource record", "malformed"],
		] as const)("reports %s as %s", (needle, reason) => {
			expect(reasonForLineContaining(imported, needle)).toBe(reason);
		});

		test("reports every line of a parenthesised record, not only the first", () => {
			let multiLine = imported.rejected.filter(
				(rejection) => rejection.reason === "multiLineRecord",
			);

			/** The opening line plus its four continuations, through the line closing the paren. */
			expect(multiLine.map((rejection) => rejection.line)).toEqual([110, 111, 112, 113, 114, 115]);
		});

		test("resumes reading records after a parenthesised record ends", () => {
			let imported = parse(
				[
					"@\t1\tIN\tSOA\tns.example.com. root.example.com. (",
					"\t1 ; serial",
					"\t2 )",
					"www\t1\tIN\tCNAME\tsergiodxa.com.",
				].join("\n"),
			);

			expect(imported.rejected.map((rejection) => rejection.line)).toEqual([1, 2, 3]);
			expect(imported.records[0]?.name).toBe("www.sergiodxa.com");
		});

		test("reports a directive it has never heard of rather than ignoring it", () => {
			let imported = parse("$WHATEVER 1");
			expect(imported.rejected[0]?.reason).toBe("unsupportedDirective");
		});

		test("reports rdata that does not fit its type", () => {
			expect(parse("@\t1\tIN\tA\t999.1.1.1").rejected[0]?.reason).toBe("malformed");
			expect(parse("@\t1\tIN\tA\t192.0.2.1 192.0.2.2").rejected[0]?.reason).toBe("malformed");
			expect(parse("@\t1\tIN\tAAAA\t192.0.2.1").rejected[0]?.reason).toBe("malformed");
			expect(parse("@\t1\tIN\tMX\taspmx.l.google.com.").rejected[0]?.reason).toBe("malformed");
			expect(parse("@\t1\tIN\tA").rejected[0]?.reason).toBe("malformed");
		});

		test("reports a character-string that is never closed", () => {
			expect(parse('@\t1\tIN\tTXT\t"unterminated').rejected[0]?.reason).toBe("malformed");
		});

		test("carries the line number and the text of every reported line", () => {
			for (let rejection of imported.rejected) {
				expect(rejection.line).toBeGreaterThan(0);
				expect(rejection.input.length).toBeGreaterThan(0);
				expect(rejection.input.length).toBeLessThanOrEqual(120);
			}
		});

		test.each([
			["the export", EXPORT_FIXTURE],
			["the reconstructed file", RECONSTRUCTED_FIXTURE],
		])("accounts for every meaningful line of %s", (_label, fixture) => {
			/** Nothing may fall between the records and the report: a silent drop is the one failure mode. */
			let meaningful = fixture.split(/\r?\n/).filter((line) => {
				let value = line.trim();
				return value.length > 0 && !value.startsWith(";");
			});

			let accounted = parse(fixture);

			expect(
				accounted.records.length + accounted.rejected.length + accounted.duplicates.length,
			).toBe(meaningful.length);
		});
	});

	describe("the size cap", () => {
		test("refuses a paste over the cap with a failure instead of an exception", () => {
			let result = parseZoneFile("a".repeat(MAX_ZONE_FILE_BYTES + 1), DOMAIN);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error.bytes).toBe(MAX_ZONE_FILE_BYTES + 1);
		});

		test("measures bytes rather than characters", () => {
			/** A multi-byte character costs what it costs on the wire, which is what the provider limits. */
			let result = parseZoneFile("é".repeat(MAX_ZONE_FILE_BYTES / 2), DOMAIN);
			expect(isSuccess(result)).toBe(true);

			let overflowing = parseZoneFile("é".repeat(MAX_ZONE_FILE_BYTES / 2 + 1), DOMAIN);
			expect(isFailure(overflowing)).toBe(true);
		});

		test("accepts a paste exactly at the cap", () => {
			expect(isSuccess(parseZoneFile("a".repeat(MAX_ZONE_FILE_BYTES), DOMAIN))).toBe(true);
		});
	});

	describe("the monitor's domain", () => {
		test("is folded before names resolve against it", () => {
			let imported = parse("www\t1\tIN\tA\t192.0.2.1", "SergioDXA.com.");
			expect(imported.records[0]?.name).toBe("www.sergiodxa.com");
		});
	});
});
