# Content Ideas from Codebase

This document contains potential articles and tutorials based on patterns and code found in this monorepo.

## TUTORIALS (How To)

### React Router / Middleware Patterns

#### ✅ How to Create a Multi-Directory Route Organization in React Router

Split routes into public, app, api, and action directories using multiple `flatRoutes()` calls with `prefix()`.

_Relevant Files_:

- `apps/uptime/app/routes.ts`
- `apps/auth/app/routes.ts`

**Overlaps with**:

- Split routes config in React Router (https://sergiodxa.com/tutorials/split-routes-config-in-react-router) - covers the same `prefix()` pattern for organizing routes

#### ✅ How to Add URL Normalization Middleware in React Router

Remove www prefix and trailing slashes for SEO-friendly URLs.

_Relevant Files_:

- `apps/blog/app/middleware/no-trailing-slash.ts`
- `apps/blog/app/middleware/no-www.ts`

#### How to Use Client Actions with Toast Notifications in React Router

Combine `clientAction` with server actions for immediate UI feedback.

_Relevant Files_:

- `apps/uptime/app/routes/actions/$team.create-monitor/route.ts`

**Overlaps with**:

- Show toast after a Remix action (https://sergiodxa.com/tutorials/show-toast-after-a-remix-action)
- Validate Form in Remix with clientAction (https://sergiodxa.com/tutorials/validate-form-in-remix-with-clientaction)

#### How to Add Rolling Cookie Sessions to React Router

Automatically extend session expiration on every request.

_Relevant Files_:

- `apps/blog/app/middleware/rolling-cookie.ts`

**Overlaps with**:

- Add rolling sessions to Remix (https://sergiodxa.com/tutorials/add-rolling-sessions-to-remix)

#### ✅ How to Access Request Context Anywhere with AsyncLocalStorage

Create global getters for request/context without prop drilling.

_Relevant Files_:

- `apps/blog/app/middleware/context-storage.ts`

### Cloudflare Workers

#### ✅ How to Build a Multi-Handler Cloudflare Worker

Handle HTTP, cron schedules, and queue messages in a single Worker.

_Relevant Files_:

- `apps/uptime/app/entry.worker.ts`

#### ✅ How to Use Cloudflare Workflows for Long-Running Tasks

Build durable, retryable multi-step operations with Workflows.

_Relevant Files_:

- `apps/uptime/app/workflows/ping.ts`

#### ✅ How to Make Geo-Located Requests with Durable Objects

Use location hints to perform HTTP requests from specific regions.

_Relevant Files_:

- `apps/uptime/app/do/geo-fetch.ts`

#### ✅ How to Build a Type-Safe Queue Job System with Zod

Use discriminated unions for type-safe queue message handling.

_Relevant Files_:

- `apps/uptime/app/entry.worker.ts`

#### ✅ How to Use Cloudflare Analytics Engine for Time-Series Data

Write and query time-series data with SQL.

_Relevant Files_:

- `apps/uptime/app/services/analytics.server.ts`

#### ✅ How to Cache Analytics Engine Queries with KV

Reduce costs by caching expensive SQL queries.

_Relevant Files_:

- `apps/uptime/app/services/analytics.server.ts`

### Authentication

#### ✅ How to Build an OAuth2/OIDC Provider from Scratch

Create your own authentication server with authorization code flow.

_Relevant Files_:

- `apps/auth/app/modules/oauth2.ts`

#### ✅ How to Create Type-Safe JWT Wrapper Classes

Encapsulate JWT structure with typed property accessors.

_Relevant Files_:

- `apps/auth/app/entities/access-token.ts`
- `apps/auth/app/entities/id-token.ts`

#### ✅ How to Implement API Key Authentication with SHA-256

Generate, hash, and verify API keys securely.

_Relevant Files_:

- `apps/uptime/app/middleware/api-auth.ts`

#### ✅ How to Store Authorization Codes with KV TTL

Use KV expiration for automatic code cleanup.

_Relevant Files_:

- `apps/auth/app/entities/authz-code.ts`

#### ✅ How to Link OAuth Accounts with Local User Profiles

Handle new vs existing users in OAuth callback.

_Relevant Files_:

- `apps/blog/app/routes/_.auth_.callback/route.tsx`

### Database (D1/Drizzle)

#### ✅ How to Implement Entity-Attribute-Value Pattern with Drizzle

Store dynamic attributes in a flexible schema.

_Relevant Files_:

- `apps/blog/app/db/schema.ts`
- `apps/blog/app/models/post.server.ts`

#### ✅ How to Create Reusable Drizzle Column Factories

DRY column definitions with `pk()`, `fk()`, and `timestamps()`.

_Relevant Files_:

- `packages/db-helpers/src/pk.ts`
- `packages/db-helpers/src/fk.ts`
- `packages/db-helpers/src/timestamps.ts`

#### ✅ How to Add Lazy Loading for Related Data in Drizzle

Load relationships on-demand with caching.

_Relevant Files_:

- `apps/blog/app/models/post.server.ts`

#### ✅ How to Create a Per-Request Database Instance with Middleware

Lazy database initialization pattern.

_Relevant Files_:

- `apps/blog/app/middleware/drizzle.ts`

**Overlaps with**:

- Create a Per-Request Singleton with React Router Middleware (https://sergiodxa.com/tutorials/create-a-per-request-singleton-with-react-router-middleware)

### Background Jobs

#### ✅ How to Build a Job Framework for Cloudflare Queues

Abstract Job class with error classification and retry control.

_Relevant Files_:

- `packages/jobs/src/index.ts`

#### ✅ How to Classify Errors for Job Retry Behavior

Use `RetryError` vs `NonRetriableError` for explicit control.

_Relevant Files_:

- `packages/jobs/src/index.ts`

### Validation

#### ✅ How to Build a Universal Validator with Standard Schema

Schema-agnostic validation for Zod, Valibot, or any compliant library.

_Relevant Files_:

- `packages/validate/src/index.ts`

#### ✅ How to Parse Multiple Input Formats in One Validator

Handle Request, FormData, URLSearchParams, and JSON.

_Relevant Files_:

- `packages/validate/src/index.ts`

### Caching

#### ✅ How to Build a Cache Abstraction for Cloudflare KV

Create a `fetch()` method for cache-aside pattern.

_Relevant Files_:

- `packages/cache/src/index.ts`

#### ✅ How to Use waitUntil for Non-Blocking Cache Writes

Background writes that don't block responses.

_Relevant Files_:

- `packages/cache/src/index.ts`

### UI Components

#### ✅ How to Build a Promise-Based Confirmation Dialog

Create a `confirm()` function that returns `Promise<boolean>`.

_Relevant Files_:

- `packages/ui/src/components/confirm.tsx`

#### ✅ How to Build an Accessible Carousel with Keyboard Navigation

Arrow keys, Home, End support with ResizeObserver.

_Relevant Files_:

- `packages/ui/src/components/carousel.tsx`

#### ✅ How to Create Animated Tab Indicators with CSS Variables

Use ResizeObserver and MutationObserver for smooth animations.

_Relevant Files_:

- `packages/ui/src/components/tabs.tsx`

#### ✅ How to Build a Command Palette Component

Custom filtering with recursive React Children traversal.

_Relevant Files_:

- `packages/ui/src/components/command.tsx`

#### ✅ How to Create a Collapsible Sidebar with Cookie Persistence

Mobile sheet fallback with keyboard shortcut.

_Relevant Files_:

- `packages/ui/src/components/sidebar.tsx`

#### ✅ How to Create a Color System with React Context

Build a `ColorProvider` for semantic color inheritance (primary, danger, success, etc.).

_Relevant Files_:

- `packages/ui/src/components/color-context.tsx`

#### ✅ How to Build a Composable Heatmap Component

Compound component pattern for data visualization.

_Relevant Files_:

- `apps/uptime/app/components/heatmap.tsx`

### Markdown

#### ✅ How to Build a Type-Safe Markdown Pipeline with Markdoc

Server/client split architecture with frontmatter validation using Standard Schema.

_Relevant Files_:

- `packages/markdown/src/server/index.ts`
- `packages/markdown/src/client/index.tsx`

**Overlaps with**:

- Parse Markdown with Markdoc in Remix (https://sergiodxa.com/tutorials/parse-markdown-with-markdoc-in-remix) - covers basic parsing, but not server/client split or frontmatter validation

#### ✅ How to Create a Copy Button for Code Blocks

Clipboard API with auto-reset status.

_Relevant Files_:

- `packages/markdown/src/client/copy-button.tsx`

### Utilities

#### ✅ How to Implement Retry with Configurable Backoff

Constant, linear, and exponential backoff strategies.

_Relevant Files_:

- `packages/result/src/retry.ts`

#### How to Convert Throwing Functions to Result Types

The `wrap()` function for error handling.

_Relevant Files_:

- `packages/result/src/wrap.ts`

**Overlaps with**:

- Result Objects in TS (https://sergiodxa.com/articles/result-objects-in-ts)

#### ✅ How to Build Type-Safe Response Helpers for React Router

Add `ok: true/false` property for easy status checking.

_Relevant Files_:

- `packages/response/src/index.ts`

#### ✅ How to Use Client Hints for Server-Side Timezone Rendering

Know user's timezone before sending HTML.

_Relevant Files_:

- `apps/uptime/app/utils/client-hints.tsx`

#### ✅ How to Generate RSS Feeds in React Router

Simple API for valid RSS output.

_Relevant Files_:

- `packages/rss/src/index.ts`

#### ✅ How to Generate Sitemaps in React Router

Builder pattern for XML sitemap creation.

_Relevant Files_:

- `packages/sitemap/src/index.ts`

#### ✅ How to Build an API Client with Before/After Hooks

Base class abstraction for HTTP integrations.

_Relevant Files_:

- `apps/books/app/services/buttondown.ts`

### Business Logic

#### ✅ How to Implement Recurring Maintenance Windows

Parse and match daily/weekly/monthly patterns.

_Relevant Files_:

- `apps/uptime/app/services/check-maintenance.ts`

#### ✅ How to Build an Alert Cooldown System

Prevent notification fatigue with deduplication.

_Relevant Files_:

- `apps/uptime/app/services/alert-cooldown.ts`

#### ✅ How to Implement Content Matching Rules

Contains, regex, JSON path checking for uptime monitors.

_Relevant Files_:

- `apps/uptime/app/services/check-content.ts`

## ARTICLES (Explanations/Opinions)

#### ✅ The Service Layer Pattern in React Router Apps

Why extracting business logic into services improves testability.

_Relevant Files_:

- `apps/uptime/app/services/`
- `apps/auth/app/services/`

#### ✅ Use Case Pattern vs Service Layer

When to use dedicated "use case" files vs general services.

_Relevant Files_:

- `apps/books/app/use-case/subscribe.ts`

#### ✅ Class-Based Models with Drizzle ORM

Using inheritance for content types with shared behavior.

_Relevant Files_:

- `apps/blog/app/models/post.server.ts`
- `apps/blog/app/models/article.server.ts`

#### ✅ Building a Monorepo with Shared Packages

Architecture decisions for `@pkg/*` namespaced packages.

_Relevant Files_:

- All `packages/`

#### ✅ Multi-Entry Package Architecture

When to split server/client exports in npm packages.

_Relevant Files_:

- `packages/markdown/`
- `packages/ui/`

#### ✅ The BatchedLogger Pattern for Workers

Reducing log noise in serverless environments.

_Relevant Files_:

- `packages/logger/src/batched-logger.ts`

#### ✅ Error Classification in Background Job Systems

Why you need more than just "retry" or "fail".

_Relevant Files_:

- `packages/jobs/src/index.ts`

#### ✅ Two Logger Strategies: Immediate vs Batched

When to use each approach in Cloudflare Workers.

_Relevant Files_:

- `packages/logger/src/logger.ts`
- `packages/logger/src/batched-logger.ts`

#### ✅ Designing for Testability in Serverless Functions

Pure functions and dependency injection patterns.

_Relevant Files_:

- `apps/uptime/app/services/check-content.test.ts`

#### ✅ OAuth2 Error Hierarchies in TypeScript

Creating error classes that map to protocol requirements.

_Relevant Files_:

- `apps/auth/app/errors/`

#### ✅ Pattern Matching in TypeScript with match()

Functional alternative to if/else chains.

_Relevant Files_:

- `packages/result/src/match.ts`

#### ✅ The Location Class: URLs Without Origins

When and why you need URL manipulation without protocol/host.

_Relevant Files_:

- `packages/location/src/index.ts`

#### TypeScript Assertion Functions for Result Types

Using `asserts` keyword for cleaner code.

_Relevant Files_:

- `packages/result/src/succeeded.ts`
- `packages/result/src/failed.ts`

**Overlaps with**:

- Result Objects in TS (https://sergiodxa.com/articles/result-objects-in-ts)

#### ✅ Advanced TypeScript: Detecting the `any` Type

The `0 extends 1 & T` trick explained.

_Relevant Files_:

- `packages/types/src/index.ts`

#### ✅ Building Accessible UI with React Aria Components

Why starting with accessibility-first primitives matters.

_Relevant Files_:

- `packages/ui/src/`

#### ✅ Compound Component Pattern in React

Organizing related components with namespaces.

_Relevant Files_:

- `packages/ui/src/components/dialog.tsx`

---

## ARTICLES: Lessons from Building Uptime Monitoring

These article ideas extract patterns, tradeoffs, and insights from building the Uptime monitoring system. They're applicable beyond uptime monitoring and reflect real architectural decisions.

### Monitoring Patterns

#### ✅ The Dead Man's Switch Pattern

Active polling vs passive heartbeats: two fundamentally different approaches to monitoring. Why cron job monitoring inverts the typical "check if it's running" model, and when this pattern applies beyond scheduled tasks (IoT devices, edge workers, distributed systems). The subtle difference between "late" and "missed" states and why that distinction matters.

_Inspired by_: `apps/uptime/docs/concepts/cron-jobs.md`

#### ✅ Why "Ping at the End" Changes Everything

The difference between knowing a job started vs knowing it succeeded. Why most cron monitoring guides get this wrong, and how the position of your health check ping fundamentally changes what you're measuring. Applies to any "completion confirmation" pattern.

_Inspired by_: `apps/uptime/docs/concepts/cron-jobs.md`

#### ✅ Grace Periods: Designing for Variance

Your job takes 5 minutes on average but 20 minutes under load. How do you set a timeout? The concept of grace periods as a design pattern for systems with variable execution times. Why hardcoded timeouts fail and how to account for real-world variance without constant false alarms.

_Inspired by_: `apps/uptime/docs/concepts/cron-jobs.md`

#### ✅ The Three States of Service Health

Why "up or down" is insufficient. The case for a "degraded" state and how it changes incident response. When slow is worse than down, and how response time thresholds create early warning systems before outages happen.

_Inspired by_: `apps/uptime/docs/concepts/monitors.md`, `apps/uptime/docs/concepts/http-monitors.md`

#### ✅ Status Codes Lie: Content Validation in Health Checks

A 200 response doesn't mean your service is healthy. Real examples: error pages that return 200, cached stale content, blank pages from failed renders, and CDN fallbacks serving wrong content. How content validation catches failures that status codes miss.

_Inspired by_: `apps/uptime/docs/concepts/http-monitors.md`

#### ✅ Multi-Protocol Monitoring: Why One Check Isn't Enough

The case for monitoring at multiple layers: TCP confirms the process is running, HTTP confirms the application responds, content checks confirm the response is correct. How combining monitors creates a complete picture and helps pinpoint root causes faster.

_Inspired by_: `apps/uptime/docs/concepts/monitors.md`, `apps/uptime/docs/concepts/tcp-monitors.md`

#### ✅ HEAD vs GET: The Health Check Tradeoff

When checking if a service is alive, do you need the response body? The HEAD method is faster and cheaper, but you can't validate content. How to choose between speed and thoroughness, and why the answer depends on what failure mode you're trying to catch.

_Inspired by_: `apps/uptime/docs/concepts/http-monitors.md`

### Alerting & Notification Design

#### ✅ Designing Alerts That Don't Cause Fatigue

Alert fatigue is a design failure, not a configuration problem. The case for cooldown periods, recovery notifications, and why "flapping" services reveal gaps in your system design. Includes the tradeoff between immediate notification and noise reduction, and why limiting alert count (10 max) forces better architecture.

_Inspired by_: `apps/uptime/docs/concepts/alerts.md`

#### ✅ Separating Detection from Notification

Why monitors and alerts should be decoupled systems. One monitor, many alerts. One alert, many monitors. How this separation enables different notification strategies for different audiences (engineering vs support vs executives) without duplicating monitoring logic.

_Inspired by_: `apps/uptime/docs/concepts/alerts.md`, `apps/uptime/docs/concepts/monitors.md`

#### ✅ Recovery Notifications Are Not Optional

Why knowing when something comes back up is as important as knowing when it goes down. The psychological cost of manually checking if issues resolved, and how recovery notifications enable confident incident closure and accurate post-mortems.

_Inspired by_: `apps/uptime/docs/concepts/alerts.md`

#### ✅ Redundant Notification Channels: What Happens When Slack Is Down?

If your alerting system depends on a single channel, you have a single point of failure. The case for email as a backup, webhooks for fan-out, and why your monitoring system needs monitoring.

_Inspired by_: `apps/uptime/docs/concepts/alerts.md`

#### ✅ Webhook Signing: HMAC for Notification Security

When you expose a webhook endpoint, how do you know the request came from a trusted source? Why shared secrets and HMAC signatures prevent alert spoofing, and the exact implementation pattern for verifying webhook authenticity.

_Inspired by_: `apps/uptime/docs/concepts/alerts.md`

### Operational Patterns

#### ✅ Maintenance Windows as a First-Class Concept

Why "just disable the alert" isn't good enough. How maintenance windows affect uptime calculations, status page accuracy, and alert history. The "end early" feature and why maintenance duration should be a data point, not just a suppression mechanism.

_Inspired by_: `apps/uptime/docs/concepts/maintenance.md`

#### ✅ Recurring Maintenance: Automating Operational Overhead

Weekly deployments, nightly backups, monthly patching: maintenance that happens on a schedule shouldn't require manual setup each time. How recurring maintenance windows reduce operational burden and prevent "forgot to set up maintenance" incidents.

_Inspired by_: `apps/uptime/docs/concepts/maintenance.md`

#### ✅ Status Pages: Transparency as a Feature

Why publishing your failures builds more trust than hiding them. The support ticket reduction from self-service status checks, and why most companies should make their status pages public. Includes the case for multiple status pages for different audiences.

_Inspired by_: `apps/uptime/docs/concepts/status-pages.md`

### Security & Edge Cases

#### ✅ SSL Certificates as a Silent Failure Mode

Certificate expiry causes immediate, complete outages with no graceful degradation. Why SSL monitoring deserves special attention, how to set expiry thresholds based on your renewal process, and the case for automated certificate renewal plus monitoring as defense in depth.

_Inspired by_: `apps/uptime/docs/concepts/http-monitors.md`

#### ✅ DNS as a Security Surface

Your NS records control who can modify your DNS. If they change unexpectedly, you may be under attack. Why DNS monitoring is a security measure, not just an availability check, and which record types deserve monitoring for different threat models.

_Inspired by_: `apps/uptime/docs/concepts/dns-monitors.md`

#### ✅ Why DNS Failures Are Hard to Diagnose

DNS issues are invisible: the failure happens before your application code runs. Why DNS problems masquerade as "can't connect" errors, the challenge of TTL caching, and how proactive DNS monitoring catches issues that reactive debugging misses.

_Inspired by_: `apps/uptime/docs/concepts/dns-monitors.md`

#### ✅ Regional Monitoring: Latency Is Not Universal

Your service might be fast in Virginia and slow in Sydney. Why single-region monitoring gives false confidence, how to choose regions based on user distribution, and what regional discrepancies reveal about your infrastructure.

_Inspired by_: `apps/uptime/docs/concepts/http-monitors.md`

---

## Summary

| Category                       | Total  | Written | Remaining |
| ------------------------------ | ------ | ------- | --------- |
| Tutorials (from codebase)      | 45     | 42      | 3         |
| Articles (from codebase)       | 16     | 14      | 2         |
| Articles (monitoring insights) | 18     | 18      | 0         |
| **Total**                      | **79** | **74**  | **5**     |

### Remaining to Write

**Tutorials:**

1. How to Use Client Actions with Toast Notifications in React Router (overlaps with existing)
2. How to Add Rolling Cookie Sessions to React Router (overlaps with existing)
3. How to Convert Throwing Functions to Result Types (overlaps with existing)

**Articles (from codebase):**

1. TypeScript Assertion Functions for Result Types (overlaps with existing)
