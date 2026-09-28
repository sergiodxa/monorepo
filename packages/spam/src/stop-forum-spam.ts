/**
 * The StopForumSpam check: looks the author's IP, email and name up in a free, community-fed
 * database of addresses seen spamming forums and blogs, so a bot reported elsewhere is caught
 * here before its content says anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

import type { Signal, SpamCheck, Submission } from "./check.js";

import { SpamCheckError } from "./check.js";

/** The lookup endpoint, which routes each request to the nearest mirror. */
export const STOP_FORUM_SPAM_ENDPOINT = "https://api.stopforumspam.org/api";

/** Milliseconds in a day, for turning `maxAgeDays` into a cutoff. */
const DAY_MS = 86_400_000;

/**
 * One looked-up field. `confidence` and `lastseen` arrive only for a field that appears, and
 * the numbers are coerced because the API has sent some of them as strings.
 */
const FIELD_SCHEMA = s.object({
	appears: coerce.number(),
	frequency: s.optional(coerce.number()),
	confidence: s.optional(coerce.number()),
	lastseen: s.optional(s.string()),
});

/** The answer: `success` is 0 with an `error` when the API refused the query. */
const ANSWER_SCHEMA = s.object({
	success: coerce.number(),
	error: s.optional(s.string()),
	ip: s.optional(FIELD_SCHEMA),
	email: s.optional(FIELD_SCHEMA),
	username: s.optional(FIELD_SCHEMA),
});

/** A field's validated record. */
type FieldRecord = s.InferOutput<typeof FIELD_SCHEMA>;

/** The fields StopForumSpam indexes, named as its query parameters and answer keys. */
type Field = "ip" | "email" | "username";

/**
 * Scores the author's IP, email and name by StopForumSpam reports. A field that appears scores
 * its weight times the API's confidence (0 to 100 percent), a report older than `maxAgeDays`
 * scores nothing, and the total is capped at `maxScore`. Only present fields are sent, and a
 * submission with none of them is answered without a request.
 *
 * @example createSpamFilter({ checks: [...DEFAULT_RULES, stopForumSpam({ maxAgeDays: 30 })] })
 */
export function stopForumSpam(options: stopForumSpam.Options = {}): SpamCheck {
	let endpoint = options.endpoint ?? STOP_FORUM_SPAM_ENDPOINT;
	let weights: Record<Field, number> = {
		ip: options.ipScore ?? 5,
		email: options.emailScore ?? 6,
		username: options.usernameScore ?? 2,
	};
	let maxAgeDays = options.maxAgeDays ?? 90;
	let maxScore = options.maxScore ?? 10;

	return {
		name: "stop-forum-spam",
		stage: "remote",
		async check(submission, { signal }): Promise<Result<Signal[], SpamCheckError>> {
			let fields = queriedFields(submission.author);
			if (fields.size === 0) return success([]);

			let url = new URL(endpoint);
			url.searchParams.set("json", "");
			for (let [field, value] of fields) url.searchParams.set(field, value);

			let body: unknown;
			try {
				let response = await fetch(url, { headers: { Accept: "application/json" }, signal });
				if (!response.ok) {
					return failure(new SpamCheckError("unavailable", `HTTP ${response.status}`));
				}
				body = await response.json().catch(() => undefined);
			} catch (error) {
				return failure(
					new SpamCheckError("unavailable", error instanceof Error ? error.message : String(error)),
				);
			}

			let parsed = s.parseSafe(ANSWER_SCHEMA, body);
			if (!parsed.success) return failure(new SpamCheckError("invalid-response"));
			let answer = parsed.value;
			if (answer.success !== 1) {
				return failure(new SpamCheckError("unavailable", answer.error ?? "the lookup failed"));
			}

			let cutoff = Date.now() - maxAgeDays * DAY_MS;
			let signals: Signal[] = [];
			let total = 0;
			for (let [field, value] of fields) {
				let record = answer[field];
				if (record === undefined || record.appears < 1) continue;
				let seenAt = lastSeen(record);
				if (seenAt !== null && seenAt.getTime() < cutoff) continue;
				let confidence = Math.min(Math.max(record.confidence ?? 100, 0), 100) / 100;
				let score = Math.min(round(weights[field] * confidence), maxScore - total);
				if (score <= 0) continue;
				total += score;
				signals.push({
					check: `stop-forum-spam.${field}`,
					score,
					detail: summarize(field, value, record, seenAt),
				});
			}
			return success(signals);
		},
	};
}

/** The options {@link stopForumSpam} takes. */
export namespace stopForumSpam {
	/** Weights and limits for the StopForumSpam check. */
	export interface Options {
		/**
		 * The API endpoint, for pinning a regional mirror such as `https://europe.stopforumspam.org/api`.
		 *
		 * @default STOP_FORUM_SPAM_ENDPOINT
		 */
		endpoint?: string;
		/**
		 * The score of a reported IP at 100% confidence.
		 *
		 * @default 5
		 */
		ipScore?: number;
		/**
		 * The score of a reported email at 100% confidence; addresses are rarely shared, so a
		 * report says the most about this author.
		 *
		 * @default 6
		 */
		emailScore?: number;
		/**
		 * The score of a reported username at 100% confidence; common names collide across people.
		 *
		 * @default 2
		 */
		usernameScore?: number;
		/**
		 * Days after its last report that a field stops counting, since IPs are reassigned and
		 * cleaned up.
		 *
		 * @default 90
		 */
		maxAgeDays?: number;
		/** @default 10 */
		maxScore?: number;
	}
}

/** The submission's IP, email and name keyed by query parameter, blank values left out. */
function queriedFields(author: Submission.Author | undefined): Map<Field, string> {
	let fields = new Map<Field, string>();
	let values: Array<[Field, string | undefined]> = [
		["ip", author?.ip],
		["email", author?.email],
		["username", author?.name],
	];
	for (let [field, value] of values) {
		let trimmed = value?.trim();
		if (trimmed) fields.set(field, trimmed);
	}
	return fields;
}

/**
 * When a field was last reported. The API writes `YYYY-MM-DD HH:MM:SS` in UTC; an absent or
 * unreadable value is `null`, and such a report counts as current.
 */
function lastSeen(record: FieldRecord): Date | null {
	if (record.lastseen === undefined) return null;
	let date = new Date(`${record.lastseen.trim().replace(" ", "T")}Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Two decimals, so a scaled score reads cleanly in a moderator's explanation. */
function round(score: number): number {
	return Math.round(score * 100) / 100;
}

/** The moderator-facing summary of one report. */
function summarize(field: Field, value: string, record: FieldRecord, seenAt: Date | null): string {
	let parts = [`${field} ${value} reported ${record.frequency ?? record.appears} times`];
	if (seenAt !== null) parts.push(`last on ${seenAt.toISOString().slice(0, 10)}`);
	if (record.confidence !== undefined) parts.push(`${record.confidence}% confidence`);
	return `StopForumSpam: ${parts.join(", ")}`;
}
