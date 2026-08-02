# Ad-Hoc Pings

## Purpose

Ad-hoc pings let an API caller probe a target once, immediately, without creating a monitor. They answer "is this reachable right now?" for targets that are not worth monitoring continuously — most often a preview deployment in a continuous integration pipeline, which exists on a freshly created address for the length of a build and is destroyed afterwards.

The feature exists because expressing that with monitors is wrong in both directions: it stores a configuration nobody wants kept, and it waits for a scheduler that was never meant to answer a question synchronously.

## Two Surfaces

The same ad-hoc check is reachable two ways, with the same rules, the same billing, and the same absence of stored history behind both.

**The API** takes every option the feature has and all three probe types. It is the surface a pipeline uses.

**The dashboard quick check** is a single URL box above the team's stat cards. It runs HTTP only and exposes no options at all: a URL box is the shape of an HTTP question, and asking one control to also accept a bare domain or a `host:port` would make the field mean three things depending on what was typed into it. Every option the API takes is fixed to the same default the API applies when it is omitted. Someone who needs to vary the method, expected status, or region uses the API.

The quick check is a member-level action — any team member can run one, since running one is no more privileged than viewing a monitor.

## What Users Configure

Nothing is stored, so there is no configuration screen. Everything is supplied per request:

- The probe type: HTTP, DNS, or TCP (the dashboard quick check is always HTTP)
- The target: a URL, a domain, or a host and port
- Type-specific options: method, expected status, timeout, degraded threshold, region, headers, request body, content checks, DNS record type, expected DNS value
- An API key carrying the ad-hoc ping permission, or, on the dashboard, a signed-in team membership

## How It Works

1. The caller sends one request describing the probe.
2. The system verifies the API key, its permission, and the team owner's subscription.
3. The system performs the probe immediately, from the requested region, using the same probing behavior a monitor of that type uses.
4. The system classifies the outcome into a status.
5. The result is returned in the response.
6. The ping is counted against the team's metered ping allowance.

Nothing else happens. No monitor is created, no result is stored, no history is written, no alert is evaluated, and no notification is sent.

## Status Model

Each probe type keeps the status vocabulary its monitored counterpart uses, so one outcome has one name across the product.

HTTP:

- `up`: the response matched the expected status, within the degraded threshold, and every content check passed
- `degraded`: the response was correct but slower than the degraded threshold
- `down`: the response did not arrive, did not match the expected status, or failed a content check

DNS:

- `ok`: the record resolved
- `changed`: an expected value was supplied and the resolved value did not match it
- `error`: the record could not be resolved

TCP:

- `up`: the connection was accepted
- `down`: the connection was refused or failed
- `timeout`: the connection did not complete within the timeout

There is no `pending` and no `disabled` state. A ping is performed or it is refused; it is never queued.

## Request Outcome Versus Target Outcome

This is the central rule of the feature, and the one an integration is most likely to get wrong.

- A probe that completed is a **successful request**, whatever it found. A target that is down returns a success response carrying a `down`, `error`, or `timeout` status.
- A failure response means the **request** could not be performed: the key was rejected, the permission was missing, the subscription was inactive, the body was invalid, the rate limit was exceeded, or the system itself failed.

The two are deliberately separate axes. Collapsing them would make "your service is unreachable" indistinguishable from "we could not check", and only the first should fail a build. Callers must branch on the status in the payload, never on the response status alone.

## Ping Rules

- The caller's API key must carry the ad-hoc ping permission, which is separate from monitor read and write permissions so it can be granted to an automation narrowly and revoked on its own.
- The team owner must hold an active subscription. Unsubscribed teams do not have their monitors checked either, so they do not get ad-hoc probes.
- Ad-hoc probing is rate limited per API key, not per source address, because automation runners routinely share outbound addresses.
- Every accepted ping is billable and counts against the same metered ping allowance as monitor checks.
- A ping refused before it runs — invalid body, missing permission, inactive subscription, rate limited — is not billed.

## Billing and Usage

- Ad-hoc pings are counted in the team's monthly ping usage alongside every monitor check.
- Because they belong to no monitor, they appear in the team's total but on no monitor's usage figure. The per-monitor figures therefore do not sum to the team total for teams that use this feature.
- The allowance and overage model is the same one the pricing page describes: a fixed number of pings included in the subscription, then whole indivisible blocks past it.

## Defaults and Limits

- HTTP method defaults to `GET`.
- HTTP expected status defaults to `200`.
- HTTP timeout defaults to `10` seconds and should support `1` through `60`.
- HTTP degraded threshold defaults to `5000` ms.
- Region defaults to western North America, and the same nine regions a monitor can be probed from are accepted.
- DNS record type defaults to `A`, from the same record types a DNS monitor supports.
- DNS expected value is optional; without it the `changed` status cannot occur.
- TCP timeout defaults to `5000` ms and should support `100` through `60000`.
- TCP port should support `1` through `65535`.
- Rate limit is 60 requests per minute per API key.

Every default matches the equivalent monitor's default. That is intentional: a ping run with a minimal body must behave the way a monitor created with an untouched form behaves, so an ad-hoc result predicts what continuous monitoring of the same target will report.

## Visible Outputs

The response is the only output. It carries:

- A generated identifier for the ping, for correlating a build log with a support conversation
- The probe type
- The status
- The time the check was performed
- For HTTP: the response status, the response time, and whether content checks passed
- For DNS: the resolved value, the response time, and an error message when resolution failed
- For TCP: the response time and an error message when the connection failed

The identifier does not address anything. There is no endpoint to fetch a past ping, because keeping one would mean storing the history the feature exists to avoid.

On the dashboard, the result appears beneath the URL box as a status badge with the response code and time. It is shown once: the card renders it and discards it, so the next load of the card is an empty form again, because a result that lingered would go on describing a check that happened an unknown length of time ago. Only the card refreshes when a check runs — the stat cards and the monitor table around it are untouched, so a check costs nothing the rest of the page has already loaded.

## Feature Interactions

- Ad-hoc pings never create alerts, never affect a monitor's status, and never appear in uptime percentages or result histories.
- Maintenance windows do not suppress them: the caller asked for a probe now, and a suppressed answer would be indistinguishable from a broken one.
- Content checks are supplied inline per request rather than referenced from a monitor's stored rules, because there is no monitor to reference.
- Results are visible to internal analytics but not to any customer-facing history view.

## Important Behavior Notes

- The probe runs from the same regions, with the same timeout and classification rules, as the monitored equivalent. Comparability with monitoring is the feature's value; a separate probing path would quietly destroy it.
- The endpoint is synchronous. Its latency is the target's latency plus a small constant, which is why nothing slow — least of all usage reporting — may be awaited before responding.
- A probe that is billed but whose usage report fails is still a completed probe. Reporting is best-effort and never blocks or fails a check.

## Reimplementation Guidance

Preserve these product rules:

- One request, one probe, one response, nothing stored.
- Defaults must track the corresponding monitor defaults, not drift into their own set.
- A failing target must be reported as a successful request with a failing status.
- Failure responses must be reserved for the request itself, and must distinguish an authentication failure, a missing permission, an inactive subscription, a validation failure, and a rate limit from one another.
- Accepted pings must be metered exactly like monitor checks, and refused ones must not be.
- The permission required must be distinct from monitor management permissions.
