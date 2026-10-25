/**
 * The DPoP proofs (RFC 9449) a tenant accepted: the `dpop_proofs` table, claiming a proof
 * once, and the sweep that drops records past the window a proof is acceptable in. Every
 * Worker verifying a proof for this tenant shares it, which makes `jti` single-use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { column as c, inList, lt, table } from "remix/data-table";

/** How many lapsed rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** One accepted proof, kept until it could no longer be accepted anyway. */
export const dpopProofs = table({
	name: "dpop_proofs",
	primaryKey: ["key"],
	columns: {
		key: c.text(),
		expires_at: c.integer(),
	},
});

export interface ClaimDPoPProofInput {
	/** The proof's key thumbprint and `jti`, together. */
	key: string;
	/** When the proof stops being acceptable, in milliseconds since the epoch. */
	expiresAt: number;
	now: number;
}

let ClaimDPoPProofSchema = s.object({
	key: s.string(),
	expiresAt: s.number(),
	now: s.number(),
});

/**
 * Records a proof, answering whether it was new. A record past its expiry is replaced,
 * so a key is refused only while the proof it names could still be accepted. The read
 * and the write run in one Durable Object turn, so two claims of one key cannot both win.
 *
 * @param db - The tenant's database.
 * @param input - The proof's key, when it lapses, and the clock.
 * @returns `true` the first time a key is claimed inside its window, `false` after.
 */
export async function claimDPoPProof(db: Database, input: ClaimDPoPProofInput): Promise<boolean> {
	let parsed = s.parse(ClaimDPoPProofSchema, input);

	let existing = await db.find(dpopProofs, { key: parsed.key });
	if (existing !== null && existing.expires_at > parsed.now) return false;

	if (existing !== null) await db.delete(dpopProofs, { key: parsed.key });
	await db.create(dpopProofs, { key: parsed.key, expires_at: parsed.expiresAt });

	return true;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredDPoPProofsResult {
	deleted: number;
	more: boolean;
}

/**
 * Deletes lapsed proof records in one bounded batch, for the daily retention alarm.
 *
 * @param db - The tenant's database.
 * @param now - The clock to sweep against.
 * @returns How many rows this call deleted, and whether the batch was full.
 */
export async function sweepExpiredDPoPProofs(
	db: Database,
	now: number = Date.now(),
): Promise<SweepExpiredDPoPProofsResult> {
	let batch = await db.findMany(dpopProofs, {
		where: lt("expires_at", now),
		limit: SWEEP_BATCH_SIZE,
	});
	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(dpopProofs, {
		where: inList(
			"key",
			batch.map((row) => row.key),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === SWEEP_BATCH_SIZE };
}
