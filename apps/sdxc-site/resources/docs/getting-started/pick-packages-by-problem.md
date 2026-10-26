---
title: Pick packages by problem
description: A map from the task in front of you to the packages that solve it and the guide that puts them to work, grouped by the kind of work rather than by package.
section:
    title: Packages à la carte
    order: 1.5
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "What package solves the task in front of you"
    - "Where the guide that composes those packages is"
    - "What else a package usually arrives with, so you install them together"
---

You know the problem and want the package. Each table below starts from a task, names the
packages that solve it, and links the guide that puts them to work. The packages in one row are
installed together, at one release, as [Install and pin](/docs/getting-started/install-and-pin)
describes, and every package missing here is listed on the [API reference](/api).

## Handle failures and validate input

| I need to…                                          | Packages                          | Guide                                                                         |
| --------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| return failures as values instead of throwing       | [`@sdxc/result`](/api/result)     | [`Result` everywhere](/docs/conventions/result-everywhere)                    |
| validate form posts, query strings and route params | [`@sdxc/validate`](/api/validate) | [Validate forms and route params](/docs/building-remix-apps/forms-and-params) |
| answer a failure as an RFC 9457 problem document    | [`@sdxc/problem`](/api/problem)   | [Errors as responses](/docs/conventions/errors-as-responses)                  |

## Answer HTTP requests

| I need to…                                             | Packages                                                                                                                 | Guide                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| answer JSON with a named status, outside any framework | [`@sdxc/response`](/api/response)                                                                                        | [Use the packages outside Remix](/docs/getting-started/outside-remix)                       |
| set cache headers on a response in a Remix app         | [`@sdxc/http`](/api/http)                                                                                                | [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers)              |
| redirect to one canonical host and path                | [`@sdxc/no-www-middleware`](/api/no-www-middleware), [`@sdxc/trailing-slash-middleware`](/api/trailing-slash-middleware) | [Canonical URLs, lazy routes and header fields](/docs/building-remix-apps/router-utilities) |
| read the caller's IP address and classify it           | [`@sdxc/get-client-ip`](/api/get-client-ip), [`@sdxc/ip`](/api/ip)                                                       | [Client addresses and networks](/docs/identity-and-security/client-addresses)               |
| fetch a URL someone else chose, within bounds          | [`@sdxc/outbound`](/api/outbound)                                                                                        | [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls)             |

## Build an API

| I need to…                                          | Packages                                                                         | Guide                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| build a JSON API that answers failures as problems  | [`@sdxc/problem`](/api/problem), [`@sdxc/http`](/api/http)                       | [Build a JSON API with problem details](/docs/http-apis/json-apis)            |
| page a list by offset or keyset                     | [`@sdxc/pagination`](/api/pagination), [`@sdxc/link-header`](/api/link-header)   | [Paginate lists](/docs/http-apis/paginate-lists)                              |
| limit how often a caller may ask                    | [`@sdxc/rate-limit`](/api/rate-limit)                                            | [Client addresses and networks](/docs/identity-and-security/client-addresses) |
| describe the API as an OpenAPI 3.1 document         | [`@sdxc/openapi`](/api/openapi), [`@sdxc/json-schema`](/api/json-schema)         | [Describe your API with OpenAPI](/docs/http-apis/openapi)                     |
| make a create safe to retry, accept partial updates | [`@sdxc/idempotency`](/api/idempotency), [`@sdxc/merge-patch`](/api/merge-patch) | [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes)         |
| write a typed client for someone else's API         | [`@sdxc/api-client`](/api/api-client)                                            | [Write a typed API client](/docs/http-apis/api-clients)                       |
| expose the app to AI agents over MCP                | [`@sdxc/mcp`](/api/mcp)                                                          | [Expose your app over MCP](/docs/operations-and-testing/mcp-server)           |

## Sign people in and decide what they may do

