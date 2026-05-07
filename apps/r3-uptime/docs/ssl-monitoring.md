# SSL Monitoring

## Purpose

SSL monitoring warns users before a certificate expires and surfaces certificate health alongside endpoint monitoring.

## What Users Configure

- Whether SSL monitoring is enabled
- Certificate expiry date
- Certificate issuer
- Warning threshold in days

## How It Works

1. SSL monitoring is enabled for an endpoint.
2. The system evaluates the certificate against the configured expiry information.
3. The certificate is classified into a status.
4. The feature can generate alerts when the certificate is expiring soon or already expired.

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

## Important Behavior Notes

- SSL monitoring is a certificate-lifecycle feature, not an uptime feature.
- It should integrate naturally with alerts and dashboards.
- The user experience should clearly distinguish expiring from expired certificates.

## Reimplementation Guidance

Preserve these product rules:

- SSL health must be visible from the same operational surfaces as monitor health.
- The feature needs proactive warning behavior, not only expired detection.
- Certificate data should be understandable to non-expert users: status, issuer, expiry date, and days remaining are the essentials.
