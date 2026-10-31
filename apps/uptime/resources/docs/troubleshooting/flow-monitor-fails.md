---
title: My flow monitor fails or can't run
description: Tell a broken sign-in apart from a flow that needs fixing, and get the monitor passing again.
section:
  title: Fix a problem
  order: 3
order: 4
lastUpdated: 2026-10-31
next: ["/docs/guides/check-a-sign-in-flow", "/docs/concepts/flow-monitors"]
keywords:
  [
    "flow error",
    "flow failing",
    "cannot run",
    "verified domain",
    "assertion failed",
    "login check failing",
  ]
---

A flow monitor shows one of two problem states. <ui>Failing</ui> means a test ran and an expectation didn't hold, which alerts. <ui>Cannot run</ui> means Uptime couldn't finish the run, which never alerts. Open the monitor's page and click <ui>Run now</ui> to see the current result.

## If a step's expectation fails

The run is <ui>Failing</ui> and **Last failure** names the test and the line it stopped on. Usually your service really changed: the sign-in rejected the account, an endpoint answered `401`, a field moved in the JSON.

Read the failure detail against that line of the flow. If the service is right and the flow is out of date, open <ui>Edit</ui>, update the step or the expected value, click <ui>Save changes</ui>, then <ui>Run now</ui>.

## If the test account stopped working

A flow that signs in depends on its account. A changed or expired password, a locked account or a new second-factor prompt makes the sign-in step fail on every run.

Sign in as that account yourself, fix it, and update the password in the flow with <ui>Edit</ui>.

## If the flow reaches a host no verified domain covers

Every address in the flow has to sit under one of your team's verified domains, checked before every run. A redirect to another domain, or a domain your team has since removed, stops the run, and it shows <ui>Cannot run</ui>. A host outside your verified domains is refused when you save the flow, with a message naming it.

Ask a team owner or admin to verify the domain under <uipath items={["Settings", "Domains"]} />, or change the flow to use a host you've verified. See [Team Domains](/docs/team/domains).

## If the run hit a limit

One run may take 30 seconds and make 20 requests, and each response is read up to 1 MB. A run past any of these shows <ui>Cannot run</ui>, with a message such as "This flow made too many requests".

Split a long flow into two monitors, and point steps at the endpoint or page you assert on rather than at a large export.

## If the flow doesn't parse

A typo, a phase out of order (`given`, then `when`, then `then`) or a URL built at run time instead of written out stops the flow before it starts. The message gives the reason.

Fix the source with <ui>Edit</ui>. Every URL must be written in full in the flow. See [Writing a Flow](/docs/concepts/flow-monitors#writing-a-flow).

<faq>
<question title="Why didn't I get an alert when it showed Cannot run?">

<ui>Cannot run</ui> means the run didn't find out anything about your service, so it doesn't page anyone. Check the monitor's page after you change a flow, and use <ui>Run now</ui> to try it straight away.

</question>
</faq>
