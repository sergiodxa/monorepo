# Publishing Schedule

This schedule orders content to avoid broken links. Content is grouped into waves where each wave only links to already-published content or content from previous waves.

## Already Published on sergiodxa.com

These URLs are already live and can be linked to freely:

**Articles:**

- /articles/result-objects-in-ts
- /articles/dependency-injection-in-remix-loaders-and-actions
- /articles/http-vs-server-side-cache-in-remix
- /articles/oauth2-tokens-explained
- /articles/jwt-vs-opaque-tokens
- /articles/oauth2-scopes-explained
- /articles/oauth2-audience-explained
- /articles/oauth2-access-token-claims-explained
- /articles/working-with-refresh-tokens-in-remix
- /articles/dark-mode-and-dark-context
- /articles/building-a-command-palette-with-remix-and-tailwind-ui
- /articles/react-router-loaders-and-actions-as-integration-points (Feb 20, 2026)

**Tutorials:**

- /tutorials/use-sec-fetch-headers-for-csrf (Feb 22, 2026)
- /tutorials/use-middleware-in-react-router
- /tutorials/create-a-per-request-singleton-with-react-router-middleware
- /tutorials/test-middleware-in-react-router
- /tutorials/split-routes-config-in-react-router
- /tutorials/use-action-routes-in-react-router
- /tutorials/expose-remix-routes-as-api-endpoints
- /tutorials/add-dynamic-canonical-url-to-remix-routes
- /tutorials/generate-cloudflare-environment-type-with-wrangler
- /tutorials/use-pkce-in-oauth2-authorization-code-flow
- /tutorials/validate-jwts-with-jwks
- /tutorials/add-custom-claims-to-jwt-access-tokens
- /tutorials/validate-exp-iat-and-nbf-in-jwts
- /tutorials/use-scope-to-authorize-actions-in-your-api
- /tutorials/use-client_id-and-client_secret-in-oauth2
- /tutorials/revoke-a-refresh-token-in-oauth2
- /tutorials/validate-form-in-remix-with-clientaction
- /tutorials/parse-markdown-with-markdoc-in-remix
- /tutorials/add-syntax-highlight-to-markdoc-using-prism-js
- /tutorials/simplify-component-imports-with-typescript-namespaces
- /tutorials/keep-heading-levels-consistent-with-react-context
- /tutorials/add-a-color-scheme-toggle-in-react-router
- /tutorials/test-remix-loaders-and-actions
- /tutorials/avoid-waterfalls-of-queries-in-remix-loaders
- /tutorials/load-only-the-data-you-need-in-remix
- /tutorials/persist-the-user-locale-using-cookies-with-remix-i18next
- /tutorials/add-i18n-to-a-remix-vite-app

---

## Wave 1: No Local Dependencies (8 tutorials)

These files only link to already-published content.

| #   | Type     | File                                                             | Links To       |
| --- | -------- | ---------------------------------------------------------------- | -------------- |
| 1   | Tutorial | `create-a-multi-directory-route-organization-in-react-router.md` | Published only |
| 2   | Tutorial | `create-a-per-request-database-instance-with-middleware.md`      | Published only |
| 3   | Tutorial | `add-url-normalization-middleware-in-react-router.md`            | Published only |
| 4   | Tutorial | `access-request-context-anywhere-with-asynclocalstorage.md`      | Published only |
| 5   | Tutorial | `build-type-safe-response-helpers-for-react-router.md`           | Published only |
| 6   | Tutorial | `use-client-hints-for-server-side-timezone-rendering.md`         | Published only |
| 7   | Tutorial | `create-a-color-system-with-react-context.md`                    | Published only |
| 8   | Tutorial | `create-animated-tab-indicators-with-css-variables.md`           | Published only |

---

## Wave 2: Foundation (9 items)

| #   | Type     | File                                                       | Depends On                                                             |
| --- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| 9   | Tutorial | `build-a-cache-abstraction-for-cloudflare-kv.md`           | Published only                                                         |
| 10  | Tutorial | `build-a-universal-validator-with-standard-schema.md`      | Published only                                                         |
| 11  | Tutorial | `create-type-safe-jwt-wrapper-classes.md`                  | Published only                                                         |
| 12  | Tutorial | `create-reusable-drizzle-column-factories.md`              | Published only                                                         |
| 13  | Tutorial | `build-a-promise-based-confirmation-dialog.md`             | create-a-color-system (W1)                                             |
| 14  | Tutorial | `build-an-accessible-carousel-with-keyboard-navigation.md` | create-animated-tab-indicators (W1)                                    |
| 15  | Tutorial | `build-a-composable-heatmap-component.md`                  | Published only                                                         |
| 16  | Article  | `building-accessible-ui-with-react-aria-components.md`     | build-an-accessible-carousel (W2), create-animated-tab-indicators (W1) |
| 17  | Article  | `designing-for-testability-in-serverless-functions.md`     | Published only                                                         |