| I need to…                                      | Packages                                                                                | Guide                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| sign people in with an OpenID Connect provider  | [`@sdxc/auth`](/api/auth), [`@sdxc/session-storage-kv`](/api/session-storage-kv)        | [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) |
| issue and verify JWTs and publish a JWKS        | [`@sdxc/jwt`](/api/jwt)                                                                 | [Issue and verify JWTs](/docs/identity-and-security/json-web-tokens)         |
| add passkeys                                    | [`@sdxc/passkey`](/api/passkey)                                                         | [Add passkeys](/docs/identity-and-security/passkeys)                         |
| add TOTP two-factor sign-in                     | [`@sdxc/crypto`](/api/crypto), [`@sdxc/qr`](/api/qr)                                    | [Add two-factor sign-in with TOTP](/docs/identity-and-security/two-factor)   |
| decide who can do what                          | [`@sdxc/authz`](/api/authz)                                                             | [Decide who can do what](/docs/identity-and-security/authorization)          |
| mint record ids, random identifiers and secrets | [`@sdxc/uuid`](/api/uuid), [`@sdxc/typeid`](/api/typeid), [`@sdxc/crypto`](/api/crypto) | [Identifiers and secrets](/docs/conventions/identifiers-and-secrets)         |

## Secure the app

| I need to…                                    | Packages                                                           | Guide                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| hash, sign and encrypt with Web Crypto        | [`@sdxc/crypto`](/api/crypto)                                      | [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) |
| send CSP, HSTS and Permissions-Policy headers | [`@sdxc/security-headers`](/api/security-headers)                  | [Security headers and CSP](/docs/identity-and-security/security-headers)         |
| receive and send signed webhooks              | [`@sdxc/webhooks`](/api/webhooks)                                  | [Receive and send webhooks](/docs/identity-and-security/webhooks)                |
| stop bots on a public form                    | [`@sdxc/honeypot`](/api/honeypot), [`@sdxc/captcha`](/api/captcha) | [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms)   |
| score submitted content for spam              | [`@sdxc/spam`](/api/spam)                                          | [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms)   |

## Publish content

| I need to…                                          | Packages                                                                                                           | Guide                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| parse markdown with typed frontmatter and render it | [`@sdxc/markdown`](/api/markdown)                                                                                  | [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline)          |
| highlight code blocks                               | [`@sdxc/highlight`](/api/highlight)                                                                                | [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline)          |
| publish RSS, Atom and JSON feeds                    | [`@sdxc/feed`](/api/feed), [`@sdxc/rss`](/api/rss), [`@sdxc/atom`](/api/atom), [`@sdxc/json-feed`](/api/json-feed) | [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds)         |
| serve a sitemap, `robots.txt` and structured data   | [`@sdxc/sitemap`](/api/sitemap), [`@sdxc/robots`](/api/robots), [`@sdxc/seo`](/api/seo)                            | [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) |

## Read and write file formats

| I need to…                                     | Packages                            | Guide                                                                         |
| ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| import and export CSV                          | [`@sdxc/csv`](/api/csv)             | [Import and export CSV](/docs/data-and-background-work/csv)                   |
| stream JSON Lines                              | [`@sdxc/jsonl`](/api/jsonl)         | [Stream JSON Lines](/docs/data-and-background-work/json-lines)                |
| bundle several files into one ZIP download     | [`@sdxc/zip`](/api/zip)             | [Stream several files as a ZIP](/docs/data-and-background-work/zip-downloads) |
| publish calendar feeds and read `.ics` uploads | [`@sdxc/icalendar`](/api/icalendar) | [Publish calendar feeds](/docs/content-and-feeds/calendar-feeds)              |
| write invoices and reports as PDF              | [`@sdxc/pdf`](/api/pdf)             | [Generate PDF documents](/docs/content-and-feeds/pdf-documents)               |

## Build the interface

| I need to…                                  | Packages                                                                                    | Guide                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| compose pages from styled components        | [`@sdxc/ui`](/api/ui), [`@sdxc/u`](/api/u), [`@sdxc/icons`](/api/icons)                     | [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) |
| translate the app                           | [`@sdxc/i18n`](/api/i18n), [`@sdxc/messageformat`](/api/messageformat)                      | [Translate your app](/docs/building-remix-apps/translate-your-app)                            |
| slug titles, format dates, compare versions | [`@sdxc/strings`](/api/strings), [`@sdxc/dates`](/api/dates), [`@sdxc/semver`](/api/semver) | [Dates, text and identifiers](/docs/building-remix-apps/values)                               |
| draw social card images in a Worker         | [`@sdxc/png`](/api/png), [`@sdxc/font`](/api/font), [`@sdxc/raster`](/api/raster)           | [Draw social card images](/docs/building-remix-apps/social-card-images)                       |
| draw QR codes                               | [`@sdxc/qr`](/api/qr)                                                                       | [Draw QR codes](/docs/building-remix-apps/qr-codes)                                           |

