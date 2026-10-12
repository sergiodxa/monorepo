/**
 * The send envelope shared by every operation that mints a ticket to mail somewhere:
 * up to 5 sends an hour and 15 a day, per address, counted together regardless of
 * which kind of ticket triggered them. Lives above `subjects.ts` and `passwords.ts`
 * rather than inside either — both already import from the other's neighborhood, so
 * a shared check either one called would import itself back; this module imports
 * from neither and reads only its own table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** How many sends one address may spend inside its current hourly window. */
const HOURLY_LIMIT = 5;

/** How many sends one address may spend inside its current daily window. */
const DAILY_LIMIT = 15;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** One address's running counts against the hourly and daily caps, each its own fixed window. */
export const mailSendEnvelopes = table({
	name: "mail_send_envelopes",
	primaryKey: ["address"],
	columns: {
		address: c.text(),
		hour_window_start: c.integer(),
		hour_count: c.integer(),
		day_window_start: c.integer(),
		day_count: c.integer(),
	},
});

export type MailSendEnvelopeRow = TableRow<typeof mailSendEnvelopes>;

export type CheckAndSpendMailEnvelopeResult =
	| { ok: true }
	| { ok: false; retryAfterSeconds: number };

export interface CheckAndSpendMailEnvelopeInput {
	/** The address the send is for, already folded/normalized by the caller. */
	address: string;
	/** The clock the windows are measured against. */
	now?: number;
}

/**
 * Checks and spends one send against an address's shared envelope: a window whose
 * hour or day has elapsed resets its count before either cap is compared, so the
 * refusal a stale window would otherwise cause never happens, and a spend that
 * clears both caps is written in the same call that decided it may.
 *
 * @param db - The tenant's database.
 * @param input - The address to spend against, and the clock to measure against.
 * @returns Success, once the spend is recorded, or how many seconds until the
 * tighter of the two caps next has room.
 */
export async function checkAndSpendMailEnvelope(
	db: Database,
	input: CheckAndSpendMailEnvelopeInput,
): Promise<CheckAndSpendMailEnvelopeResult> {
	let now = input.now ?? Date.now();
	let row = await db.find(mailSendEnvelopes, { address: input.address });

	let hourWindowStart = row?.hour_window_start ?? now;
	let hourCount = row?.hour_count ?? 0;
	let dayWindowStart = row?.day_window_start ?? now;
	let dayCount = row?.day_count ?? 0;

	if (now - hourWindowStart >= HOUR_MS) {
		hourWindowStart = now;
		hourCount = 0;
	}

	if (now - dayWindowStart >= DAY_MS) {
		dayWindowStart = now;
		dayCount = 0;
	}

	if (hourCount >= HOURLY_LIMIT) {
		return { ok: false, retryAfterSeconds: Math.ceil((hourWindowStart + HOUR_MS - now) / 1000) };
	}

	if (dayCount >= DAILY_LIMIT) {
		return { ok: false, retryAfterSeconds: Math.ceil((dayWindowStart + DAY_MS - now) / 1000) };
	}

	let spent = {
		hour_window_start: hourWindowStart,
		hour_count: hourCount + 1,
		day_window_start: dayWindowStart,
		day_count: dayCount + 1,
	};

	if (row) {
		await db.update(mailSendEnvelopes, { address: input.address }, spent);
	} else {
		await db.create(mailSendEnvelopes, { address: input.address, ...spent });
	}

	return { ok: true };
}
