# ADR-038: Read Health Reports in HTTP Monitors

## Status

**Accepted** - 2026-10-24

## Background

An HTTP monitor decides its status from the response's status code and time, plus any
content checks. A health endpoint that answers `200` while telling the caller it is unhealthy
therefore reads as `up`. The IETF draft _Health Check Response Format for HTTP APIs_ gives
such endpoints a shared shape (`application/health+json`), and
[ADR-174](../ADR-174-health-checks.md) moves every app in this repo onto it through
`@sdxc/health`. Spring Boot, NestJS Terminus and other frameworks emit compatible bodies.
Uptime should read that report when a target sends one, so the status it shows reflects what
the service says about itself, and the team learns which of its dependencies is at fault.

## Context

### How an HTTP check works today

| Step                             | Where                                             | What it decides                                                                          |
| -------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Probe through a region-pinned DO | `HttpCheck.probe` in `app/services/http-check.ts` | Status code, response time; body only when content checks exist                          |
| Evaluate content checks          | `HttpCheck.evaluate`                              | Whether every enabled rule matched the body                                              |
| Classify                         | `HttpCheck.classify`                              | `down` on failure, wrong status or failed content check; `degraded` when slow; else `up` |
| Record and alert                 | `app/jobs/check-http.ts`                          | `monitor_results` row, `PING_RESULTS` point, alerts on transitions                       |

The ad-hoc ping endpoint and the public trial run the same `HttpCheck`.

### What a health report can tell uptime

| Field                               | Use to uptime                                                        | Visible to                           |
| ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| `status`                            | The service's own verdict: `pass`, `warn` or `fail`                  | Everyone who sees the monitor status |
| `checks` not passing                | Which dependency is at fault: name, status, `output`                 | The team only                        |
| top-level `output`                  | The service's own summary of what is wrong                           | The team only                        |
| `releaseId`, else `version`         | Which deploy answered, so an incident can be lined up with a release | The team only                        |
| `serviceId`, `description`          | Labels; already covered by the monitor's own name                    | Not stored                           |
| `checks` that pass, `observedValue` | Per-dependency latency; a chart of its own, out of scope here        | Not stored                           |
| `notes`, `links`                    | Free-form; nothing uptime acts on                                    | Not stored                           |

## Decision

1. **Detection is automatic.** A response whose `Content-Type` is `application/health+json`
   (parameters ignored, via `isHealthResponse` from `@sdxc/health`) is read as a report on
   every HTTP monitor, ad-hoc ping and trial. No setting turns it on; a team that does not
   want it points the monitor at a URL that does not send the format.
2. **The body is read when the header says so**, even when the monitor has no content
   checks, up to 64 KB. A larger body is treated as unreadable. Content checks keep matching
   the same text, so the body is read once.
3. **The report is parsed with `parseHealth`** from `@sdxc/health`, which validates against
   the published schema and normalizes the draft's status aliases (`ok`, `up`, `error`,
   `down`, any case) to `pass`, `warn` and `fail`.
4. **The report joins the classification** after the status-code and content checks:

   | Status code matches | Content checks | Report     | Monitor status                            |
   | ------------------- | -------------- | ---------- | ----------------------------------------- |
   | no                  | any            | any        | `down` (unchanged)                        |
   | yes                 | fail           | any        | `down` (unchanged)                        |
   | yes                 | pass           | `fail`     | `down`                                    |
   | yes                 | pass           | `warn`     | `degraded`                                |
   | yes                 | pass           | `pass`     | `up`, or `degraded` when slow (unchanged) |
   | yes                 | pass           | unreadable | as without a report                       |

   A compliant service answers `fail` with a 4xx or 5xx, which an expected `200` already
   classifies as `down`; the report then explains why. A service that answers `200` with
   `fail` is non-compliant but means what it says, so it is `down` too. An unreadable report
   never changes the status: the service did not say anything uptime can trust.

