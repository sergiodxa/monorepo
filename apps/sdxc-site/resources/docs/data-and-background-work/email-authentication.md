---
title: Check a domain's email authentication
description: Read the DMARC, SPF and DKIM records a sending domain publishes, serve an MTA-STS policy for your own domain, and parse the DMARC aggregate reports receivers send back.
section:
    title: Data & background work
    order: 7
order: 20
lastUpdated: 2026-10-24
outcomes:
    - "How to check a customer's DMARC policy, SPF lookups and DKIM key before you send from their domain"
    - "How to serve an MTA-STS policy and confirm senders can read it with the TLS-RPT record"
    - "What a DMARC aggregate report says about who sends mail as your domain"
---

When your app sends mail from a customer's domain, a newsletter from `news@shop.com` or a
receipt from `orders@shop.com`, receivers judge it by the records that domain publishes in DNS.
A missing DKIM key, an SPF record that never names your servers, or one with more than ten
lookups lands that mail in spam, and the customer blames your product. Checking the records
before the first send turns that into a checklist the customer can fix.

This guide builds that check as a background job: the DMARC policy that applies, an SPF
evaluation of your sending address, and the DKIM key at your selector. Then it serves an
MTA-STS policy for your own domain and reads the DMARC aggregate reports receivers send back.
[`@sdxc/email-auth`](/api/email-auth) parses and evaluates every record, looking each one up
over DNS over HTTPS so it runs in a Worker, and answers a [`@sdxc/result`](/api/result) for
every call that can fail. [`@sdxc/jobs`](/api/jobs) runs the checks off the request.

```bash
npm add @sdxc/doh @sdxc/email-auth @sdxc/jobs @sdxc/result remix
```

## Find the DMARC policy that applies

DMARC tells receivers what to do with mail that fails authentication. A subdomain without its
own record inherits its Organizational Domain's, so `discoverDmarc` walks the DNS tree the way
a receiver does and answers the record that applies, where it was published and the policy it
sets:

```typescript {% title="app/services/sending-domain.ts" %}
import { discoverDmarc } from "@sdxc/email-auth";
import { isFailure, success } from "@sdxc/result";

export interface Finding {
	check: "dmarc" | "spf" | "dkim";
	ok: boolean;
	message: string;
}

export async function checkDmarc(domain: string) {
	let discovery = await discoverDmarc(domain);
	if (isFailure(discovery)) return discovery;

	let { policy, policyDomain, record } = discovery.data;
	if (policy === null || record === null) {
		return success<Finding>({
			check: "dmarc",
			ok: false,
			message: `Publish a DMARC record at _dmarc.${domain}.`,
		});
	}
	if (policy === "none" || record.testing) {
		return success<Finding>({
			check: "dmarc",
			ok: false,
			message: `The policy at ${policyDomain} only reports; set p=quarantine or p=reject.`,
		});
	}
	return success<Finding>({
		check: "dmarc",
		ok: true,
		message: `Receivers ${policy} mail that fails DMARC.`,
	});
}
```

`policy` is `null` when no DMARC applies at all, and `record.testing` is the `t=y` flag that asks
receivers to apply one step less than the policy says. A resolver that could not answer is the
failure, never "no policy", so the job retries it rather than telling the customer their record
is missing. A record with a broken tag still parses, as receivers read it: the tag falls back to
its default and is listed in `record.issues`.

## Evaluate SPF for your sending address

SPF lists the addresses allowed to send for a domain. Two things go wrong with it: the record
never authorizes your servers, or its `include` chain needs more than ten DNS lookups, which
makes every receiver answer `permerror`. `analyzeSpf` counts the lookups across every include
and lists what is wrong; `checkHost` runs the evaluation a receiver runs for one address:

