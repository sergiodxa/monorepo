---
title: Check a domain's email authentication
description: Read the DMARC, SPF and DKIM records a sending domain publishes, serve an MTA-STS policy for your own domain, and parse the DMARC aggregate reports receivers send back.
section:
    title: Data & background work
    order: 7
order: 20
lastUpdated: 2026-10-25
outcomes:
    - "How to check a customer's DMARC policy, SPF lookups and DKIM key before you send from their domain"
    - "How to serve an MTA-STS policy and its TLS-RPT record for your own domain"
    - "What a DMARC aggregate report says about who sends mail as your domain"
---

When your app sends mail from a customer's domain, receivers judge it by the records that domain
publishes in DNS. A missing DKIM key, or an SPF record that never names your servers, lands that
mail in spam, and the customer blames your product. Checking the records before the first send
turns that into a checklist the customer can fix.

This guide builds that check as a background job over DMARC, SPF and DKIM, then serves an
MTA-STS policy for your own domain and reads the DMARC aggregate reports receivers send back.
[`@sdxc/email-auth`](/api/email-auth) parses and evaluates every record over DNS over HTTPS, so
it runs in a Worker, and [`@sdxc/jobs`](/api/jobs) runs the checks off the request.

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

`policy` is `null` when no DMARC applies, and `record.testing` is the `t=y` flag. A resolver that
could not answer is the failure, never "no policy", so the job retries it rather than telling the
customer their record is missing.

## Evaluate SPF for your sending address

SPF lists the addresses allowed to send for a domain. It fails when the record never authorizes
your servers, or when its `include` chain needs more than ten DNS lookups. `analyzeSpf` counts the
lookups and lists what is wrong; `checkHost` runs the evaluation a receiver runs for one address:

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

Each problem carries a `code`, such as `too-many-lookups`, and the domain it was found at.
`checkHost` answers a value rather than a `Result`: a DNS failure is its `temperror` result.

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
retry.

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
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) builds the queue.

> [!NOTE]
> Every lookup goes to Cloudflare's resolver by default and waits up to five seconds. Pass
> `{ timeoutMs, signal, resolver }` as the last argument of any discover or lookup call to change
> that, and keep the whole audit inside the job's own time limit.

## Serve an MTA-STS policy for your own domain

MTA-STS tells servers delivering mail to your domain to require TLS and accept only the MX hosts
you list. The policy is a text file at `https://mta-sts.<domain>/.well-known/mta-sts.txt`:

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
`v=STSv1; id=20261024`, and `_smtp._tls.example.com` with
`v=TLSRPTv1; rua=mailto:tls-reports@example.com`, where senders report the TLS failures they see.

> [!WARNING]
> Senders fetch the policy over HTTPS with no redirects and accept only a `200` with
> `text/plain`. Change the `id` in the TXT record every time the policy text changes, or senders
> keep the cached copy for `max_age` seconds. Start with `mode: testing` and read the TLS reports
> before switching to `enforce`, which refuses delivery when an MX host is missing from the list.

## Read DMARC aggregate reports

The `rua` address in a DMARC record receives a daily report from every large receiver: which
addresses sent mail as your domain, and whether DKIM and SPF passed. Most arrive gzipped:

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

A source that fails both DKIM and SPF is either a service you forgot to authorize or someone
sending as your domain, and `disposition` says what the receiver did with it.

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

`Status: 3` is NXDOMAIN, which every check reads as nothing published.

## Where to go next

- [Send email](/docs/data-and-background-work/send-email) — the transactional mail these
  records authenticate.
- [Custom domains for your customers](/docs/identity-and-security/verify-domains) — proving a
  customer owns the domain before you check what it publishes.
- [`@sdxc/email-auth`](/api/email-auth) — BIMI, the DMARC Tree Walk on its own, and every
  record field.