5. **What is stored per result** (`monitor_results`, three nullable columns):

   | Column           | Holds                                                                                                                           |
   | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
   | `health_status`  | `pass`, `warn`, `fail`, `invalid`, or `null` when no report was sent                                                            |
   | `health_release` | `releaseId`, else `version`, truncated to 128 characters                                                                        |
   | `health_failing` | JSON: up to 10 non-passing checks as `{ name, status, output }`, `output` capped at 200 characters, plus the top-level `output` |

   Only non-passing checks are stored, so a healthy result costs nothing beyond its status.
   `health_status` is also written to the `PING_RESULTS` data point as a blob, so analytics
   can count how often a monitor was degraded by its own report rather than by latency.

6. **Where it shows**:
   - **Monitor detail and result history**: the reported status, the failing checks with
     their output, and the release. A change of `health_release` between consecutive results
     is shown as a deploy marker on the response-time chart.
   - **Alerts** (email, Slack, Discord, webhooks): a transition caused by the report names it
     ("reported `fail`: `database:responseTime` timeout, `polar:responseTime` HTTP 503"), and
     the webhook payload carries `health_status` and `health_failing` as fields.
   - **Ad-hoc ping API**: the response gains a `health` object with the same three fields,
     so a CI step can print which dependency failed a deploy.
   - **Public status pages**: the monitor's status only. Check names, outputs and releases
     describe the team's internals and never appear on a public page.
7. **Docs**: `docs/http-monitors.md` gains the report to its status model, and a section
   explains what the format is and how a team adopts it.

### Changes by file

| File                                         | Change                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `app/services/http-check.ts`                 | Read the body when `isHealthResponse`; capped read; `HttpProbeOutcome.health`; classify |
| `app/jobs/check-http.ts`                     | Persist the three columns; pass the report to alerts                                    |
| `database/migrations/`                       | Add the three columns to `monitor_results`                                              |
| `app/services/analytics.ts`                  | `health_status` blob on the ping data point                                             |
| `app/services/alerts/`                       | Report-aware reason text and webhook fields                                             |
| monitor detail views, ad-hoc ping controller | Show and return the report                                                              |
| `docs/http-monitors.md`                      | Status model and adoption guide                                                         |

## Consequences

### Positive

- **A `200` no longer hides an outage**: a target that reports `fail` or `warn` reads as
  `down` or `degraded` whatever its status code.
- **Alerts say where to look**: the team sees which dependency failed without opening the
  target's logs, and a deploy marker shows whether an incident started with a release.
- **Zero configuration**: any target that already speaks the format (Spring Boot, Terminus,
  every app built on `@sdxc/health`) benefits on its next check.
- **One reader**: uptime parses with the same `@sdxc/health` code the apps use to read each
  other, so the two can never disagree on what a report means.

### Negative

- **Bodies are read more often**: a health endpoint's body is now read on every check, up to
  64 KB, which adds Worker CPU and a few milliseconds per check for those monitors.
- **Status can change without the target changing**: a team whose endpoint has always sent
  `warn` with `200` sees its monitor turn `degraded` on the release that ships this. The
  release note and the monitor's history say why.
- **Three more columns per result**: mostly `null`, but retained for the result's whole
  lifetime.

### Neutral

- A team cannot opt out per monitor; the escape hatch is a URL that sends another format.
  A setting can be added if a team asks for one.
- Per-dependency latency from passing checks is available in every report but not stored.

## Alternatives Considered

### 1. An opt-in "health endpoint" monitor setting

**Rejected because**: the `Content-Type` already declares the format unambiguously, and an
opt-in would leave every existing health monitor reading the status code alone.

### 2. Sniff any JSON body for a `status` field

**Rejected because**: `{ "status": "error" }` is common in ordinary API responses, so
sniffing would turn ordinary error payloads into health verdicts. The media type is the
target's explicit claim.

### 3. Store the whole report

**Rejected because**: passing checks and notes say nothing an incident needs, and a report
can be tens of kilobytes on every check of every monitor.

### 4. Treat an unreadable report as `down`

**Rejected because**: a malformed report is a bug in how the service describes itself, not
evidence that it is down. It is recorded as `invalid` so the team can see and fix it.

## References

- [ADR-174: Dependency health checks and `@sdxc/health`](../ADR-174-health-checks.md)
- [Health Check Response Format for HTTP APIs (IETF draft)](https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check-06)
- [HTTP monitors](../../../apps/uptime/docs/http-monitors.md)
- [Content checks](../../../apps/uptime/docs/content-checks.md)
