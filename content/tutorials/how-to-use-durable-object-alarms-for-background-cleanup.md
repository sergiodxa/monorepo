---
title: How to Use Durable Object Alarms for Background Cleanup
excerpt: Build a Durable Object that deletes expired records on a recurring schedule.
tech: "@cloudflare/workers-types@4.0.0"
---

Temporary data piles up fast. Sessions expire, authorization codes go stale, and verification tokens become useless after a short window. If you keep everything inside a Durable Object, you can run that cleanup without adding cron jobs or a separate worker.

In this tutorial, you'll build a Durable Object that schedules its own alarm, deletes expired records, logs the results, and schedules the next run. The result is a self contained cleanup loop that lives with the data it maintains.

## Create the Durable Object

Start with a Durable Object that schedules setup on construction and exposes `fetch()` and `alarm()`.

```ts {% path="src/tenant/index.ts" %}
import { Logger } from "@pkg/logger";
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "~/lib/sql-storage-adapter";

import AuthorizationCode from "./models/authorization-code";
import EmailVerificationToken from "./models/email-verification-token";
import Session from "./models/session";
import Subject from "./models/subject";
import WebAuthnChallenge from "./models/webauthn-challenge";

let CLEANUP_INTERVAL_IN_MS = 24 * 60 * 60 * 1000;
let UNVERIFIED_SUBJECT_RETENTION_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface CleanupStats {
	unverifiedSubjects: number;
	expiredSessions: number;
	expiredCodes: number;
	expiredChallenges: number;
	expiredTokens: number;
}

export default class Tenant extends DurableObject {
	#db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);
		state.blockConcurrencyWhile(() => this.setup());
	}

	override async fetch(_request: Request) {
		return new Response("OK");
	}

	override async alarm() {
		let logger = new Logger();
		let stats = await this.cleanup();

		logger.info("tenant.cleanup.complete", stats);
		await this.scheduleCleanupAlarm();
	}

	private async setup() {
		await this.scheduleCleanupAlarm();
	}

	private async scheduleCleanupAlarm() {
		// implementation below
	}

	private async cleanup(): Promise<CleanupStats> {
		// implementation below
	}
}
```

`blockConcurrencyWhile()` makes the first alarm setup finish before the object handles traffic. That prevents a race where the object starts serving requests before the recurring cleanup loop exists.

## Schedule the First Alarm

Now add a scheduler that only creates a new alarm when one is not already pending.

```ts {% path="src/tenant/index.ts" %}
import { Logger } from "@pkg/logger";
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "~/lib/sql-storage-adapter";

import AuthorizationCode from "./models/authorization-code";
import EmailVerificationToken from "./models/email-verification-token";
import Session from "./models/session";
import Subject from "./models/subject";
import WebAuthnChallenge from "./models/webauthn-challenge";

let CLEANUP_INTERVAL_IN_MS = 24 * 60 * 60 * 1000;
let UNVERIFIED_SUBJECT_RETENTION_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface CleanupStats {
	unverifiedSubjects: number;
	expiredSessions: number;
	expiredCodes: number;
	expiredChallenges: number;
	expiredTokens: number;
}

export default class Tenant extends DurableObject {
	#db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);
		state.blockConcurrencyWhile(() => this.setup());
	}

	override async fetch(_request: Request) {
		return new Response("OK");
	}

	override async alarm() {
		let logger = new Logger();
		let stats = await this.cleanup();

		logger.info("tenant.cleanup.complete", stats);
		await this.scheduleCleanupAlarm();
	}

	private async setup() {
		await this.scheduleCleanupAlarm();
	}

	private async scheduleCleanupAlarm() {
		let existingAlarm = await this.ctx.storage.getAlarm();

		if (existingAlarm !== null) return;

		let nextRun = Date.now() + CLEANUP_INTERVAL_IN_MS;
		await this.ctx.storage.setAlarm(nextRun);
	}

	private async cleanup(): Promise<CleanupStats> {
		// implementation below
	}
}
```

This uses a fixed interval, which is usually enough for cleanup work. The guard around `getAlarm()` matters because constructors can run more than once for the same object over time.

## Add Cleanup Methods to Your Models

Each model should know how to delete its own expired rows. Start with sessions.

```ts {% path="src/tenant/models/session.ts" %}
import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

interface SessionRecord {
	id: string;
	subject_id: string;
	client_id: string;
	expires_at: string;
	created_at: string;
	updated_at: string;
}

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
		let cutoff = new Date(now).toISOString();
		let sessions = await db.findMany<SessionRecord>(Session.table);
		let expiredIds = sessions
			.filter((session) => session.expires_at < cutoff)
			.map((session) => session.id);

		if (expiredIds.length === 0) return 0;

		await Promise.all(expiredIds.map((id) => db.delete(Session.table, { id })));

		return expiredIds.length;
	}
}
```

