# ADR-001: Analytics Engine Migration for Monitor Results

## Status

**Proposed** - 2026-02-15

## Background

This work originated from investigating dashboard performance issues. The original problem was:

1. **Refresh button didn't show loading state** - Fixed by passing `isPending` to React Aria's Button component
2. **Suspense error recovery** - When `<Await>` caught an error, revalidation didn't clear it. We added a `nonce` to force Suspense remount on revalidation.
3. **Skeleton flashing on every revalidation** - The `nonce` approach caused skeletons to show on every refresh

Rather than optimizing the Suspense/nonce approach, we decided to **make the loader resolve faster** so deferred promises resolve quickly and users see real data instead of skeletons. This led to investigating Analytics Engine as a faster alternative to D1 for time-series aggregations.

## Context

The Uptime application currently stores all HTTP monitor ping results in a D1 SQLite table (`monitor_results`). The dashboard queries this table to calculate uptime percentages, average response times, and display latency sparklines. This approach has performance issues:

1. **Slow dashboard loads** - Fetching results from the last 24 hours for all monitors and aggregating in JavaScript is slow
2. **D1 not optimized for time-series** - SQLite isn't designed for high-volume time-series aggregations
3. **Scaling concerns** - As monitors and results grow, query performance degrades

Additionally, the current schema has several design issues:

1. **SSL monitoring embedded in HTTP monitors** - The `monitors` table has 6 SSL-related columns that conceptually should be separate
2. **Alert events lack context** - The `alert_events` table stores `monitorId` but doesn't indicate monitor type or capture snapshot data
3. **No long-term aggregated data** - We promise 365-day data retention but storing individual pings for a year is expensive

## Decision

### 1. Migrate HTTP and TCP results to Analytics Engine

Write ping results to Cloudflare Analytics Engine for real-time aggregation queries. Analytics Engine is optimized for:

- Time-series data with automatic timestamp indexing
- Server-side aggregations (SUM, AVG, COUNT, percentiles)
- High-cardinality filtering via indexes

**Important limitation:** The Analytics Engine binding (`env.PING_RESULTS`) only supports `writeDataPoint()`. Querying requires the external HTTP API with authentication. This is documented in `.agents/skills/cloudflare/references/analytics-engine/gotchas.md`.

**Data flow:**

```
Ping Workflow ──► Analytics Engine (real-time, 90 days)
                         │
                         ▼ (daily cron at 1 AM UTC)
                  D1 Daily Stats (aggregated, 365 days)
```

### 2. Keep DNS and Cron results in D1

- **DNS**: Hourly checks, low volume, needs `resolvedValue` string storage
- **Cron**: Pings are audit trail events, need `sourceIp`/`userAgent` forensics

### 3. Create daily aggregation table

New `monitor_daily_stats` table stores one row per monitor per day for 365-day retention.

### 4. Separate SSL monitoring

Create standalone `sslMonitors` table, removing SSL columns from HTTP monitors.

### 5. Enhance alert events

Add `monitorType`, `monitorName`, and JSON `snapshot` column to capture full context at alert time.

### 6. Add status page support for all monitor types

Create `statusPageDnsMonitors`, `statusPageTcpMonitors`, `statusPageSslMonitors` tables.

## Analytics Engine Schema

```typescript
/**
 * Dataset: uptime_monitor_results
 *
 * Blobs (dimensions for GROUP BY):
 *   blob1: monitorId
 *   blob2: monitorType ("http" | "tcp")
 *   blob3: status ("up" | "down" | "degraded" | "timeout")
 *
 * Doubles (metrics):
 *   double1: responseTimeMs
 *   double2: count (always 1, for sampling-safe aggregations)
 *   double3: responseStatus (HTTP status code, 0 for TCP)
 *   double4: expectedStatus (HTTP expected status, 0 for TCP)
 *
 * Indexes (high-cardinality filter):
 *   index1: teamId
 */
```

**Write example (HTTP):**

```typescript
env.PING_RESULTS.writeDataPoint({
	blobs: [monitorId, "http", status],
	doubles: [responseTimeMs, 1, responseStatus, expectedStatus],
	indexes: [teamId],
});
```

**Write example (TCP):**

```typescript
env.PING_RESULTS.writeDataPoint({
	blobs: [monitorId, "tcp", status],
	doubles: [responseTimeMs ?? 0, 1, 0, 0],
	indexes: [teamId],
});
```

**Query example (uptime):**

```sql
SELECT
  blob1 AS monitorId,
  COUNT(*) AS totalChecks,
  SUM(CASE WHEN blob3 = 'up' THEN 1 ELSE 0 END) AS successfulChecks
FROM uptime_monitor_results
WHERE index1 = :teamId
  AND timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY blob1
```

## Analytics Engine Query Service

Since the binding only supports writes, queries must go through the HTTP API:

