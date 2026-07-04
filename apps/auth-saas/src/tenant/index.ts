import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { Logger } from "@pkg/logger/request";
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

import AuthorizationCode from "./models/authorization-code";
import EmailVerificationToken from "./models/email-verification-token";
import Session from "./models/session";
import SigningKey from "./models/signing-key";
import Subject from "./models/subject";
import WebAuthnChallenge from "./models/webauthn-challenge";
import createRouter from "./router";

export default class Tenant extends DurableObject {
	#db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);
		state.blockConcurrencyWhile(() => this.setup());
	}

	override async fetch(request: Request) {
		let logger = new Logger(request);
		try {
			let response = await createRouter(this.#db, logger).fetch(request);
			logger.response = response;
			return response;
		} finally {
			logger.flush();
		}
	}

	override async alarm() {
		await this.cleanup();
		await this.scheduleCleanupAlarm();
	}

	private async setup() {
		await this.migrate();
		await this.generateSigningKeys();
		await this.scheduleCleanupAlarm();
	}

	private async generateSigningKeys() {
		let currentKey = await SigningKey.getCurrent(this.#db);
		if (!currentKey) await SigningKey.generate(this.#db);
	}

	private async scheduleCleanupAlarm() {
		let existingAlarm = await this.ctx.storage.getAlarm();
		if (existingAlarm) return;

		// Schedule cleanup at midnight UTC tomorrow
		let tomorrow = new Date();
		tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
		tomorrow.setUTCHours(0, 0, 0, 0);
		await this.ctx.storage.setAlarm(tomorrow.getTime());
	}

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

	/**
	 * Applies pending schema migrations exactly once, tracked by `PRAGMA user_version`.
	 *
	 * Each migration runs when the stored version is below its index, then the
	 * version is bumped. This replaces the previous re-run-everything-with-swallowed-errors
	 * approach, which re-executed idempotent-unsafe statements (e.g. the dashboard-client
	 * seed) on every cold start.
	 */
	private async migrate() {
		let migrations = await Promise.all([
			import("./migrations/0001-init.sql?raw"),
			import("./migrations/0002-add-authz-codes-client-index.sql?raw"),
			import("./migrations/0003-add-pkce-to-webauthn-challenges.sql?raw"),
			import("./migrations/0004-add-signing-keys-current-index.sql?raw"),
			import("./migrations/0005-seed-dashboard-client.sql?raw"),
			import("./migrations/0006-add-passkey-credential-id.sql?raw"),
			import("./migrations/0007-browser-sessions-and-login-tokens.sql?raw"),
		]);

		let sql = this.ctx.storage.sql;
		let row = sql.exec<{ user_version: number }>("PRAGMA user_version").one();
		let applied = Number(row.user_version ?? 0);

		for (let version = applied; version < migrations.length; version++) {
			sql.exec(migrations[version]!.default);
			// PRAGMA does not accept bound parameters; the value is a controlled integer.
			sql.exec(`PRAGMA user_version = ${version + 1}`);
		}
	}
}