```typescript {% title="app/services/sending-domain.ts" %}
import { analyzeSpf, checkHost } from "@sdxc/email-auth";
import { isFailure, success } from "@sdxc/result";

const SENDING_IP = "203.0.113.25";
const SPF_INCLUDE = "_spf.mailer.example.com";

export async function checkSpf(domain: string) {
	let audit = await analyzeSpf(domain);
	if (isFailure(audit)) return audit;

	let { lookups, problems, status } = audit.data;
	if (status === "none") {
		return success<Finding>({
			check: "spf",
			ok: false,
			message: `Publish v=spf1 include:${SPF_INCLUDE} -all at ${domain}.`,
		});
	}
	if (problems.length > 0) {
		let codes = problems.map((problem) => problem.code).join(", ");
		return success<Finding>({
			check: "spf",
			ok: false,
			message: `Fix SPF: ${codes}.`,
		});
	}

	let evaluation = await checkHost({
		ip: SENDING_IP,
		domain,
		sender: `bounces@${domain}`,
	});
	if (evaluation.result !== "pass") {
		return success<Finding>({
			check: "spf",
			ok: false,
			message: `SPF answers ${evaluation.result} for us; add include:${SPF_INCLUDE}.`,
		});
	}
	return success<Finding>({
		check: "spf",
		ok: true,
		message: `SPF passes with ${lookups} of 10 lookups.`,
	});
}
```

Each problem carries a `code` (`too-many-lookups`, `target-missing`, `multiple-records`,
`invalid-record`, `loop`, `lookup-failed`, `ptr-mechanism`, `permissive-all`) and the domain it
was found at, which is enough to write a message per code. `checkHost` answers a value rather
than a `Result`: a DNS failure is the `temperror` result, as RFC 7208 defines it, and
`evaluation.mechanism` names the term that decided it. `domain` is the domain of the envelope
sender, so pass the bounce domain when your bounces go somewhere other than the From address.

## Confirm the DKIM key is published

DKIM signs each message with a key the domain publishes at `<selector>._domainkey.<domain>`.
Your app picks the selector and hands the customer the record to publish; the check reads it
back:

```typescript {% title="app/services/sending-domain.ts" %}
import { lookupDkimKey, RecordParseError } from "@sdxc/email-auth";
import { isFailure, success } from "@sdxc/result";

const DKIM_SELECTOR = "mailer";

export async function checkDkim(domain: string) {
	let name = `${DKIM_SELECTOR}._domainkey.${domain}`;
	let key = await lookupDkimKey(domain, DKIM_SELECTOR);
	if (isFailure(key)) {
		if (!(key.error instanceof RecordParseError)) return key;
		return success<Finding>({
			check: "dkim",
			ok: false,
			message: key.error.message,
		});
	}

	if (key.data === null) {
		return success<Finding>({
			check: "dkim",
			ok: false,
			message: `Publish our key at ${name}.`,
		});
	}
	if (key.data.revoked || key.data.testing) {
		return success<Finding>({
			check: "dkim",
			ok: false,
			message: `The key at ${name} is revoked or in testing mode.`,
		});
	}
	return success<Finding>({
		check: "dkim",
		ok: true,
		message: `${name} is published.`,
	});
}
```

An unpublished selector is `null`. A record that does not parse is a `RecordParseError`, which
the customer fixes, so it becomes a finding; a resolver failure stays a failure for the job to
retry. An empty `p=` is a revoked key. When you sign with `d=` on a subdomain, such as
`mail.shop.com`, `isAligned("shop.com", "mail.shop.com", record.dkimAlignment)` answers whether
DMARC counts that signature for the From domain.

## Run the audit off the request

Each check is several DNS queries, and a customer who just published a record waits on their
provider's TTL before it shows up. Run all three in a job and store the findings for the
settings page to read:

```typescript {% title="app/jobs/sending-domains/audit.ts" %}
import type { Finding } from "~/app/services/sending-domain";

import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { SendingDomains } from "~/app/models/sending-domains";
import { checkDkim, checkDmarc, checkSpf } from "~/app/services/sending-domain";

export default createJobHandler(jobs.sendingDomains.audit, async (ctx) => {
	let domain = await SendingDomains.find(ctx.db, ctx.input.domainId);
	if (domain === null) return ctx.exit("The domain was removed");

	let checks = await Promise.all([
		checkDmarc(domain.hostname),
		checkSpf(domain.hostname),
		checkDkim(domain.hostname),
	]);
	let findings: Finding[] = [];
	for (let check of checks) {
		if (isFailure(check))
			return ctx.retry({ delay: "5 minutes", cause: check.error });
		findings.push(check.data);
	}

	await SendingDomains.saveFindings(ctx.db, domain.id, findings);
	ctx.log.set({
		sendingDomain: { failing: findings.filter((it) => !it.ok).length },
	});
});
```