```typescript
// apps/uptime/app/services/analytics.server.ts
import { env } from "cloudflare:workers";

interface AnalyticsQueryResult<T> {
	data: T[];
	meta: { rows: number };
}

export async function queryAnalytics<T>(sql: string): Promise<T[]> {
	let response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_API_TOKEN}`,
				"Content-Type": "text/plain",
			},
			body: sql,
		},
	);

	if (!response.ok) {
		throw new Error(`Analytics query failed: ${response.statusText}`);
	}

	let result = (await response.json()) as AnalyticsQueryResult<T>;
	return result.data;
}

// With KV caching
export async function queryAnalyticsCached<T>(
	cacheKey: string,
	ttlSeconds: number,
	sql: string,
): Promise<T[]> {
	let cached = await env.KV.get<T[]>(cacheKey, "json");
	if (cached) return cached;

	let data = await queryAnalytics<T>(sql);
	await env.KV.put(cacheKey, JSON.stringify(data), {
		expirationTtl: ttlSeconds,
	});

	return data;
}
```

## Database Schema Changes

### New Tables

#### `ssl_monitors`

```typescript
export const sslMonitors = sqliteTable(
	"ssl_monitors",
	{
		id: pk("id"),
		createdAt,
		updatedAt,
		enabledAt: timestamp("enabled_at"), // null = disabled
		// Relations
		teamId: uuid("team_id").notNull(),
		httpMonitorId: uuid("http_monitor_id"), // Optional link to HTTP monitor
		// Attributes
		name: text("name").notNull(),
		hostname: text("hostname").notNull(),
		port: integer("port").default(443).notNull(),
		expiryWarningDays: integer("expiry_warning_days").default(30).notNull(),
		// Status (manually entered - Workers can't read TLS certs from fetch)
		expiresAt: timestamp("expires_at"),
		issuer: text("issuer"),
		lastCheckedAt: timestamp("last_checked_at"),
		status: text("status", {
			enum: ["unknown", "valid", "expiring", "expired", "error"],
		}).default("unknown"),
	},
	(table) => [
		index("ssl_monitors_team_idx").on(table.teamId),
		index("ssl_monitors_enabled_idx").on(table.enabledAt),
	],
);
```

#### `monitor_daily_stats`

```typescript
export const monitorDailyStats = sqliteTable(
	"monitor_daily_stats",
	{
		id: pk("id"),
		createdAt,
		// Identity
		monitorId: uuid("monitor_id").notNull(),
		monitorType: text("monitor_type", {
			enum: ["http", "dns", "tcp", "cron"],
		}).notNull(),
		date: text("date").notNull(), // "2026-02-14" format
		// Stats
		totalChecks: integer("total_checks").notNull(),
		successfulChecks: integer("successful_checks").notNull(),
		failedChecks: integer("failed_checks").notNull(),
		// Response time (null for cron jobs)
		avgResponseTimeMs: integer("avg_response_time_ms"),
		maxResponseTimeMs: integer("max_response_time_ms"),
		p95ResponseTimeMs: integer("p95_response_time_ms"),
		// Daily status
		status: text("status", { enum: ["up", "degraded", "down"] }).notNull(),
	},
	(table) => [
		index("monitor_daily_stats_monitor_type_date_idx").on(
			table.monitorId,
			table.monitorType,
			table.date,
		),
		index("monitor_daily_stats_date_idx").on(table.date),
	],
);
```

#### Status Page Tables

```typescript
export const statusPageDnsMonitors = sqliteTable(
	"status_page_dns_monitors",
	{
		id: pk("id"),
		createdAt,
		statusPageId: uuid("status_page_id").notNull(),
		dnsMonitorId: uuid("dns_monitor_id").notNull(),
		displayName: text("display_name"),
		order: integer("order").notNull().default(0),
	},
	(table) => [index("status_page_dns_monitors_page_idx").on(table.statusPageId)],
);

export const statusPageTcpMonitors = sqliteTable(
	"status_page_tcp_monitors",
	{
		id: pk("id"),
		createdAt,
		statusPageId: uuid("status_page_id").notNull(),
		tcpMonitorId: uuid("tcp_monitor_id").notNull(),
		displayName: text("display_name"),
		order: integer("order").notNull().default(0),
	},
	(table) => [index("status_page_tcp_monitors_page_idx").on(table.statusPageId)],
);

