# Publishing Schedule

Ordered list for one-by-one publishing. Each item only links to already-published content or items earlier in this list.

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

## Publishing Order (78 items)

| #   | Published | File                                                                           | Depends On         |
| --- | --------- | ------------------------------------------------------------------------------ | ------------------ |
| 1   | [x]       | [](./articles/react-router-loaders-and-actions-as-integration-points.md)       | —                  |
| 2   | [x]       | [](./tutorials/use-sec-fetch-headers-for-csrf.md)                              | —                  |
| 3   | [ ]       | [](./tutorials/create-a-multi-directory-route-organization-in-react-router.md) | —                  |
| 4   | [ ]       | [](./tutorials/create-a-per-request-database-instance-with-middleware.md)      | —                  |
| 5   | [ ]       | [](./tutorials/add-url-normalization-middleware-in-react-router.md)            | —                  |
| 6   | [ ]       | [](./tutorials/access-request-context-anywhere-with-asynclocalstorage.md)      | —                  |
| 7   | [ ]       | [](./tutorials/build-type-safe-response-helpers-for-react-router.md)           | —                  |
| 8   | [ ]       | [](./tutorials/use-client-hints-for-server-side-timezone-rendering.md)         | —                  |
| 9   | [ ]       | [](./tutorials/create-a-color-system-with-react-context.md)                    | —                  |
| 10  | [ ]       | [](./tutorials/create-animated-tab-indicators-with-css-variables.md)           | —                  |
| 11  | [ ]       | [](./tutorials/build-a-cache-abstraction-for-cloudflare-kv.md)                 | —                  |
| 12  | [ ]       | [](./tutorials/build-a-universal-validator-with-standard-schema.md)            | —                  |
| 13  | [ ]       | [](./tutorials/create-type-safe-jwt-wrapper-classes.md)                        | —                  |
| 14  | [ ]       | [](./tutorials/create-reusable-drizzle-column-factories.md)                    | —                  |
| 15  | [ ]       | [](./tutorials/build-a-composable-heatmap-component.md)                        | —                  |
| 16  | [ ]       | [](./articles/designing-for-testability-in-serverless-functions.md)            | —                  |
| 17  | [ ]       | [](./articles/the-three-states-of-service-health.md)                           | —                  |
| 18  | [ ]       | [](./articles/error-classification-in-background-job-systems.md)               | —                  |
| 19  | [ ]       | [](./articles/the-batched-logger-pattern-for-workers.md)                       | —                  |
| 20  | [ ]       | [](./tutorials/build-a-promise-based-confirmation-dialog.md)                   | #9                 |
| 21  | [ ]       | [](./tutorials/build-an-accessible-carousel-with-keyboard-navigation.md)       | #10                |
| 22  | [ ]       | [](./articles/building-accessible-ui-with-react-aria-components.md)            | #10, #21           |
| 23  | [ ]       | [](./tutorials/use-waituntil-for-non-blocking-cache-writes.md)                 | #11                |
| 24  | [ ]       | [](./tutorials/store-authorization-codes-with-kv-ttl.md)                       | #11                |
| 25  | [ ]       | [](./tutorials/parse-multiple-input-formats-in-one-validator.md)               | #12                |
| 26  | [ ]       | [](./articles/pattern-matching-in-typescript-with-match.md)                    | #12                |
| 27  | [ ]       | [](./articles/advanced-typescript-detecting-the-any-type.md)                   | #12, #13           |
| 28  | [ ]       | [](./tutorials/implement-entity-attribute-value-pattern-with-drizzle.md)       | #14                |
| 29  | [ ]       | [](./tutorials/add-lazy-loading-for-related-data-in-drizzle.md)                | #14, #28           |
| 30  | [ ]       | [](./articles/the-service-layer-pattern-in-react-router-apps.md)               | #16                |
| 31  | [ ]       | [](./articles/building-a-monorepo-with-shared-packages.md)                     | #16                |
| 32  | [ ]       | [](./tutorials/build-a-command-palette-component.md)                           | #22                |
| 33  | [ ]       | [](./tutorials/create-a-copy-button-for-code-blocks.md)                        | #22                |
| 34  | [ ]       | [](./articles/compound-component-pattern-in-react.md)                          | #15, #22, #32      |
| 35  | [ ]       | [](./tutorials/classify-errors-for-job-retry-behavior.md)                      | #18                |
| 36  | [ ]       | [](./articles/oauth2-error-hierarchies-in-typescript.md)                       | #18                |
| 37  | [ ]       | [](./articles/two-logger-strategies-immediate-vs-batched.md)                   | #19                |
| 38  | [ ]       | [](./articles/status-codes-lie.md)                                             | #17                |
| 39  | [ ]       | [](./articles/use-case-pattern-vs-service-layer.md)                            | #16, #30           |
| 40  | [ ]       | [](./articles/class-based-models-with-drizzle-orm.md)                          | #14, #28, #29      |
| 41  | [ ]       | [](./articles/multi-entry-package-architecture.md)                             | #31                |
| 42  | [ ]       | [](./articles/the-location-class-urls-without-origins.md)                      | #12, #13, #27      |
| 43  | [ ]       | [](./tutorials/create-a-collapsible-sidebar-with-cookie-persistence.md)        | #32                |
| 44  | [ ]       | [](./tutorials/use-cloudflare-analytics-engine-for-time-series-data.md)        | #11, #23           |
| 45  | [ ]       | [](./tutorials/build-an-oauth2-oidc-provider-from-scratch.md)                  | #13, #24           |
| 46  | [ ]       | [](./tutorials/build-a-job-framework-for-cloudflare-queues.md)                 | #16, #35           |
| 47  | [ ]       | [](./tutorials/implement-retry-with-configurable-backoff.md)                   | #35, #46           |
| 48  | [ ]       | [](./tutorials/link-oauth-accounts-with-local-user-profiles.md)                | #13, #45           |
| 49  | [ ]       | [](./tutorials/implement-content-matching-rules.md)                            | #17, #38           |
| 50  | [ ]       | [](./tutorials/build-an-api-client-with-before-after-hooks.md)                 | #38                |
| 51  | [ ]       | [](./articles/multi-protocol-monitoring.md)                                    | #38                |
| 52  | [ ]       | [](./tutorials/build-a-type-safe-queue-job-system-with-zod.md)                 | #23, #35, #46      |
| 53  | [ ]       | [](./tutorials/cache-analytics-engine-queries-with-kv.md)                      | #11, #23, #44      |
| 54  | [ ]       | [](./tutorials/build-a-multi-handler-cloudflare-worker.md)                     | #23, #52           |
| 55  | [ ]       | [](./tutorials/use-cloudflare-workflows-for-long-running-tasks.md)             | #19, #46, #47      |
| 56  | [ ]       | [](./tutorials/implement-api-key-authentication-with-sha-256.md)               | #45                |
| 57  | [ ]       | [](./tutorials/build-a-type-safe-markdown-pipeline-with-markdoc.md)            | #33, #41           |
| 58  | [ ]       | [](./articles/grace-periods-designing-for-variance.md)                         | #17, #47           |
| 59  | [ ]       | [](./articles/head-vs-get-health-check-tradeoff.md)                            | #38, #49, #51      |
| 60  | [ ]       | [](./tutorials/generate-rss-feeds-in-react-router.md)                          | #57                |
| 61  | [ ]       | [](./tutorials/generate-sitemaps-in-react-router.md)                           | #60                |
| 62  | [ ]       | [](./tutorials/make-geo-located-requests-with-durable-objects.md)              | #55                |
| 63  | [ ]       | [](./articles/designing-alerts-that-dont-cause-fatigue.md)                     | #17, #58           |
| 64  | [ ]       | [](./tutorials/build-an-alert-cooldown-system.md)                              | #17, #58, #63      |
| 65  | [ ]       | [](./articles/the-dead-mans-switch-pattern.md)                                 | #17, #58           |
| 66  | [ ]       | [](./articles/why-ping-at-the-end-changes-everything.md)                       | #58, #65           |
| 67  | [ ]       | [](./articles/separating-detection-from-notification.md)                       | #17, #65           |
| 68  | [ ]       | [](./articles/recovery-notifications-are-not-optional.md)                      | #58, #63           |
| 69  | [ ]       | [](./articles/redundant-notification-channels.md)                              | #18, #46, #63, #65 |
| 70  | [ ]       | [](./articles/webhook-signing-hmac-for-notification-security.md)               | #56, #63           |
| 71  | [ ]       | [](./articles/maintenance-windows-as-a-first-class-concept.md)                 | #17, #67           |
| 72  | [ ]       | [](./articles/regional-monitoring-latency-is-not-universal.md)                 | #17, #63, #64      |
| 73  | [ ]       | [](./articles/why-dns-failures-are-hard-to-diagnose.md)                        | #62, #67           |
| 74  | [ ]       | [](./tutorials/implement-recurring-maintenance-windows.md)                     | #63, #71           |
| 75  | [ ]       | [](./articles/status-pages-transparency-as-a-feature.md)                       | #17, #68, #71      |
| 76  | [ ]       | [](./articles/recurring-maintenance-automating-operational-overhead.md)        | #63, #68, #71, #74 |
| 77  | [ ]       | [](./articles/ssl-certificates-as-a-silent-failure-mode.md)                    | #51, #63, #73      |
| 78  | [ ]       | [](./articles/dns-as-a-security-surface.md)                                    | #38, #72, #73      |

---

## Summary

| Type      | Count  |
| --------- | :----: |
| Tutorials |   45   |
| Articles  |   33   |
| **Total** | **78** |
| Published |   2    |
| Remaining |   76   |

---

## Publishing Pace

With 76 remaining posts at 1 post every 1-3 days:

- **1 per day**: ~2.5 months
- **1 every 2 days**: ~5 months
- **1 every 3 days**: ~7.5 months