---

## Wave 3: Core Patterns (14 items)

| #   | Type     | File                                                       | Depends On                                                                                 |
| --- | -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 18  | Tutorial | `use-waituntil-for-non-blocking-cache-writes.md`           | build-a-cache-abstraction (W2)                                                             |
| 19  | Tutorial | `parse-multiple-input-formats-in-one-validator.md`         | build-a-universal-validator (W2)                                                           |
| 20  | Tutorial | `implement-entity-attribute-value-pattern-with-drizzle.md` | create-reusable-drizzle (W2)                                                               |
| 21  | Tutorial | `add-lazy-loading-for-related-data-in-drizzle.md`          | create-reusable-drizzle (W2), implement-eav (W3)                                           |
| 22  | Tutorial | `build-a-command-palette-component.md`                     | building-accessible-ui (W2)                                                                |
| 23  | Tutorial | `store-authorization-codes-with-kv-ttl.md`                 | build-a-cache-abstraction (W2)                                                             |
| 24  | Article  | `compound-component-pattern-in-react.md`                   | building-accessible-ui (W2), build-a-composable-heatmap (W2), build-a-command-palette (W3) |
| 25  | Article  | `the-service-layer-pattern-in-react-router-apps.md`        | designing-for-testability (W2)                                                             |
| 26  | Article  | `the-three-states-of-service-health.md`                    | None local (starts monitoring cluster)                                                     |
| 27  | Article  | `error-classification-in-background-job-systems.md`        | None local (starts job cluster)                                                            |
| 28  | Article  | `the-batched-logger-pattern-for-workers.md`                | None local (starts logger cluster)                                                         |
| 29  | Article  | `building-a-monorepo-with-shared-packages.md`              | designing-for-testability (W2)                                                             |
| 30  | Article  | `pattern-matching-in-typescript-with-match.md`             | build-a-universal-validator (W2)                                                           |
| 31  | Article  | `advanced-typescript-detecting-the-any-type.md`            | build-a-universal-validator (W2), create-type-safe-jwt (W2)                                |

---

## Wave 4: Infrastructure (17 items)

| #   | Type     | File                                                      | Depends On                                                                            |
| --- | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 32  | Tutorial | `classify-errors-for-job-retry-behavior.md`               | error-classification (W3)                                                             |
| 33  | Tutorial | `build-a-job-framework-for-cloudflare-queues.md`          | classify-errors (W4), designing-for-testability (W2)                                  |
| 34  | Tutorial | `create-a-collapsible-sidebar-with-cookie-persistence.md` | build-a-command-palette (W3)                                                          |
| 35  | Tutorial | `use-cloudflare-analytics-engine-for-time-series-data.md` | use-waituntil (W3), build-a-cache-abstraction (W2)                                    |
| 36  | Tutorial | `build-an-oauth2-oidc-provider-from-scratch.md`           | store-authorization-codes (W3), create-type-safe-jwt (W2)                             |
| 37  | Tutorial | `create-a-copy-button-for-code-blocks.md`                 | building-accessible-ui (W2)                                                           |
| 38  | Article  | `status-codes-lie.md`                                     | the-three-states (W3)                                                                 |
| 39  | Article  | `use-case-pattern-vs-service-layer.md`                    | the-service-layer (W3), designing-for-testability (W2)                                |
| 40  | Article  | `class-based-models-with-drizzle-orm.md`                  | add-lazy-loading (W3), create-reusable-drizzle (W2), implement-eav (W3)               |
| 41  | Article  | `two-logger-strategies-immediate-vs-batched.md`           | the-batched-logger (W3)                                                               |
| 42  | Article  | `multi-entry-package-architecture.md`                     | building-a-monorepo (W3)                                                              |
| 43  | Article  | `oauth2-error-hierarchies-in-typescript.md`               | error-classification (W3)                                                             |
| 44  | Article  | `the-location-class-urls-without-origins.md`              | create-type-safe-jwt (W2), advanced-typescript (W3), build-a-universal-validator (W2) |
| 45  | Tutorial | `link-oauth-accounts-with-local-user-profiles.md`         | build-an-oauth2-oidc (W4), create-type-safe-jwt (W2)                                  |
| 46  | Tutorial | `implement-retry-with-configurable-backoff.md`            | classify-errors (W4), build-a-job-framework (W4)                                      |
| 47  | Tutorial | `implement-content-matching-rules.md`                     | status-codes-lie (W4), the-three-states (W3)                                          |
| 48  | Tutorial | `build-an-api-client-with-before-after-hooks.md`          | status-codes-lie (W4)                                                                 |

---

## Wave 5: Monitoring & Jobs (14 items)