export const statusPageSslMonitors = sqliteTable(
	"status_page_ssl_monitors",
	{
		id: pk("id"),
		createdAt,
		statusPageId: uuid("status_page_id").notNull(),
		sslMonitorId: uuid("ssl_monitor_id").notNull(),
		displayName: text("display_name"),
		order: integer("order").notNull().default(0),
	},
	(table) => [index("status_page_ssl_monitors_page_idx").on(table.statusPageId)],
);
```

### Modified Tables

#### `alert_events` - Add columns

**Note:** These columns are **nullable** for backward compatibility with existing rows.

```typescript
// Add to existing alertEvents table
monitorType: text("monitor_type", {
  enum: ["http", "dns", "tcp", "cron", "ssl"],
}), // nullable for existing rows
monitorName: text("monitor_name"), // nullable for existing rows
snapshot: text("snapshot", { mode: "json" }).$type<AlertEventSnapshot>(),
```

**Snapshot type:**

```typescript
type AlertEventSnapshot =
	| {
			type: "http";
			responseStatus: number;
			responseTimeMs: number;
			expectedStatus: number;
			url: string;
	  }
	| {
			type: "dns";
			status: string;
			resolvedValue: string | null;
			domain: string;
			recordType: string;
	  }
	| {
			type: "tcp";
			status: string;
			responseTimeMs: number | null;
			host: string;
			port: number;
	  }
	| {
			type: "cron";
			status: string;
			lastPingAt: string | null;
			nextExpectedAt: string | null;
			cronExpression: string;
			timezone: string;
	  }
	| {
			type: "ssl";
			status: string;
			expiresAt: string | null;
			daysUntilExpiry: number | null;
			hostname: string;
	  };
```

#### `monitors` - Remove SSL columns (deferred)

These columns will be deprecated after SSL migration:

- `sslMonitoringEnabled`
- `sslExpiryWarningDays`
- `sslExpiresAt`
- `sslIssuer`
- `sslLastCheckedAt`
- `sslStatus`

### New Relations

```typescript
// SSL Monitors
export const sslMonitorsRelations = relations(sslMonitors, ({ one }) => {
  return {
    team: one(teams, {
      fields: [sslMonitors.teamId],
      references: [teams.id],
    }),
    httpMonitor: one(monitors, {
      fields: [sslMonitors.httpMonitorId],
      references: [monitors.id],
    }),
  };
});

// Add to teamsRelations
sslMonitors: many(sslMonitors),

// Status Page DNS Monitors
export const statusPageDnsMonitorsRelations = relations(
  statusPageDnsMonitors,
  ({ one }) => {
    return {
      statusPage: one(statusPages, {
        fields: [statusPageDnsMonitors.statusPageId],
        references: [statusPages.id],
      }),
      dnsMonitor: one(dnsMonitors, {
        fields: [statusPageDnsMonitors.dnsMonitorId],
        references: [dnsMonitors.id],
      }),
    };
  }
);

// Status Page TCP Monitors
export const statusPageTcpMonitorsRelations = relations(
  statusPageTcpMonitors,
  ({ one }) => {
    return {
      statusPage: one(statusPages, {
        fields: [statusPageTcpMonitors.statusPageId],
        references: [statusPages.id],
      }),
      tcpMonitor: one(tcpMonitors, {
        fields: [statusPageTcpMonitors.tcpMonitorId],
        references: [tcpMonitors.id],
      }),
    };
  }
);

// Status Page SSL Monitors
export const statusPageSslMonitorsRelations = relations(
  statusPageSslMonitors,
  ({ one }) => {
    return {
      statusPage: one(statusPages, {
        fields: [statusPageSslMonitors.statusPageId],
        references: [statusPages.id],
      }),
      sslMonitor: one(sslMonitors, {
        fields: [statusPageSslMonitors.sslMonitorId],
        references: [sslMonitors.id],
      }),
    };
  }
);

// Add to statusPagesRelations
dnsMonitors: many(statusPageDnsMonitors),
tcpMonitors: many(statusPageTcpMonitors),
sslMonitors: many(statusPageSslMonitors),
```

## Daily Status Calculation

```typescript
function determineStatus(
	successfulChecks: number,
	totalChecks: number,
): "up" | "degraded" | "down" {
	if (totalChecks === 0) return "up";
	let successRate = successfulChecks / totalChecks;
	if (successRate === 1) return "up";
	if (successRate >= 0.5) return "degraded";
	return "down";
}
```

## KV Caching Strategy (Legacy)

> **Note:** See "KV Caching Strategy" section above for updated cache key pattern and TTL rules.

Dashboard queries are cached in KV with dynamic TTL based on team's monitor intervals:

```typescript
async function getCacheTtl(db: Database, teamId: string): Promise<number> {
	let intervals = await db.query.monitors.findMany({
		columns: { intervalSeconds: true },
		where: eq(monitors.teamId, teamId),
	});

	if (intervals.length === 0) return 60; // Default 1 minute

	let minInterval = Math.min(...intervals.map((m) => m.intervalSeconds));
	// Clamp between 60 seconds and 10 minutes
	return Math.max(60, Math.min(600, minInterval));
}
```

## Pricing Analysis

### Uptime Pricing Model

- **Base:** $5/month per user includes 5,000 pings
- **Overage:** $0.001 per additional ping
- **Revenue per ping:** $0.001

### Cloudflare Analytics Engine Costs

| Resource | Free Tier | Paid         |
| -------- | --------- | ------------ |
| Writes   | 10M/month | $0.05 per 1M |
| Reads    | 1M/month  | $1.00 per 1M |

### User Profile Assumptions

| Profile    | Monitors | Interval | Pings/User/Month | Dashboard Loads/Month |
| ---------- | -------- | -------- | ---------------- | --------------------- |
| Hobby      | 3        | 10 min   | 12,960           | 50                    |
| Indie      | 10       | 5 min    | 86,400           | 100                   |
| Startup    | 25       | 3 min    | 360,000          | 300                   |
| Business   | 50       | 1 min    | 2,160,000        | 500                   |
| Enterprise | 200      | 1 min    | 8,640,000        | 1,000                 |

### Platform Scale Scenarios (100 Users)

#### Scenario 1: 100 Hobby Users

```
User profile: 3 monitors, 10-min intervals
Pings/user/month: 3 × 6 × 24 × 30 = 12,960

