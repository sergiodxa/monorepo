---
title: How to Use Durable Object Alarms for Background Cleanup
excerpt: Schedule recurring alarms to automatically clean up expired data in Durable Objects.
tech: "@cloudflare/workers-types@4.0.0"
---

Every application accumulates temporary data that needs periodic cleanup. Sessions expire, authorization codes become stale, verification tokens go unused. In a traditional server environment, you would reach for cron jobs or background workers. With Cloudflare Durable Objects, you have a better option: alarms.

Durable Object alarms are scheduled callbacks that execute within your object instance. They provide single flight execution (only one alarm runs at a time), automatic retries on failure, and persistent scheduling that survives restarts. This makes them ideal for background maintenance tasks like cleaning up expired data.

## Set Up the Durable Object Structure

Start with a Durable Object class that schedules cleanup on initialization:

```ts {% path="src/tenant/index.ts" %}
import { DurableObject } from "cloudflare:workers";

export default class Tenant extends DurableObject {
	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);
		state.blockConcurrencyWhile(() => this.setup());
	}

	override async fetch(request: Request) {
		return new Response("OK");
	}

	override async alarm() {
		await this.cleanup();
		await this.scheduleCleanupAlarm();
	}

	private async setup() {
		await this.scheduleCleanupAlarm();
	}

	private async scheduleCleanupAlarm() {
		// Implementation below
	}

	private async cleanup() {
		// Implementation below
	}
}
```

The `blockConcurrencyWhile()` call ensures setup completes before handling any requests. This guarantees the alarm is scheduled before the object starts processing traffic.

The `alarm()` method has two responsibilities: run the cleanup and reschedule itself. This creates a recurring pattern where cleanup happens automatically without external triggers.

## Schedule Alarms at a Fixed Time

For maintenance tasks, scheduling at a predictable time like midnight UTC works well. This avoids impacting user traffic during peak hours:

```ts {% path="src/tenant/index.ts" %}
private async scheduleCleanupAlarm() {
	let existingAlarm = await this.ctx.storage.getAlarm();
	if (existingAlarm) return;

	let tomorrow = new Date();
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
	tomorrow.setUTCHours(0, 0, 0, 0);
	await this.ctx.storage.setAlarm(tomorrow.getTime());
}
```

The check for `existingAlarm` prevents overwriting an already scheduled alarm. Without this guard, you could accidentally push the alarm further into the future with each restart.

The `setAlarm()` method accepts a Unix timestamp in milliseconds. Using `getTime()` on a Date object gives you exactly that.

## Implement the Cleanup Logic

The cleanup method deletes all expired records. Run deletions in parallel for better performance:

```ts {% path="src/tenant/index.ts" %}
private async cleanup() {
	let now = Date.now();
	let oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

	await Promise.all([
		Subject.cleanupUnverified(this.#db, oneWeekAgo),
		Session.cleanupExpired(this.#db, now),
		AuthorizationCode.cleanupExpired(this.#db, now),
		WebAuthnChallenge.cleanupExpired(this.#db, now),
		EmailVerificationToken.cleanupExpired(this.#db, now),
	]);
}
```

Each model has its own `cleanupExpired` static method. This keeps the cleanup logic close to the data it operates on, making it easier to maintain.

Different data types may need different retention policies. Sessions might expire based on their `expires_at` timestamp, while unverified subjects might be cleaned up after a week of inactivity.

## Write Model Cleanup Methods

Each model needs a method to find and delete expired records:

```ts {% path="src/tenant/models/session.ts" %}
export default class Session {
	static table = createTable({
		name: "sessions",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			subject_id: s.string(),
			client_id: s.string(),
			expires_at: s.string(),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	static async cleanupExpired(db: Database, now: number) {
		let cutoffDate = new Date(now).toISOString();
		let sessions = await db.findMany(Session.table);
		let expiredIds = sessions.filter((s) => s.expires_at < cutoffDate).map((s) => s.id);

		if (expiredIds.length === 0) return 0;

		await Promise.all(expiredIds.map((id) => db.delete(Session.table, { id })));

		return expiredIds.length;
	}
}
```

The method returns the count of deleted records, which is useful for logging. Early return when there is nothing to delete avoids unnecessary work.

For authorization codes with numeric timestamps, the comparison is simpler:

```ts {% path="src/tenant/models/authorization-code.ts" %}
export default class AuthorizationCode {
	static TTL = 10 * 60 * 1000; // 10 minutes

	static table = createTable({
		name: "authorization_codes",
		primaryKey: ["code"],
		columns: {
			code: s.string(),
			client_id: s.string(),
			subject_id: s.string(),
			expires_at: s.number(),
			created_at: s.number(),
		},
	});

	static async cleanupExpired(db: Database, now: number) {
		let records = await db.findMany(AuthorizationCode.table);
		let expiredRecords = records.filter((record) => record.expires_at < now);

		if (expiredRecords.length === 0) return 0;

		await Promise.all(
			expiredRecords.map((record) => db.delete(AuthorizationCode.table, { code: record.code })),
		);

		return expiredRecords.length;
	}
}
```