The job is declared as `audit: job({ input: s.object({ domainId: s.string() }) })` under
`sendingDomains`, and `SendingDomains` is your own model.
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) builds the queue; a
cron trigger that enqueues the audit for every domain each day catches a record a customer
removes later.

<note>
Every lookup goes to Cloudflare's resolver by default and waits up to five seconds. Pass
`{ timeoutMs, signal, resolver }` as the last argument of any discover or lookup call to change
that, and keep the whole audit inside the job's own time limit.
</note>

## Serve an MTA-STS policy for your own domain

MTA-STS tells servers delivering mail to your domain to require TLS and to accept only the MX
hosts you list, so a network attacker can no longer strip encryption from inbound mail. The
policy is a small text file at `https://mta-sts.<domain>/.well-known/mta-sts.txt`; keep its text
in configuration and serve it from a route:

```typescript {% title="config/mta-sts.ts" %}
export const MTA_STS_POLICY = [
	"version: STSv1",
	"mode: enforce",
	"mx: *.mx.cloudflare.net",
	"max_age: 604800",
].join("\r\n");
```

```typescript {% title="app/http/controllers/mta-sts.ts" %}
import { createAction } from "remix/router";

import { MTA_STS_POLICY } from "~/config/mta-sts";
import routes from "~/routes/web";

export default createAction(routes.mtaSts, () => {
	return new Response(MTA_STS_POLICY, {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
});
```

The route is `mtaSts: get("/.well-known/mta-sts.txt")`, served on `mta-sts.example.com` as a
custom domain of the Worker. Two TXT records complete it: `_mta-sts.example.com` with
`v=STSv1; id=20261024`, which senders compare to decide whether to refetch the policy, and
`_smtp._tls.example.com` with `v=TLSRPTv1; rua=mailto:tls-reports@example.com`, where senders
report the TLS failures they see.

<warning>
Senders fetch the policy over HTTPS with no redirects and accept only a `200` with
`text/plain`. Change the `id` in the TXT record every time the policy text changes, or senders
keep the cached copy for `max_age` seconds. Start with `mode: testing` and read the TLS reports
before switching to `enforce`, which refuses delivery when an MX host is missing from the list.
</warning>

## Check what senders will see

Fetch the policy the way a sending server does and compare it with your MX hosts. `follow` from
[`@sdxc/outbound`](/api/outbound) runs underneath, so the fetch refuses a redirect, a private
address and a body over 64 KiB:

```typescript {% title="app/services/mail-transport.ts" %}
import {
	discoverMtaSts,
	discoverTlsRpt,
	fetchMtaStsPolicy,
	matchesMxPattern,
} from "@sdxc/email-auth";
import { isFailure, success } from "@sdxc/result";

export async function mailTransportProblems(
	domain: string,
	mxHosts: readonly string[],
) {
	let problems: string[] = [];

	let record = await discoverMtaSts(domain);
	if (isFailure(record)) return record;
	if (record.data.status !== "found") {
		problems.push(`${record.data.name}: ${record.data.status}`);
	}

	let policy = await fetchMtaStsPolicy(domain, { timeout: "10 seconds" });
	if (isFailure(policy)) {
		problems.push(`policy file: ${policy.error.reason}`);
	} else {
		for (let host of mxHosts) {
			if (!matchesMxPattern(host, policy.data.mx))
				problems.push(`${host} is not listed`);
		}
	}

	let reporting = await discoverTlsRpt(domain);
	if (isFailure(reporting)) return reporting;
	if (reporting.data.status !== "found") {
		problems.push(`${reporting.data.name}: ${reporting.data.status}`);
	}

	return success(problems);
}
```

`status` is `none`, `multiple` or `invalid` when the TXT record is missing, published twice or
broken, and `reason` names the step of the policy fetch that failed: `request`, `status`,
`content-type` or `invalid`. An empty list means senders find the record, fetch the policy and
match every MX host you pass.