| #   | Type     | File                                                  | Depends On                                                                    |
| --- | -------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| 49  | Tutorial | `build-a-type-safe-queue-job-system-with-zod.md`      | build-a-job-framework (W4), classify-errors (W4), use-waituntil (W3)          |
| 50  | Tutorial | `cache-analytics-engine-queries-with-kv.md`           | use-analytics-engine (W4), build-a-cache-abstraction (W2), use-waituntil (W3) |
| 51  | Tutorial | `build-a-multi-handler-cloudflare-worker.md`          | use-waituntil (W3), build-a-type-safe-queue (W5)                              |
| 52  | Tutorial | `use-cloudflare-workflows-for-long-running-tasks.md`  | implement-retry (W4), the-batched-logger (W3), build-a-job-framework (W4)     |
| 53  | Tutorial | `implement-api-key-authentication-with-sha-256.md`    | build-an-oauth2-oidc (W4)                                                     |
| 54  | Tutorial | `build-a-type-safe-markdown-pipeline-with-markdoc.md` | multi-entry-package (W4), create-a-copy-button (W4)                           |
| 55  | Article  | `grace-periods-designing-for-variance.md`             | the-three-states (W3), implement-retry (W4)                                   |
| 56  | Article  | `multi-protocol-monitoring.md`                        | status-codes-lie (W4)                                                         |
| 57  | Article  | `head-vs-get-health-check-tradeoff.md`                | status-codes-lie (W4), multi-protocol (W5), implement-content-matching (W4)   |
| 58  | Tutorial | `generate-rss-feeds-in-react-router.md`               | build-a-type-safe-markdown (W5)                                               |
| 59  | Tutorial | `generate-sitemaps-in-react-router.md`                | generate-rss-feeds (W5)                                                       |
| 60  | Tutorial | `make-geo-located-requests-with-durable-objects.md`   | use-cloudflare-workflows (W5)                                                 |
| 61  | Article  | `designing-alerts-that-dont-cause-fatigue.md`         | grace-periods (W5), the-three-states (W3)                                     |
| 62  | Tutorial | `build-an-alert-cooldown-system.md`                   | designing-alerts (W5), the-three-states (W3), grace-periods (W5)              |

---

## Wave 6: Alerting Patterns (10 items)

| #   | Type     | File                                                | Depends On                                                                                              |
| --- | -------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 63  | Article  | `the-dead-mans-switch-pattern.md`                   | the-three-states (W3), grace-periods (W5)                                                               |
| 64  | Article  | `why-ping-at-the-end-changes-everything.md`         | the-dead-mans-switch (W6), grace-periods (W5)                                                           |
| 65  | Article  | `separating-detection-from-notification.md`         | the-dead-mans-switch (W6), the-three-states (W3)                                                        |
| 66  | Article  | `recovery-notifications-are-not-optional.md`        | grace-periods (W5), designing-alerts (W5)                                                               |
| 67  | Article  | `redundant-notification-channels.md`                | build-a-job-framework (W4), error-classification (W3), the-dead-mans-switch (W6), designing-alerts (W5) |
| 68  | Article  | `webhook-signing-hmac-for-notification-security.md` | designing-alerts (W5), implement-api-key-auth (W5)                                                      |
| 69  | Article  | `maintenance-windows-as-a-first-class-concept.md`   | the-three-states (W3), separating-detection (W6)                                                        |
| 70  | Article  | `regional-monitoring-latency-is-not-universal.md`   | the-three-states (W3), designing-alerts (W5), build-an-alert-cooldown (W5)                              |
| 71  | Article  | `why-dns-failures-are-hard-to-diagnose.md`          | separating-detection (W6), make-geo-located-requests (W5)                                               |
| 72  | Tutorial | `implement-recurring-maintenance-windows.md`        | maintenance-windows (W6), designing-alerts (W5)                                                         |

---

## Wave 7: Final (4 items)

| #   | Type    | File                                                       | Depends On                                                                                                         |
| --- | ------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 73  | Article | `status-pages-transparency-as-a-feature.md`                | the-three-states (W3), maintenance-windows (W6), recovery-notifications (W6)                                       |
| 74  | Article | `recurring-maintenance-automating-operational-overhead.md` | maintenance-windows (W6), recovery-notifications (W6), designing-alerts (W5), implement-recurring-maintenance (W6) |
| 75  | Article | `ssl-certificates-as-a-silent-failure-mode.md`             | why-dns-failures (W6), designing-alerts (W5), multi-protocol (W5)                                                  |
| 76  | Article | `dns-as-a-security-surface.md`                             | why-dns-failures (W6), regional-monitoring (W6), status-codes-lie (W4)                                             |

---

## Summary