Use the same pattern for authorization codes, but compare numeric timestamps directly.

```ts {% path="src/tenant/models/authorization-code.ts" %}
import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

interface AuthorizationCodeRecord {
	code: string;
	client_id: string;
	subject_id: string;
	expires_at: number;
	created_at: number;
}

export default class AuthorizationCode {
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
		let codes = await db.findMany<AuthorizationCodeRecord>(AuthorizationCode.table);
		let expiredCodes = codes.filter((code) => code.expires_at < now);

		if (expiredCodes.length === 0) return 0;

		await Promise.all(
			expiredCodes.map((code) => db.delete(AuthorizationCode.table, { code: code.code })),
		);

		return expiredCodes.length;
	}
}
```

Keep these methods on the model that owns the data. That keeps the Durable Object focused on orchestration, not on record specific query logic.

## Run Cleanup Inside the Alarm

With the model helpers in place, wire the cleanup method so one alarm run deletes every expired record type and returns counts for logging.

```ts {% path="src/tenant/index.ts" %}
import { Logger } from "@pkg/logger";
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "~/lib/sql-storage-adapter";

import AuthorizationCode from "./models/authorization-code";
import EmailVerificationToken from "./models/email-verification-token";
import Session from "./models/session";
import Subject from "./models/subject";
import WebAuthnChallenge from "./models/webauthn-challenge";

let CLEANUP_INTERVAL_IN_MS = 24 * 60 * 60 * 1000;
let UNVERIFIED_SUBJECT_RETENTION_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface CleanupStats {
	unverifiedSubjects: number;
	expiredSessions: number;
	expiredCodes: number;
	expiredChallenges: number;
	expiredTokens: number;
}

export default class Tenant extends DurableObject {
	#db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);
		state.blockConcurrencyWhile(() => this.setup());
	}

	override async fetch(_request: Request) {
		return new Response("OK");
	}

	override async alarm() {
		let logger = new Logger();
		let stats = await this.cleanup();

		logger.info("tenant.cleanup.complete", stats);
		await this.scheduleCleanupAlarm();
	}

	private async setup() {
		await this.scheduleCleanupAlarm();
	}

	private async scheduleCleanupAlarm() {
		let existingAlarm = await this.ctx.storage.getAlarm();

		if (existingAlarm !== null) return;

		let nextRun = Date.now() + CLEANUP_INTERVAL_IN_MS;
		await this.ctx.storage.setAlarm(nextRun);
	}

	private async cleanup(): Promise<CleanupStats> {
		let now = Date.now();
		let oneWeekAgo = now - UNVERIFIED_SUBJECT_RETENTION_IN_MS;

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

`Promise.all()` works well here because each cleanup query is independent. If one operation throws, the alarm fails, and Durable Objects retry alarms automatically, which is usually what you want for transient storage failures.

## Reschedule More Aggressively When Needed

Some data should be cleaned sooner than your normal interval. You can move the next alarm closer when urgent work already exists.

```ts {% path="src/tenant/index.ts" %}
// ... previous code

let URGENT_CLEANUP_INTERVAL_IN_MS = 5 * 60 * 1000;

export default class Tenant extends DurableObject {
	// ... previous code

	private async scheduleCleanupAlarm() {
		let existingAlarm = await this.ctx.storage.getAlarm();
		let hasExpiredCodes = await this.hasExpiredAuthorizationCodes();

		if (hasExpiredCodes) {
			let urgentRun = Date.now() + URGENT_CLEANUP_INTERVAL_IN_MS;

			if (existingAlarm === null || existingAlarm > urgentRun) {
				await this.ctx.storage.setAlarm(urgentRun);
			}

			return;
		}

		if (existingAlarm !== null) return;

		let nextRun = Date.now() + CLEANUP_INTERVAL_IN_MS;
		await this.ctx.storage.setAlarm(nextRun);
	}

	private async hasExpiredAuthorizationCodes() {
		let now = Date.now();
		let codes = await this.#db.findMany(AuthorizationCode.table);

		return codes.some((code) => code.expires_at < now);
	}

	// ... previous code
}
```

This adds one extra read before scheduling, so it is only worth it when faster cleanup matters. For many cases, a simple fixed interval is enough.

## Bind the Durable Object

Finally, register the Durable Object in `wrangler.toml` so the worker can create instances with alarm support.

```toml {% path="wrangler.toml" %}
[[durable_objects.bindings]]
name = "TENANT"
class_name = "Tenant"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Tenant"]
```

Alarms do not need extra Wrangler flags. If the class is a Durable Object, `alarm()` is available automatically.

## Final Thoughts

You now have a Durable Object that schedules its own cleanup loop, removes expired records, and records what it deleted. This keeps maintenance logic close to the state it manages, which is usually simpler than introducing a separate scheduler.

You can extend this further by using different intervals per tenant, collecting cleanup metrics, or moving long running follow up work into another background system.
