/**
 * Refresh-token sessions: the device list's per-subject listing, touching on refresh,
 * revocation by subject or subject and client, and the expiry sweep. A session's id **is** the
 * refresh token, so it is a secret and keeps one value for the session's life.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow, NotFound } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { createModel } from "@sdxc/data-model";
import { toMs } from "@sdxc/duration";
import { generateUUID } from "@sdxc/uuid/v4";
import { gt, lte } from "remix/data-table";

import type { SelectClient, SelectSession } from "~/database/schema";

import { sessionClient, sessions } from "~/database/schema";

/** How long a new session — and so the refresh token that is its id — stays valid. */
export const SESSION_TTL = toMs("30 days");

/** A session with the client it was issued to, for the account area's device list. */
export interface SessionWithClient extends SelectSession {
	client: SelectClient | null;
}

export const Sessions = createModel(sessions, {
	optional: ["id", "expires_at", "scope"],

	scopes: {
		/** Sessions whose expiry has passed, which the sweep removes. */
		expired: (query) => query.where(lte("expires_at", Date.now())),
		/** Sessions still inside their expiry. */
		active: (query) => query.where(gt("expires_at", Date.now())),
		/** The sessions one subject holds. */
		ofSubject: (query, subjectId: string) => query.where({ subject_id: subjectId }),
	},

	methods: {
		/**
		 * A subject's sessions with the client each belongs to, most recently used first, the
		 * order the account area's device list shows them in.
		 */
		findBySubjectId(subjectId: string): Promise<SessionWithClient[]> {
			return this.ofSubject(subjectId)
				.orderBy("updated_at", "desc")
				.with({ client: sessionClient })
				.all();
		},

		/**
		 * Revokes one session only when it belongs to the named subject, in one statement, so a
		 * session id submitted against the wrong account matches nothing.
		 *
		 * @returns `1`, or `0` when the id names no session of that subject.
		 */
		async deleteBySubjectAndId(subjectId: string, id: string): Promise<number> {
			return (await this.ofSubject(subjectId).where({ id }).delete()).affectedRows;
		},

		/** Revokes every session a subject has, across all clients, answering how many. */
		async deleteBySubjectId(subjectId: string): Promise<number> {
			return (await this.ofSubject(subjectId).delete()).affectedRows;
		},

		/** Revokes a subject's sessions with one client, as consent withdrawal does. */
		async deleteBySubjectAndClient(subjectId: string, clientId: string): Promise<number> {
			return (await this.ofSubject(subjectId).where({ client_id: clientId }).delete()).affectedRows;
		},

		/**
		 * Deletes every expired session in one statement, which keeps the sweep safe on a
		 * database with no interactive transactions.
		 *
		 * @returns How many sessions were removed.
		 */
		async deleteExpired(): Promise<number> {
			return (await this.expired().delete()).affectedRows;
		},

		/** Records that a session was just used, so the device list reflects real activity. */
		touch(id: string): Promise<Result<SelectSession, ValidationError | NotFound>> {
			return this.update(id, { updated_at: Date.now() });
		},
	},

	callbacks: {
		/**
		 * Gives a new session its id — the refresh token the client will present — and an expiry
		 * {@link SESSION_TTL} out, since the column carries no database default. `scope` is kept
		 * so a refresh reissues tokens as broad as the ones the session started with.
		 */
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				expires_at: values.expires_at ?? Date.now() + SESSION_TTL,
			};
		},
	},
});

/** A refresh-token session, as reads return it. */
export type Session = ModelRow<typeof Sessions>;

export default Sessions;
