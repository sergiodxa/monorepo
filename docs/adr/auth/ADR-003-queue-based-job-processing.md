# ADR-003: Queue-Based Job Processing

## Status

Accepted

## Context

The auth server has a scheduled cron job that runs daily at midnight to clean up expired sessions. The current implementation directly calls `Session.deleteExpiredSessions(db)` from the `scheduled` handler in `entry.worker.ts`.

This approach has limitations:

1. **No retry logic** - If the job fails, it won't be retried until the next day
2. **No structured logging** - No consistent logging pattern for job execution
3. **No uptime monitoring** - Cannot track job health via uptime service
4. **Inconsistent with other apps** - Other apps in the monorepo use `@pkg/jobs` with Cloudflare Queues

## Decision

Migrate the cron job to use `@pkg/jobs` with Cloudflare Queues:

1. The `scheduled` handler enqueues a message to a Queue
2. The `queue` handler processes messages and runs Jobs using `@pkg/jobs`
3. Jobs extend the `Job` base class which provides:
   - Structured logging via `BatchedLogger`
   - Automatic message acknowledgment and retry handling
   - Uptime monitoring pings on successful completion
   - Error classification (retriable vs non-retriable)

## Implementation

### Queue Configuration

Add to `wrangler.jsonc`:

```jsonc
"queues": {
  "consumers": [{ "queue": "auth" }],
  "producers": [{ "binding": "QUEUE", "queue": "auth" }]
}
```

### Job Definition

Create `app/jobs/clean-expired-sessions.ts`:

```typescript
import { Job } from "@pkg/jobs";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import Session from "~/models/session";

export class CleanExpiredSessionsJob extends Job {
	static override monitorId = "74f508a2-e6e9-4f01-8c25-2884330e7870";

	async perform(): Promise<void> {
		let db = database(env.DB);
		let expiredSessions = await Session.findExpiredSessions(db);

		if (expiredSessions.length === 0) {
			this.logger.info("job.clean_expired_sessions.no_expired");
			return;
		}

		await Session.deleteExpiredSessions(db);
		this.logger.info("job.clean_expired_sessions.completed", {
			deletedCount: expiredSessions.length,
		});
	}
}
```

### Worker Entry Point

Update `entry.worker.ts`:

- `scheduled` handler sends `{ type: "cleanExpiredSessions" }` to the queue
- `queue` handler validates message type and runs the appropriate job

## Consequences

### Positive

- **Automatic retries** - Failed jobs are retried by Cloudflare Queues
- **Structured logging** - Consistent log format with job ID, attempts, and timing
- **Uptime monitoring** - Job health tracked via uptime service pings
- **Consistency** - Aligns with job processing pattern used in other apps
- **Extensibility** - Easy to add more jobs in the future

### Negative

- **Added complexity** - Queue infrastructure adds moving parts
- **New dependency** - Requires `@pkg/jobs` package
- **Secret required** - Needs `UPTIME_CRON_API_KEY` for monitoring

## References

- `@pkg/jobs` package: `/packages/jobs/README.md`
- Uptime app jobs: `/apps/uptime/app/jobs/`
- Cloudflare Queues: https://developers.cloudflare.com/queues/