Total pings: 100 × 12,960 = 1,296,000 pings
Total revenue: 100 × ($5 + (12,960 - 5,000) × $0.001) = 100 × $12.96 = $1,296/month

Analytics Engine:
- Writes: 1,296,000 (under 10M free tier)
- Reads: 100 × 50 = 5,000 (under 1M free tier)
- Cost: $0

Profit: $1,296 (100% margin)
```

#### Scenario 2: 100 Indie Users

```
User profile: 10 monitors, 5-min intervals
Pings/user/month: 10 × 12 × 24 × 30 = 86,400

Total pings: 100 × 86,400 = 8,640,000 pings
Total revenue: 100 × ($5 + (86,400 - 5,000) × $0.001) = 100 × $86.40 = $8,640/month

Analytics Engine:
- Writes: 8,640,000 (under 10M free tier)
- Reads: 100 × 100 = 10,000 (under 1M free tier)
- Cost: $0

Profit: $8,640 (100% margin)
```

#### Scenario 3: 100 Startup Users

```
User profile: 25 monitors, 3-min intervals
Pings/user/month: 25 × 20 × 24 × 30 = 360,000

Total pings: 100 × 360,000 = 36,000,000 pings
Total revenue: 100 × ($5 + (360,000 - 5,000) × $0.001) = 100 × $360 = $36,000/month

Analytics Engine:
- Writes: 36,000,000 (26M over free tier)
- Write cost: 26 × $0.05 = $1.30
- Reads: 100 × 300 = 30,000 (under 1M free tier)
- Cost: $1.30

Profit: $36,000 - $1.30 = $35,998.70 (99.996% margin)
```

#### Scenario 4: 100 Business Users

```
User profile: 50 monitors, 1-min intervals
Pings/user/month: 50 × 60 × 24 × 30 = 2,160,000

Total pings: 100 × 2,160,000 = 216,000,000 pings
Total revenue: 100 × ($5 + (2,160,000 - 5,000) × $0.001) = 100 × $2,160 = $216,000/month

Analytics Engine:
- Writes: 216,000,000 (206M over free tier)
- Write cost: 206 × $0.05 = $10.30
- Reads: 100 × 500 = 50,000 (under 1M free tier)
- Cost: $10.30

Profit: $216,000 - $10.30 = $215,989.70 (99.995% margin)
```

#### Scenario 5: 100 Enterprise Users

```
User profile: 200 monitors, 1-min intervals
Pings/user/month: 200 × 60 × 24 × 30 = 8,640,000

Total pings: 100 × 8,640,000 = 864,000,000 pings
Total revenue: 100 × ($5 + (8,640,000 - 5,000) × $0.001) = 100 × $8,640 = $864,000/month

Analytics Engine:
- Writes: 864,000,000 (854M over free tier)
- Write cost: 854 × $0.05 = $42.70
- Reads: 100 × 1,000 = 100,000 (under 1M free tier)
- Cost: $42.70

Profit: $864,000 - $42.70 = $863,957.30 (99.995% margin)
```

### Mixed User Base (Realistic Scenario)

A realistic platform might have a mix of user types:

```
User Distribution (100 users total):
- 40 Hobby users (3 monitors, 10-min)    →   518,400 pings
- 30 Indie users (10 monitors, 5-min)    → 2,592,000 pings
- 20 Startup users (25 monitors, 3-min)  → 7,200,000 pings
- 8 Business users (50 monitors, 1-min)  → 17,280,000 pings
- 2 Enterprise users (200 monitors, 1-min) → 17,280,000 pings

Total pings: 44,870,400 pings/month

Revenue:
- 40 Hobby:     40 × $12.96  =    $518.40
- 30 Indie:     30 × $86.40  =  $2,592.00
- 20 Startup:   20 × $360    =  $7,200.00
- 8 Business:   8 × $2,160   = $17,280.00
- 2 Enterprise: 2 × $8,640   = $17,280.00

Total revenue: $44,870.40/month

Analytics Engine:
- Writes: 44,870,400 (34.87M over free tier)
- Write cost: 34.87 × $0.05 = $1.74
- Reads: ~25,000 (under 1M free tier)
- Cost: $1.74

