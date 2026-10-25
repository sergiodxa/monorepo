# SSL Monitoring

## Purpose

SSL monitoring warns users before a certificate expires and surfaces certificate health alongside endpoint monitoring.

## What Users Configure

- Whether SSL monitoring is enabled
- Certificate expiry date and issuer, optional: left empty, both come from Certificate Transparency logs; typed, they override the logs (`ssl_expiry_source` is `manual`)
- Warning threshold in days

## How It Works

1. SSL monitoring is enabled for an endpoint.
2. For a monitor reading the logs, the daily check searches Cert Spotter's issuances API (`api.certspotter.com/v1/issuances`, `match_wildcards=true`) for the URL's host through `@sdxc/outbound`. Of the unrevoked certificates whose names cover the host (exact or one-label wildcard) and that are valid now, it takes the latest `notBefore`, and writes its `notAfter` and issuer. Answers are cached in KV per host for six hours, and a `429` stops further lookups for the rest of the run. Saving SSL settings without a date queues `checkCertificate` for that monitor.
3. The system evaluates the certificate against the expiry information.
4. The certificate is classified into a status.
5. The feature can generate alerts when the certificate is expiring soon or already expired.

## Status Model

- `unknown`: no certificate state is available yet
- `valid`: the certificate is healthy and outside the warning window
- `expiring`: the certificate is within the warning window
- `expired`: the certificate is already expired
- `error`: the certificate could not be evaluated reliably
- `not configured`: SSL monitoring is turned off for the endpoint

## Scheduling Rules

- SSL monitoring is designed as a daily check rather than a per-minute check.
- The product evaluates certificate status once per day.
- Alerts are meant to happen around key warning thresholds before expiry and again on expiry.

## Visible Outputs

- SSL status badge
- Expiry date
- Days remaining
- Issuer
- Last checked time
- Team-level counts of valid, expiring, and expired certificates

## Defaults and Limits

- SSL monitoring is off by default.
- The default warning threshold is `30` days.
- Warning thresholds are intended to support at least `1` through `365` days.

## Certificate Transparency Source

- crt.sh was evaluated and rejected: its JSON search took 20 to 112 seconds or answered 502 in testing. Cert Spotter answered in under a second and returns only unexpired certificates with precertificates merged.
- Cert Spotter allows 100 unauthenticated requests per hour (`x-ratelimit-limit`), and a host typically costs two (one page plus the empty page after it). More SSL-monitored hosts than that per day needs a Cert Spotter API key.
- `ssl_transparency_status` records the last lookup: `found`, `not-found` (the logs answered with no valid certificate for the host, or the host is an IP address) or `unavailable` (the search failed, was rate limited, or ran past five pages). Only `found` changes the expiry; the others keep the last known certificate.
- CT shows issuance, so a certificate issued and not yet deployed counts as the newest.

## Important Behavior Notes

- SSL monitoring is a certificate-lifecycle feature, not an uptime feature.
- It should integrate naturally with alerts and dashboards.
- The user experience should clearly distinguish expiring from expired certificates.

## Reimplementation Guidance

Preserve these product rules:

- SSL health must be visible from the same operational surfaces as monitor health.
- The feature needs proactive warning behavior, not only expired detection.
- Certificate data should be understandable to non-expert users: status, issuer, expiry date, and days remaining are the essentials.