## Store data

| I need to…                                   | Packages                                                                                                                                                          | Guide                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| query D1 or a Durable Object's SQLite        | [`@sdxc/data-table-d1`](/api/data-table-d1), [`@sdxc/data-table-sqlstorage`](/api/data-table-sqlstorage), [`@sdxc/database-middleware`](/api/database-middleware) | [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases)       |
| model tables with scopes and callbacks       | [`@sdxc/data-model`](/api/data-model)                                                                                                                             | [Model your tables](/docs/data-and-background-work/data-models)                   |
| cache values in KV and responses at the edge | [`@sdxc/cache`](/api/cache), [`@sdxc/workers-cache`](/api/workers-cache)                                                                                          | [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers)    |
| store uploads in R2                          | [`@sdxc/file-storage-r2`](/api/file-storage-r2)                                                                                                                   | [Accept PNG avatars and draw placeholders](/docs/building-remix-apps/png-avatars) |
| search text over SQLite                      | [`@sdxc/search`](/api/search)                                                                                                                                     | [Full-text search over SQLite](/docs/data-and-background-work/full-text-search)   |
| roll out features behind flags               | [`@sdxc/flags`](/api/flags), [`@sdxc/flags-engine`](/api/flags-engine)                                                                                            | [Feature flags](/docs/data-and-background-work/feature-flags)                     |
| charge for the app                           | [`@sdxc/billing`](/api/billing)                                                                                                                                   | [Charge for your app](/docs/data-and-background-work/billing)                     |

## Run work in the background and reach people

| I need to…                              | Packages                                             | Guide                                                                               |
| --------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| run background jobs and cron schedules  | [`@sdxc/jobs`](/api/jobs), [`@sdxc/cron`](/api/cron) | [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)            |
| retry on a growing delay                | [`@sdxc/backoff`](/api/backoff)                      | [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff)       |
| send email                              | [`@sdxc/mail`](/api/mail)                            | [Send email](/docs/data-and-background-work/send-email)                             |
| send alerts to chat and paging services | [`@sdxc/messaging`](/api/messaging)                  | [Send alerts to chat and paging services](/docs/data-and-background-work/messaging) |

## Operate and test

| I need to…                                         | Packages                                                                                                                | Guide                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| log one wide event per request and trace into jobs | [`@sdxc/logger`](/api/logger), [`@sdxc/trace-context`](/api/trace-context), [`@sdxc/server-timing`](/api/server-timing) | [Logs, traces and timings](/docs/operations-and-testing/observability)    |
| answer `GET /health` for monitors                  | [`@sdxc/health`](/api/health)                                                                                           | [Dependency health checks](/docs/operations-and-testing/health-checks)    |
| build a command line                               | [`@sdxc/cli`](/api/cli)                                                                                                 | [Build a command line](/docs/operations-and-testing/build-a-command-line) |
| test against Cloudflare bindings in memory         | [`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks)                                                                       | [Test Workers apps](/docs/operations-and-testing/testing)                 |
| generate believable, repeatable test data          | [`@sdxc/sample`](/api/sample), [`@sdxc/random`](/api/random)                                                            | [Generate believable test data](/docs/operations-and-testing/test-data)   |
| start, generate and upgrade a whole app            | [`@sdxc/kit`](/api/kit)                                                                                                 | [The sdxc command](/docs/getting-started/the-sdxc-command)                |

## Where to go next

- [Use the packages outside Remix](/docs/getting-started/outside-remix) — which of these run with
  no framework, and how to tell from a package's page.
- [Add packages to an existing app](/docs/getting-started/add-to-an-existing-app) — install the
  packages you picked into the project you have, pinned at one release.
- [`@sdxc` API reference](/api) — every package, grouped, with its install line.