Profit: $44,870.40 - $1.74 = $44,868.66 (99.996% margin)
```

### Break-Even Analysis

**When do Analytics Engine costs become significant?**

At $0.05 per 1M writes, to reach $100/month in AE costs:

- Need 2B writes/month (2,000M)
- That's 2,000M pings generating $2,000,000/month revenue
- AE cost would be 0.005% of revenue

**Conclusion:** Analytics Engine costs are negligible at any realistic scale.

### Cost Summary Table

| Scenario (100 users) | Total Pings | Revenue  | AE Cost | Profit   | Margin  |
| -------------------- | ----------- | -------- | ------- | -------- | ------- |
| 100 Hobby            | 1.3M        | $1,296   | $0      | $1,296   | 100%    |
| 100 Indie            | 8.6M        | $8,640   | $0      | $8,640   | 100%    |
| 100 Startup          | 36M         | $36,000  | $1.30   | $35,999  | 99.996% |
| 100 Business         | 216M        | $216,000 | $10.30  | $215,990 | 99.995% |
| 100 Enterprise       | 864M        | $864,000 | $42.70  | $863,957 | 99.995% |
| Mixed (realistic)    | 45M         | $44,870  | $1.74   | $44,869  | 99.996% |

### Key Insights

1. **Free tier covers small platforms** - Under 10M writes/month (~100 indie users) costs $0
2. **Costs scale sub-linearly** - 100x more pings = 100x more revenue but only ~$40 more cost
3. **Reads are essentially free** - Even 100K dashboard loads/month is under the 1M free tier
4. **KV caching further reduces reads** - Cached queries don't hit Analytics Engine at all
5. **Worst case is still excellent** - Even at 864M pings, AE costs 0.005% of revenue

## Migration Strategy

### Dual-Write Phase

1. **Add dual-write** - Instrument HTTP ping workflow and TCP check job to write to both D1 (`monitor_results`/`tcp_monitor_results`) and Analytics Engine simultaneously
2. **Verify writes** - Confirm data is being written to AE correctly via healthcheck endpoint and manual queries
3. **Switch reads** - Update dashboard to read from AE (with KV cache) instead of D1
4. **Verify reads** - Confirm dashboard displays correct data from AE
5. **Stop dual-write** - Remove D1 writes for HTTP/TCP results; AE becomes the sole source for real-time data

### Backfill Strategy

- **No AE backfill** - We will NOT backfill the last 90 days of data into Analytics Engine
- **Daily aggregates only** - Historical data will be aggregated into `monitor_daily_stats` table
- **Backfill trigger** - Add an API endpoint that queues a job to populate `monitor_daily_stats` from existing D1 ping data
- **Backfill timing** - Run after dual-write phase completes and AE reads are verified

### Data Retention Post-Migration

- **Real-time data (0-90 days)** - Analytics Engine only; D1 tables eventually deprecated
- **Historical data (90-365 days)** - `monitor_daily_stats` table in D1
- **No D1 fallback** - If AE fails, show user error message; do not fall back to D1 reads

## Data Source by View

### Dashboard (`/app/:team/dashboard`)

All real-time data reads from **Analytics Engine** (with KV cache):

| Component                    | Data Source             | Time Range             |
| ---------------------------- | ----------------------- | ---------------------- |
| Monitor results table        | Analytics Engine        | Last 24 hours          |
| Uptime percentage stat card  | Analytics Engine        | Last 24 hours          |
| Slowest endpoint stat card   | Analytics Engine        | Last 24 hours          |
| Monthly ping usage stat card | Polar API + estimate    | Current billing period |
| Monitor count per type       | D1 (monitors tables)    | Current                |
| SSL Monitors stat card (new) | D1 (ssl_monitors table) | Current                |

**Error UX:** When AE is unavailable, display inline banner: "Analytics data temporarily unavailable. Please retry later." Empty states are only shown when there is genuinely no data.

### Monitor Detail (`/app/:team/monitors/:monitor`)

Historical data reads from **D1 daily aggregates** only:

| Component             | Data Source              | Time Range    |
| --------------------- | ------------------------ | ------------- |
| 365-day history table | D1 `monitor_daily_stats` | Last 365 days |
| Uptime chart          | D1 `monitor_daily_stats` | Last 365 days |
| Response time chart   | D1 `monitor_daily_stats` | Last 365 days |

**Key insight:** Only the dashboard reads from Analytics Engine. All other views use D1 (either live monitor tables or daily aggregates).

### Stat Cards Row (Dashboard)

Current: 4 cards (HTTP Monitors, DNS Monitors, TCP Monitors, Cron Jobs)
Updated: 5 cards (HTTP Monitors, DNS Monitors, TCP Monitors, Cron Jobs, **SSL Monitors**)

## Error Handling Strategy

### Analytics Engine Failures

When AE queries fail (missing token, network error, invalid response):

1. **Do NOT fall back to D1** - After full migration, D1 will not have current data
2. **Surface error to user** - Show a clear message: "Data temporarily unavailable. Please retry later."
3. **Log the error** - Capture details for debugging via logger
4. **Return failure Result** - Use `@pkg/result` pattern to propagate errors

### Healthcheck Endpoint

- **Path:** `/healthcheck/analytics-engine`
- **Purpose:** External monitoring to detect AE availability issues
- **Behavior:** Run minimal `SELECT 1` query against AE; return 200 on success, 503 on failure
- **No caching:** Always hit AE directly for real-time status
- **Access:** Public (no authentication required)

## KV Caching Strategy

### Cache Key Pattern

```
cache:${teamId}:dashboard:v1:${segment}
```

**Examples:**

- `cache:abc123:dashboard:v1:uptime24h`
- `cache:abc123:dashboard:v1:latency24h`
- `cache:abc123:dashboard:v1:sparkline`

This pattern allows:

- Easy identification in Cloudflare dashboard
- Manual cache clearing per team via KV UI
- Wildcard-style operations if needed

### TTL Calculation

```typescript
function getCacheTtl(minIntervalSeconds: number): number {
	const MIN_TTL = 60; // 1 minute minimum
	const MAX_TTL = 600; // 10 minutes maximum
	return Math.max(MIN_TTL, Math.min(MAX_TTL, minIntervalSeconds));
}
```

- **Minimum:** 60 seconds (prevents excessive AE queries)
- **Maximum:** 600 seconds (ensures data freshness for slow monitors)
- **Default:** Uses team's minimum monitor interval

## Implementation Phases

### Phase 1: Schema Changes ✅

Update Drizzle schema and generate migration.

**Steps:**

1. ✅ Update `apps/uptime/db/schema.ts` with new tables and columns
2. ✅ Run `bun run orm:generate` to generate migration SQL
3. ✅ Run `bun run db:local:migrate` to apply locally and test
4. ✅ Production migration runs automatically before deploy

**Files:**

- `apps/uptime/db/schema.ts` - Add new tables, modify alertEvents
- `apps/uptime/db/migrations/` - Auto-generated by drizzle-kit

### Phase 2: Analytics Engine Integration (Dual-Write) ✅

Add writes to ping workflow and TCP job. During this phase, write to BOTH D1 and Analytics Engine.

**Files:**

- ✅ `apps/uptime/app/workflows/ping.ts` - Add writeDataPoint (keep D1 write)
- ✅ `apps/uptime/app/jobs/check-tcp.ts` - Add writeDataPoint (keep D1 write)
- ✅ `apps/uptime/app/services/analytics.server.ts` - Query helper with KV cache
- ✅ `apps/uptime/app/routes/healthcheck.analytics-engine.ts` - Health endpoint

### Phase 3: Daily Aggregation Job ✅

Create cron job to aggregate daily stats.

**Files:**

- ✅ `apps/uptime/app/jobs/aggregate-daily-stats.ts`
- ✅ `apps/uptime/app/entry.worker.ts` - Add cron trigger and queue handler
- ✅ `apps/uptime/wrangler.jsonc` - Add cron trigger

**Wrangler cron config to add:**

```jsonc
{
	"triggers": {
		"crons": [
			"* * * * *", // Every minute (existing - pingLater)
			"*/10 * * * *", // Every 10 minutes (existing - enqueuePendingDomains)
			"0 0 * * *", // Daily at midnight (existing - clean)
			"0 6 * * *", // Daily at 6 AM (existing - checkSsl)
			"0 * * * *", // Every hour (existing - checkDns)
			"*/5 * * * *", // Every 5 minutes (existing - checkTcp)
			"0 1 * * *", // NEW: Daily at 1 AM UTC - aggregateDailyStats
		],
	},
}
```

**Queue message type to add:**

```typescript
z.object({ type: z.literal("aggregateDailyStats") });
```

### Phase 4: Dashboard Query Updates ✅

Update dashboard to use Analytics Engine with KV caching. Show error message to user if AE is unavailable (no D1 fallback).

**Scope:** Only the dashboard reads from AE. All data is last 24 hours:

- Monitor results table ✅
- Uptime percentage stat card ✅
- Slowest endpoint stat card ✅

Monitor detail pages (`/app/:team/monitors/:monitor`) read from `monitor_daily_stats` D1 table only.

**Files:**

- ✅ `apps/uptime/app/routes/app/$team.dashboard/query.server.ts`
- ✅ `apps/uptime/app/routes/app/$team.dashboard/route.tsx` - Add error state UI
- ✅ `apps/uptime/app/routes/app/$team.dashboard/components/` - Add SSL Monitors stat card

### Phase 5: Alert Event Updates (Partial)

Update all alert recording to include type and snapshot.

**Files:**

- ✅ `apps/uptime/app/workflows/ping.ts` - Added snapshot to alert events
- `apps/uptime/app/jobs/check-dns.ts` - TODO: Add snapshot (currently doesn't record alert events)
- `apps/uptime/app/jobs/check-tcp.ts` - TODO: Add snapshot (currently doesn't record alert events)
- ✅ `apps/uptime/app/jobs/check-cron-jobs.ts` - Added snapshot to alert events
- `apps/uptime/app/jobs/check-ssl.ts` - TODO: Add snapshot (currently doesn't record alert events)
- ✅ `apps/uptime/app/services/alert-cooldown.ts` - Extended to accept monitorType, monitorName, snapshot

### Phase 6: SSL Monitoring Standalone

Create separate SSL monitoring feature.

**Files:**

- `apps/uptime/app/models/ssl-monitor.ts`
- `apps/uptime/app/routes/api/v1.ssl-monitors.ts`
- `apps/uptime/app/routes/api/v1.ssl-monitors.$sslMonitorId.ts`
- `apps/uptime/app/jobs/check-ssl.ts` - Update to use new table
- `apps/uptime/app/routes/app/$team.ssl/*` - UI routes

### Phase 7: Status Page Updates

Add DNS, TCP, SSL to status pages.

**Files:**

- `apps/uptime/app/routes/app/$team.status-pages.$statusPageId/*`
- `apps/uptime/app/routes/status.$slug.tsx`

### Phase 8: Stop Dual-Write

After verifying AE reads are working correctly:

- Remove D1 writes from `ping.ts` and `check-tcp.ts`
- AE becomes sole source for HTTP/TCP real-time data
- D1 tables (`monitor_results`, `tcp_monitor_results`) remain for backfill reference

**Files:**

- `apps/uptime/app/workflows/ping.ts` - Remove D1 write
- `apps/uptime/app/jobs/check-tcp.ts` - Remove D1 write

### Phase 9: Backfill Daily Aggregates

Populate `monitor_daily_stats` from existing D1 data:

- Add API endpoint to trigger backfill job (public, no auth - temporary endpoint)
- Queue processes historical data in batches
- Uses same aggregation logic as daily cron (idempotent upserts)
- No AE backfill - only daily aggregates
- **Sends completion email to `hello@sergiodxa.com` when backfill finishes**
- Endpoint will be removed after production backfill completes

**Files:**

- `apps/uptime/app/routes/api/v1.backfill-daily-stats.ts` - Trigger endpoint
- `apps/uptime/app/jobs/backfill-daily-stats.ts` - Backfill worker

### Phase 10: Cleanup (Deferred)

After backfill completes and data verified:

- Archive/drop `monitor_results` table
- Archive/drop `tcp_monitor_results` table
- Remove any remaining D1 result queries

## Relevant Files Reference

### Schema & Database

- `apps/uptime/db/schema.ts` - All table definitions
- `apps/uptime/db/index.ts` - Database connection
- `apps/uptime/db/migrations/` - Migration files

### Workflows & Jobs

- `apps/uptime/app/workflows/ping.ts` - HTTP monitor ping workflow
- `apps/uptime/app/jobs/check-dns.ts` - DNS monitoring job
- `apps/uptime/app/jobs/check-tcp.ts` - TCP monitoring job
- `apps/uptime/app/jobs/check-cron-jobs.ts` - Cron job monitoring
- `apps/uptime/app/jobs/check-ssl.ts` - SSL certificate checking
- `apps/uptime/app/jobs/clean.ts` - Data cleanup job

### Models

- `apps/uptime/app/models/monitor.ts` - HTTP monitor model
- `apps/uptime/app/models/tcp-monitor.ts` - TCP monitor model
- `apps/uptime/app/models/cron-job-monitor.ts` - Cron job model
- `apps/uptime/app/models/customer.ts` - Billing/usage model

### Services

- `apps/uptime/app/services/alert-cooldown.ts` - Alert recording
- `apps/uptime/app/services/check-ssl.ts` - SSL status calculation
- `apps/uptime/app/services/check-dns.ts` - DNS checking
- `apps/uptime/app/services/check-tcp.ts` - TCP checking

### Dashboard

- `apps/uptime/app/routes/app/$team.dashboard/route.tsx` - Dashboard route
- `apps/uptime/app/routes/app/$team.dashboard/query.server.ts` - Dashboard queries
- `apps/uptime/app/routes/app/$team.dashboard/components/` - Dashboard components

### Configuration

- `apps/uptime/wrangler.jsonc` - Cloudflare config (bindings, crons)
- `apps/uptime/worker-configuration.d.ts` - TypeScript types for bindings

### API Endpoints

- `apps/uptime/app/routes/api/v1.monitors.*.ts` - HTTP monitor API
- `apps/uptime/app/routes/api/v1.status.ts` - Status API

## Relevant Skills

- `.opencode/skills/cloudflare/` - Cloudflare Workers patterns
- `.opencode/skills/durable-objects/` - Durable Objects (used by GeoFetch)
- `.opencode/skills/logging-best-practices/` - Logging patterns
- `.opencode/skills/frontend-react-router-best-practices/` - Route patterns

## Relevant Documentation

### Analytics Engine

- `.agents/skills/cloudflare/references/analytics-engine/api.md` - Write/query API
- `.agents/skills/cloudflare/references/analytics-engine/configuration.md` - Setup & pricing
- `.agents/skills/cloudflare/references/analytics-engine/gotchas.md` - Common issues
- `.agents/skills/cloudflare/references/analytics-engine/patterns.md` - Usage patterns

### External

- [Cloudflare Analytics Engine Docs](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [D1 Docs](https://developers.cloudflare.com/d1/)

## Environment Variables Required

```bash
# Already configured in .dev.vars and wrangler secrets
CLOUDFLARE_ACCOUNT_ID=<configured>
CLOUDFLARE_ANALYTICS_TOKEN=<configured>
```

The API token needs the `Account Analytics: Read` permission.

**Status:** Environment variables have been set up and are ready to use.

## Consequences

### Positive

- **Faster dashboard** - Server-side aggregations instead of JavaScript processing
- **Better scalability** - Analytics Engine designed for high-volume time-series
- **365-day retention** - Daily aggregates enable long-term history without storing every ping
- **Self-contained alerts** - Alert history shows full context without joins
- **Cleaner schema** - SSL monitoring properly separated
- **Status page flexibility** - All monitor types supported

### Negative

- **External API dependency** - Analytics Engine queries require HTTP API call
- **90-day detail limit** - Individual ping data only available for 90 days
- **Migration complexity** - Multiple phases of changes
- **New environment variables** - Need to set up API tokens
- **No graceful degradation** - AE failures surface as user-visible errors (by design)

### Neutral

- **Dual storage** - HTTP/TCP write to both Analytics Engine and D1 during transition (temporary)
- **Caching layer** - KV cache adds complexity but improves performance
- **Healthcheck endpoint** - Additional route to maintain but enables monitoring

## Current Progress

### Completed

- [x] ADR documented with full context
- [x] Environment variables configured (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_TOKEN`)
- [x] `PING_RESULTS` Analytics Engine binding already in `wrangler.jsonc`
- [x] Migration strategy finalized (dual-write → verify → switch reads → stop dual-write → backfill)
- [x] Error handling strategy defined (no D1 fallback; surface errors to user)
- [x] KV cache key pattern defined (`cache:${teamId}:dashboard:v1:${segment}`)
- [x] TTL clamping defined (60s min, 600s max)
- [x] Healthcheck endpoint path defined (`/healthcheck/analytics-engine`)
- [x] **Phase 1: Schema Changes** - New tables and columns added, migration applied locally and remotely
- [x] **Phase 2: Dual-Write** - HTTP and TCP monitors now write to both D1 and Analytics Engine
- [x] **Phase 3: Daily Aggregation Job** - Cron job created to run at 1 AM UTC
- [x] **Dual-write verified** - 440+ events recorded in Analytics Engine, healthcheck confirms connectivity
- [x] **Phase 4: Dashboard uses Analytics Engine** - Dashboard queries read from AE with KV cache; AE failure banner and SSL stat card added
- [x] **Phase 5: Alert Event Updates** - Alert events recorded with snapshots across HTTP, Cron, DNS, TCP, SSL

### Next Step

**Phase 8: Stop Dual-Write (after AE read stability)**

1. Remove D1 writes from `ping.ts` and `check-tcp.ts`
2. Keep AE as sole real-time source for HTTP/TCP
3. Retain D1 tables temporarily for backfill reference

Then Phase 9: Backfill `monitor_daily_stats` from existing D1 data (idempotent batches, no AE backfill).

## Notes

- The `PING_RESULTS` binding is already configured in `wrangler.jsonc` but unused
- SSL monitoring currently relies on manually entered expiry dates (Workers can't read TLS certs from fetch)
- The daily aggregation runs at 1 AM UTC to ensure previous day data is complete
- KV cache TTL is clamped between 60 seconds and 10 minutes
- KV cache keys follow pattern `cache:${teamId}:dashboard:v1:${segment}` for easy identification/clearing
- New `alertEvents` columns are nullable for backward compatibility with existing rows
- Production migrations run automatically before deploy, not when generated
- Response bodies are never stored; content checks read and discard immediately
- SSL monitors table starts empty; existing HTTP monitor SSL columns remain until manual migration
- Daily aggregation uses idempotent upserts keyed by `(monitorId, monitorType, date)` - no locking needed
- Backfill job reuses same aggregation logic; safe to run multiple times
- Only the dashboard reads from Analytics Engine; monitor detail pages read from `monitor_daily_stats` only
- Dashboard stat cards row will have 5 cards: HTTP, DNS, TCP, Cron, SSL
- Healthcheck endpoint is public (no auth) for external monitoring
- Backfill trigger endpoint is public/temporary; sends email to `hello@sergiodxa.com` on completion; removed after use
- AE failure shows inline banner, not empty state (empty state reserved for genuinely no data)