| Wave      | Articles | Tutorials | Total  |
| --------- | -------- | --------- | ------ |
| 1         | 0        | 8         | 8      |
| 2         | 2        | 7         | 9      |
| 3         | 7        | 7         | 14     |
| 4         | 6        | 11        | 17     |
| 5         | 5        | 9         | 14     |
| 6         | 8        | 2         | 10     |
| 7         | 4        | 0         | 4      |
| **Total** | **32**   | **44**    | **76** |

---

## Recommended Publishing Pace

- **Daily**: 2-3 pieces per day
- **Weekly**: ~15 pieces per week
- **Complete in**: ~5-6 weeks

### Week 1

- Wave 1 (8 pieces)
- Wave 2 (9 pieces) - 17 total

### Week 2

- Wave 3 (14 pieces) - 31 total

### Week 3

- Wave 4 (17 pieces) - 48 total

### Week 4

- Wave 5 (14 pieces) - 62 total

### Week 5

- Wave 6 (10 pieces) - 72 total
- Wave 7 (4 pieces) - 76 total

---

## Quick Reference: Publishing Order

```
WAVE 1 (8)
├── create-a-multi-directory-route-organization-in-react-router
├── create-a-per-request-database-instance-with-middleware
├── add-url-normalization-middleware-in-react-router
├── access-request-context-anywhere-with-asynclocalstorage
├── build-type-safe-response-helpers-for-react-router
├── use-client-hints-for-server-side-timezone-rendering
├── create-a-color-system-with-react-context
└── create-animated-tab-indicators-with-css-variables

WAVE 2 (9)
├── build-a-cache-abstraction-for-cloudflare-kv
├── build-a-universal-validator-with-standard-schema
├── create-type-safe-jwt-wrapper-classes
├── create-reusable-drizzle-column-factories
├── build-a-promise-based-confirmation-dialog
├── build-an-accessible-carousel-with-keyboard-navigation
├── build-a-composable-heatmap-component
├── building-accessible-ui-with-react-aria-components
└── designing-for-testability-in-serverless-functions

WAVE 3 (14)
├── use-waituntil-for-non-blocking-cache-writes
├── parse-multiple-input-formats-in-one-validator
├── implement-entity-attribute-value-pattern-with-drizzle
├── add-lazy-loading-for-related-data-in-drizzle
├── build-a-command-palette-component
├── store-authorization-codes-with-kv-ttl
├── compound-component-pattern-in-react
├── the-service-layer-pattern-in-react-router-apps
├── the-three-states-of-service-health
├── error-classification-in-background-job-systems
├── the-batched-logger-pattern-for-workers
├── building-a-monorepo-with-shared-packages
├── pattern-matching-in-typescript-with-match
└── advanced-typescript-detecting-the-any-type

WAVE 4 (17)
├── classify-errors-for-job-retry-behavior
├── build-a-job-framework-for-cloudflare-queues
├── create-a-collapsible-sidebar-with-cookie-persistence
├── use-cloudflare-analytics-engine-for-time-series-data
├── build-an-oauth2-oidc-provider-from-scratch
├── create-a-copy-button-for-code-blocks
├── status-codes-lie
├── use-case-pattern-vs-service-layer
├── class-based-models-with-drizzle-orm
├── two-logger-strategies-immediate-vs-batched
├── multi-entry-package-architecture
├── oauth2-error-hierarchies-in-typescript
├── the-location-class-urls-without-origins
├── link-oauth-accounts-with-local-user-profiles
├── implement-retry-with-configurable-backoff
├── implement-content-matching-rules
└── build-an-api-client-with-before-after-hooks

WAVE 5 (14)
├── build-a-type-safe-queue-job-system-with-zod
├── cache-analytics-engine-queries-with-kv
├── build-a-multi-handler-cloudflare-worker
├── use-cloudflare-workflows-for-long-running-tasks
├── implement-api-key-authentication-with-sha-256
├── build-a-type-safe-markdown-pipeline-with-markdoc
├── grace-periods-designing-for-variance
├── multi-protocol-monitoring
├── head-vs-get-health-check-tradeoff
├── generate-rss-feeds-in-react-router
├── generate-sitemaps-in-react-router
├── make-geo-located-requests-with-durable-objects
├── designing-alerts-that-dont-cause-fatigue
└── build-an-alert-cooldown-system

WAVE 6 (10)
├── the-dead-mans-switch-pattern
├── why-ping-at-the-end-changes-everything
├── separating-detection-from-notification
├── recovery-notifications-are-not-optional
├── redundant-notification-channels
├── webhook-signing-hmac-for-notification-security
├── maintenance-windows-as-a-first-class-concept
├── regional-monitoring-latency-is-not-universal
├── why-dns-failures-are-hard-to-diagnose
└── implement-recurring-maintenance-windows

WAVE 7 (4)
├── status-pages-transparency-as-a-feature
├── recurring-maintenance-automating-operational-overhead
├── ssl-certificates-as-a-silent-failure-mode
└── dns-as-a-security-surface
```
