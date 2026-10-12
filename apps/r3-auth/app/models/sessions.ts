/**
 * Refresh-token sessions: the device list's per-subject listing, refresh-token issue and lookup,
 * touching on refresh, revocation, and the expiry sweep. A session's id is a public identifier
 * relying parties see as `sid`; the refresh token lives only as its SHA-256 hash.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow, NotFound } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { createModel } from "@sdxc/data-model";
import { toMs } from "@sdxc/duration";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";
import { gt, lte } from "remix/data-table";

import type { SelectClient, SelectSession } from "~/database/schema";

import { sessionClient, sessions } from "~/database/schema";

/** How long a new session — and so the refresh token issued on it — stays valid. */
export const SESSION_TTL = toMs("30 days");

/** A session with the client it was issued to, for the account area's device list. */
export interface SessionWithClient extends SelectSession {
	client: SelectClient | null;
}

/**
 * The stored form of a refresh token: its lowercase hex SHA-256. A 256-bit random token needs
 * no salt or stretching, and the digest is deterministic, so a presented token finds its row
 * by equality while a database read yields nothing a client could present.
 */
export async function hashRefreshToken(token: string): Promise<string> {
	return Hex.encode(unwrap(await sha256(token)));
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
		 * Resolves a presented refresh token to its session by the token's hash.
		 *
		 * @returns The session, or `null` when no session holds the token.
		 */
		async findByRefreshToken(token: string): Promise<SelectSession | null> {
			let hash = await hashRefreshToken(token);
			return await this.query().where({ refresh_token_hash: hash }).first();
		},

		/**
		 * Mints the refresh token for a session and stores only its hash, so the returned
		 * plaintext is the one copy that exists. Issuing again replaces the earlier token.
		 *
		 * @returns The refresh token, or `null` when the session no longer exists.
		 */
		async issueRefreshToken(id: string): Promise<string | null> {
			let token = randomToken();
			let hash = await hashRefreshToken(token);
			let updated = await this.query().where({ id }).update({ refresh_token_hash: hash });
			return updated.affectedRows === 0 ? null : token;
		},

		/** Revokes the session a refresh token belongs to, answering how many rows went. */
		async deleteByRefreshToken(token: string): Promise<number> {
			let session = await this.findByRefreshToken(token);
			if (!session) return 0;
			return (await this.query().where({ id: session.id }).delete()).affectedRows;
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

		/**
		 * Records that a session was just used, so the device list reflects real activity: an
		 * update with no values moves only `updated_at`, stamped by the database clock.
		 */
		touch(id: string): Promise<Result<SelectSession, ValidationError | NotFound>> {
			return this.update(id, {});
		},
	},

	callbacks: {
		/**
		 * Gives a new session its public id and an expiry {@link SESSION_TTL} out, since the
		 * column carries no database default. `scope` is kept so a refresh reissues tokens as
		 * broad as the ones the session started with.
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
