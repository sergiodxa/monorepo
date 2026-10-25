/**
 * Covers aggregate report parsing with RFC 9990 Appendix B's sample report as the fixture,
 * an RFC 7489-era report without a namespace, extensions, and the documents a report
 * evaluator discards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseDmarcReport } from "./dmarc-report.js";

/** RFC 9990 Appendix B's sample report. */
const RFC9990_SAMPLE = `<feedback xmlns="urn:ietf:params:xml:ns:dmarc-2.0">
  <version>1.0</version>
  <report_metadata>
    <org_name>Sample Reporter</org_name>
    <email>report_sender@example-reporter.com</email>
    <extra_contact_info>...</extra_contact_info>
    <report_id>3v98abbp8ya9n3va8yr8oa3ya</report_id>
    <date_range>
      <begin>302832000</begin>
      <end>302918399</end>
    </date_range>
    <generator>Example DMARC Aggregate Reporter v1.2</generator>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain>
    <p>quarantine</p>
    <sp>none</sp>
    <np>none</np>
    <testing>n</testing>
    <discovery_method>treewalk</discovery_method>
  </policy_published>
  <record>
    <row>
      <source_ip>192.0.2.123</source_ip>
      <count>123</count>
      <policy_evaluated>
        <disposition>pass</disposition>
        <dkim>pass</dkim>
        <spf>fail</spf>
      </policy_evaluated>
    </row>
    <identifiers>
      <envelope_from>example.com</envelope_from>
      <header_from>example.com</header_from>
    </identifiers>
    <auth_results>
      <dkim>
        <domain>example.com</domain>
        <result>pass</result>
        <selector>abc123</selector>
      </dkim>
      <spf>
        <domain>example.com</domain>
        <result>fail</result>
      </spf>
    </auth_results>
  </record>
</feedback>`;

/** A report as RFC 7489 receivers still send it: an XML declaration, no namespace, `pct`. */
const RFC7489_REPORT = `<?xml version="1.0" encoding="UTF-8" ?>
<feedback>
  <report_metadata>
    <org_name>google.com</org_name>
    <email>noreply-dmarc-support@google.com</email>
    <report_id>17299847349934887823</report_id>
    <date_range><begin>1700000000</begin><end>1700086399</end></date_range>
  </report_metadata>
  <policy_published>
    <domain>Example.com</domain>
    <adkim>r</adkim>
    <aspf>s</aspf>
    <p>reject</p>
    <sp>reject</sp>
    <pct>100</pct>
  </policy_published>
  <record>
    <row>
      <source_ip>198.51.100.7</source_ip>
      <count>2</count>
      <policy_evaluated>
        <disposition>none</disposition>
        <dkim>fail</dkim>
        <spf>fail</spf>
        <reason><type>forwarded</type><comment>looks forwarded</comment></reason>
      </policy_evaluated>
    </row>
    <identifiers><header_from>example.com</header_from></identifiers>
    <auth_results>
      <dkim><domain>example.com</domain><result>fail</result></dkim>
      <dkim><domain>mailer.example.net</domain><result>pass</result></dkim>
      <spf><domain>example.net</domain><result>softfail</result></spf>
    </auth_results>
  </record>
</feedback>`;

describe("parseDmarcReport", () => {
	test("reads RFC 9990's sample report", () => {
		let report = unwrap(parseDmarcReport(RFC9990_SAMPLE));
		expect(report.version).toBe("1.0");
		expect(report.metadata).toMatchObject({
			orgName: "Sample Reporter",
			email: "report_sender@example-reporter.com",
			reportId: "3v98abbp8ya9n3va8yr8oa3ya",
			generator: "Example DMARC Aggregate Reporter v1.2",
			errors: [],
		});
		expect(report.metadata.begin.toISOString()).toBe("1979-08-07T00:00:00.000Z");
		expect(report.metadata.end.toISOString()).toBe("1979-08-07T23:59:59.000Z");
		expect(report.policyPublished).toEqual({
			domain: "example.com",
			policy: "quarantine",
			subdomainPolicy: "none",
			nonExistentPolicy: "none",
			dkimAlignment: null,
			spfAlignment: null,
			discoveryMethod: "treewalk",
			failureOptions: null,
			testing: false,
		});
		expect(report.records).toEqual([
			{
				sourceIp: "192.0.2.123",
				count: 123,
				disposition: "pass",
				dkim: "pass",
				spf: "fail",
				reasons: [],
				headerFrom: "example.com",
				envelopeFrom: "example.com",
				envelopeTo: null,
				dkimResults: [
					{ domain: "example.com", selector: "abc123", result: "pass", humanResult: null },
				],
				spfResult: { domain: "example.com", scope: null, result: "fail", humanResult: null },
			},
		]);
	});

	test("reads an RFC 7489 report without a namespace", () => {
		let report = unwrap(parseDmarcReport(RFC7489_REPORT));
		expect(report.version).toBeNull();
		expect(report.policyPublished).toMatchObject({
			domain: "example.com",
			policy: "reject",
			dkimAlignment: "relaxed",
			spfAlignment: "strict",
			discoveryMethod: null,
		});
		let [row] = report.records;
		expect(row?.reasons).toEqual([{ type: "forwarded", comment: "looks forwarded" }]);
		expect(row?.dkimResults.map((result) => result.selector)).toEqual([null, null]);
		expect(row?.spfResult?.result).toBe("softfail");
	});

	test("ignores extension elements and reads prefixed element names", () => {
		let extended = RFC9990_SAMPLE.replace(
			'<feedback xmlns="urn:ietf:params:xml:ns:dmarc-2.0">',
			'<d:feedback xmlns:d="urn:ietf:params:xml:ns:dmarc-2.0" xmlns:ext="urn:example:ext">',
		)
			.replace("</feedback>", "</d:feedback>")
			.replace(
				"</policy_published>",
				"</policy_published><extension><ext:arc>never</ext:arc></extension>",
			)
			.replace("</auth_results>", "</auth_results><ext:arc-results>x</ext:arc-results>");
		expect(unwrap(parseDmarcReport(extended)).records).toHaveLength(1);
	});

	test.each([
		["not xml", "<feedback>", "not XML"],
		["another root", "<report/>", "not <feedback>"],
		["no record", RFC9990_SAMPLE.replace(/<record>[\s\S]*<\/record>/, ""), "no <record>"],
		["no report id", RFC9990_SAMPLE.replace(/<report_id>.*<\/report_id>/, ""), "<report_id>"],
		[
			"an unknown policy",
			RFC9990_SAMPLE.replace("<p>quarantine</p>", "<p>block</p>"),
			"not a DMARC policy",
		],
		[
			"a negative count",
			RFC9990_SAMPLE.replace("<count>123</count>", "<count>-1</count>"),
			"<count>",
		],
		[
			"a bad date",
			RFC9990_SAMPLE.replace("<begin>302832000</begin>", "<begin>yesterday</begin>"),
			"epoch",
		],
	])("rejects %s", (_, xml, message) => {
		let report = parseDmarcReport(xml);
		expect(isFailure(report) && report.error.message).toContain(message);
	});
});
