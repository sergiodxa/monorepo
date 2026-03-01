import { Logger } from "@pkg/logger/request";
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "~/lib/sql-storage-adapter";

import AuthorizationCode from "./models/authorization-code";
import EmailVerificationToken from "./models/email-verification-token";
import Session from "./models/session";
import SigningKey from "./models/signing-key";
import Subject from "./models/subject";
import WebAuthnChallenge from "./models/webauthn-challenge";
import createRouter from "./router";

export default class Tenant extends DurableObject {
	private readonly db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);

		state.blockConcurrencyWhile(async () => {
			await this.migrate();
			await this.generateSigningKeys();
			await this.scheduleCleanupAlarm();
		});
	}

	override async fetch(request: Request): Promise<Response> {
		let logger = new Logger(request);
		try {
			let response = await createRouter(this.db, logger).fetch(request);
			logger.response = response;
			return response;
		} finally {
			logger.flush();
		}
	}

	override async alarm(): Promise<void> {
		await this.cleanup();
		await this.scheduleCleanupAlarm();
	}

	private async migrate() {
		let { default: migration } = await import("./migrations/0001-init.sql?raw");
		this.ctx.storage.sql.exec(migration);
	}

	private async generateSigningKeys() {
		let currentKey = await SigningKey.getCurrent(this.db);
		if (!currentKey) await SigningKey.generate(this.db);
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
			Subject.cleanupUnverified(this.db, oneWeekAgo),
			Session.cleanupExpired(this.db, now),
			AuthorizationCode.cleanupExpired(this.db, now),
			WebAuthnChallenge.cleanupExpired(this.db, now),
			EmailVerificationToken.cleanupExpired(this.db, now),
		]);
	}
}