Authorization codes have a short TTL (10 minutes per OAuth spec), so they accumulate quickly without cleanup.

## Handle Errors in Cleanup

Wrap your cleanup operations in error handling to prevent one failure from blocking others:

```ts {% path="src/tenant/index.ts" %}
private async cleanup() {
	let now = Date.now();
	let oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

	let results = await Promise.allSettled([
		Subject.cleanupUnverified(this.#db, oneWeekAgo),
		Session.cleanupExpired(this.#db, now),
		AuthorizationCode.cleanupExpired(this.#db, now),
		WebAuthnChallenge.cleanupExpired(this.#db, now),
		EmailVerificationToken.cleanupExpired(this.#db, now),
	]);

	for (let result of results) {
		if (result.status === "rejected") {
			console.error("Cleanup task failed:", result.reason);
		}
	}
}
```

Using `Promise.allSettled()` instead of `Promise.all()` ensures all cleanup tasks run even if one fails. The alarm will still be rescheduled, and failed tasks will be retried in the next cycle.

## Add Logging for Observability

Track cleanup operations for debugging and monitoring:

```ts {% path="src/tenant/index.ts" %}
import { Logger } from "@pkg/logger/request";

export default class Tenant extends DurableObject {
	override async alarm() {
		let logger = new Logger();
		try {
			let stats = await this.cleanup();
			logger.info("cleanup.complete", stats);
			await this.scheduleCleanupAlarm();
		} catch (error) {
			logger.error("cleanup.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			logger.flush();
		}
	}

	private async cleanup() {
		let now = Date.now();
		let oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

		let [subjects, sessions, codes, challenges, tokens] = await Promise.all([
			Subject.cleanupUnverified(this.#db, oneWeekAgo),
			Session.cleanupExpired(this.#db, now),
			AuthorizationCode.cleanupExpired(this.#db, now),
			WebAuthnChallenge.cleanupExpired(this.#db, now),
			EmailVerificationToken.cleanupExpired(this.#db, now),
		]);

		return {
			unverifiedSubjects: subjects,
			expiredSessions: sessions,
			expiredCodes: codes,
			expiredChallenges: challenges,
			expiredTokens: tokens,
		};
	}
}
```

Returning stats from cleanup and logging them makes it easy to track how much data gets cleaned up over time. If you notice unusually high numbers, it might indicate a bug creating too many temporary records.

Re-throwing errors after logging ensures the alarm gets retried. The Durable Object runtime will call your alarm handler again after a backoff period.

## Schedule Interval Based Alarms

Sometimes you want cleanup to run at a fixed interval rather than a specific time:

```ts {% path="src/tenant/index.ts" %}
private static CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

private async scheduleCleanupAlarm() {
	let existingAlarm = await this.ctx.storage.getAlarm();
	if (existingAlarm) return;

	let nextRun = Date.now() + Tenant.CLEANUP_INTERVAL;
	await this.ctx.storage.setAlarm(nextRun);
}
```

This approach is simpler but spreads load less evenly. With many Durable Objects, they will all have different alarm times based on when they were created. This can actually be beneficial since it prevents thundering herd problems where all objects run cleanup simultaneously.

## Handle Time Sensitive Cleanup

For data that must be cleaned up promptly, like security tokens, you might want more frequent checks:

```ts {% path="src/tenant/index.ts" %}
private async scheduleCleanupAlarm() {
	let existingAlarm = await this.ctx.storage.getAlarm();
	let hasUrgentCleanup = await this.hasExpiredSecurityTokens();

	if (hasUrgentCleanup) {
		let urgentTime = Date.now() + 5 * 60 * 1000;
		if (!existingAlarm || existingAlarm > urgentTime) {
			await this.ctx.storage.setAlarm(urgentTime);
		}
		return;
	}

	if (existingAlarm) return;

	let tomorrow = new Date();
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
	tomorrow.setUTCHours(0, 0, 0, 0);
	await this.ctx.storage.setAlarm(tomorrow.getTime());
}

private async hasExpiredSecurityTokens() {
	let now = Date.now();
	let codes = await this.#db.findMany(AuthorizationCode.table);
	return codes.some((code) => code.expires_at < now);
}
```

This adaptive approach runs cleanup sooner when there is expired security data, but falls back to the daily schedule otherwise. The tradeoff is additional database queries to check for expired data.

## Configure Alarms in wrangler.toml

Durable Objects with alarms need the proper configuration:

```toml {% path="wrangler.toml" %}
[[durable_objects.bindings]]
name = "TENANT"
class_name = "Tenant"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Tenant"]
```

No special configuration is needed for alarms. They are available automatically on any Durable Object.

## Final Thoughts

Durable Object alarms provide a reliable way to run background maintenance without external schedulers. The single flight guarantee means you never have to worry about concurrent cleanup runs corrupting data. Combined with automatic retries, this creates a robust cleanup system that requires minimal operational attention.

For more complex background task patterns, consider combining alarms with Cloudflare Workflows for long running tasks. Workflows provide step level retries and persistence, while alarms handle the scheduling. Together they cover most background processing needs without traditional job queues.
