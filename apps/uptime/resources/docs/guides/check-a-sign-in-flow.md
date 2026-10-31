---
title: Check a sign-in flow
description: Confirm on a schedule that people can still sign in and reach their account, not only that your homepage loads.
section:
  title: Guides
  order: 2
order: 5
lastUpdated: 2026-10-31
notice: "Needs a verified team domain."
next: ["/docs/concepts/flow-monitors", "/docs/guides/choose-who-gets-alerted"]
keywords:
  [
    "flow monitor",
    "login check",
    "synthetic monitoring",
    "multi-step",
    "transaction",
    "browser check",
    "api check",
  ]
---

A flow monitor runs several steps in order and checks the result of each: sign in, carry the token, call the endpoint it unlocks. It may only reach hosts under a domain your team has verified, which keeps it from being pointed at someone else's site.

<mockup area="flow" caption="A flow monitor's page" />

<steps>
<step id="verify-your-domain" title="Verify your domain">

Skip this if your domain is already verified. A team owner or admin opens <uipath items={["Settings", "Domains", "Add Domain"]} />, enters the domain, and publishes the TXT record shown there. See [Team Domains](/docs/team/domains).

Verifying `example.com` also covers `app.example.com`, `api.example.com` and every other subdomain.

</step>
<step id="create-a-test-account" title="Create a test account">

Sign up a dedicated account the monitor can use, such as `uptime-monitor@example.com`. Its password is written into the flow, and anyone on your team who can open the monitor can read it, so give it no real data or privileges.

</step>
<step id="write-the-flow" title="Write the flow">

Open <ui>Flow Monitors</ui> in the sidebar and click <ui>Create</ui>. Give it a <ui>Monitor name</ui>, then write the steps in <ui>Flow</ui>. This one signs in through an API, then uses the token it got back:

```text title="Flow"
test "a member can sign in and load their account" {
	when {
		let session = http.post "https://app.example.com/api/sessions" form {
			email: "uptime-monitor@example.com"
			password: "the monitor account's password"
		}
		let account = http.get "https://api.example.com/v1/account" bearer session.json.token
	}
	then {
		expect session.status 200
		expect account.status 200
		expect account.json.email "uptime-monitor@example.com"
	}
}
```

To drive the real sign-in page the way a person would, start the flow with `use browser` and use `browser.open`, `browser.fill` and `browser.click` instead. The [Flow Monitors](/docs/concepts/flow-monitors#browser) reference has an example and every step you can write.

</step>
<step id="choose-how-often" title="Choose how often">

Pick <ui>Run every</ui>: 15 minutes at the most frequent, up to once a day. The default is 1 hour. Leave <ui>Enabled</ui> on and click <ui>Create flow monitor</ui>.

If the flow names a host no verified domain covers, it isn't saved and the message names that host.

</step>
<step id="run-it-once" title="Run it once">

On the monitor's page, click <ui>Run now</ui>. The result says how many tests passed; when one fails, **Last failure** names the test and the line it broke on.

</step>
</steps>

## What it costs

A flow that only makes HTTP requests uses one ping per request, from the same allowance as your other checks: the two-request flow above, run hourly, uses 1,440 pings in a 30-day month. A flow that uses the browser is billed $0.0025 per run instead, with no runs included in the subscription.

<faq>
<question title="Why can't it run every minute?">

A flow makes several requests per run, so the shortest interval is 15 minutes. Put an [HTTP monitor](/docs/guides/add-a-monitor) on the endpoint the flow depends on for minute-by-minute checks, and let the flow cover the sequence.

</question>
<question title="What limits does one run have?">

A run may take up to 30 seconds and make up to 20 requests, and each response is read up to 1 MB. A run that hits a limit shows as <ui>Cannot run</ui>, not as failing. See [My flow monitor fails or can't run](/docs/troubleshooting/flow-monitor-fails).

</question>
</faq>