## Read DMARC aggregate reports

The `rua` address in a DMARC record receives a daily aggregate report from every large
receiver: which addresses sent mail as your domain, how many messages, and whether DKIM and SPF
passed. Most arrive as gzip attachments; hand the attachment's stream to a service that
decompresses and parses it:

```typescript {% title="app/services/dmarc-reports.ts" %}
import { parseDmarcReport } from "@sdxc/email-auth";
import { isFailure, success, wrap } from "@sdxc/result";

export async function readAggregateReport(gzipped: ReadableStream<Uint8Array>) {
	let xml = await wrap(() =>
		new Response(gzipped.pipeThrough(new DecompressionStream("gzip"))).text(),
	);
	if (isFailure(xml)) return xml;

	let report = parseDmarcReport(xml.data);
	if (isFailure(report)) return report;

	let { metadata, policyPublished, records } = report.data;
	let failing = records.filter((row) => row.dkim === "fail" && row.spf === "fail");
	return success({
		reporter: metadata.orgName,
		domain: policyPublished.domain,
		from: metadata.begin,
		to: metadata.end,
		failing: failing.map(({ sourceIp, count, disposition }) => ({
			sourceIp,
			count,
			disposition,
		})),
	});
}
```

`parseDmarcReport` reads both the RFC 9990 format and the older RFC 7489 one, and each row's
`dkim` and `spf` are the aligned results DMARC used. A source that fails both is either a
service you forgot to authorize or someone sending as your domain, and `disposition` says what
the receiver did with it. `dkimResults` and `spfResult` on each row hold the raw results with
the domains and selectors behind them.

## Test the checks

Every lookup is a DNS-over-HTTPS request to the resolver `@sdxc/doh` asks by default, so MSW
answers it from a table of TXT records, with NXDOMAIN for every name the table leaves out:

```typescript {% title="app/services/sending-domain.test.ts" %}
import { CLOUDFLARE } from "@sdxc/doh";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { checkDkim, checkDmarc, checkSpf } from "~/app/services/sending-domain";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function publish(records: { [name: string]: string }) {
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let name = new URL(request.url).searchParams.get("name") ?? "";
			let text = records[name.replace(/\.$/, "")];
			if (text === undefined) return HttpResponse.json({ Status: 3 });
			let Answer = [{ name: `${name}.`, type: 16, TTL: 60, data: `"${text}"` }];
			return HttpResponse.json({ Status: 0, Answer });
		}),
	);
}

test("a domain that authorizes us passes every check", async () => {
	publish({
		"_dmarc.shop.com": "v=DMARC1; p=reject; rua=mailto:dmarc@shop.com",
		"shop.com": "v=spf1 include:_spf.mailer.example.com -all",
		"_spf.mailer.example.com": "v=spf1 ip4:203.0.113.0/24 -all",
		"mailer._domainkey.shop.com":
			"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ",
	});

	let findings = [
		unwrap(await checkDmarc("shop.com")),
		unwrap(await checkSpf("shop.com")),
		unwrap(await checkDkim("shop.com")),
	];

	expect(findings.every((finding) => finding.ok)).toBe(true);
});

test("a reporting-only policy is flagged", async () => {
	publish({ "_dmarc.shop.com": "v=DMARC1; p=none; rua=mailto:dmarc@shop.com" });

	let finding = unwrap(await checkDmarc("shop.com"));

	expect(finding.ok).toBe(false);
});
```

`Status: 3` is NXDOMAIN, which every check reads as nothing published. A test for
`mailTransportProblems` adds an MSW handler for `https://mta-sts.shop.com/.well-known/mta-sts.txt`
beside the DNS one, and `parseMtaStsPolicy(MTA_STS_POLICY)` in a plain unit test catches a typo
in your own policy before a sender does.

## Where to go next

- [Send email](/docs/data-and-background-work/send-email) — the transactional mail these
  records authenticate.
- [Custom domains for your customers](/docs/identity-and-security/verify-domains) — proving a
  customer owns the domain before you check what it publishes.
- [`@sdxc/email-auth`](/api/email-auth) — BIMI, the DMARC Tree Walk on its own, and every
  record field.
