/**
 * The R2 plumbing a subject import or export run writes and reads its NDJSON
 * files through, and the single-use ticket a management API download route
 * later exchanges for one of those files: {@link writeTransferFile} and
 * {@link readTransferFileLines} adapt the `R2Bucket` binding's byte-oriented
 * API to the line-oriented one a batching job wants, and
 * {@link mintTransferDownloadTicket}/{@link spendTransferDownloadTicket} carry
 * a run's finished object to a download link, following the same
 * delete-then-check-expiry idiom `pending_link_tickets` and
 * `password_reset_tickets` already use.
 *
 * The ticket table lives at the control-plane level rather than inside a
 * tenant's own object, matching where the run that names it —
 * `tenant_import_runs` — is itself tracked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID, generateUUIDv7 } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/**
 * How long a download ticket names its object before it expires — the 24
 * hours a run's own signed download link is documented to stay valid for.
 */
const TRANSFER_DOWNLOAD_TICKET_TTL_MS = 24 * 60 * 60 * 1000;

/** Mints a `trtkt` id for a new `transfer_download_tickets` row. */
const transferDownloadTicketId = typeid("trtkt");

/**
 * A single-use, hashed ticket naming the R2 key and tenant of one transfer
 * run's finished object, minted once and spent by a download route that
 * never sees the object's real key until the ticket proves it.
 */
export const transferDownloadTickets = table({
	name: "transfer_download_tickets",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		ticket_hash: c.text(),
		tenant_id: c.text(),
		r2_key: c.text(),
		expires_at: c.integer(),
		created_at: c.integer(),
	},
});

export type TransferDownloadTicketRow = TableRow<typeof transferDownloadTickets>;

/**
 * Adapts an `AsyncIterable<string>` of NDJSON lines into the `ReadableStream`
 * `R2Bucket.put` writes from, so a caller that produces rows one at a time
 * never has to buffer the whole file in memory to hand it to R2.
 */
function toLineStream(lines: AsyncIterable<string>): ReadableStream<Uint8Array> {
	let encoder = new TextEncoder();
	let iterator = lines[Symbol.asyncIterator]();

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			let next = await iterator.next();

			if (next.done) {
				controller.close();
				return;
			}

			controller.enqueue(encoder.encode(`${next.value}\n`));
		},

		async cancel(reason) {
			await iterator.return?.(reason);
		},
	});
}

/**
 * Writes NDJSON to R2, one line per element of `lines`, each newline-terminated
 * as it is written rather than joined in memory first. A caller already
 * holding a `ReadableStream` of properly newline-delimited bytes may pass that
 * directly instead.
 *
 * @param bucket - The R2 bucket a transfer run's files live in.
 * @param key - The object key to write.
 * @param lines - NDJSON rows to write, one per element, or a pre-built stream.
 * @example
 * await writeTransferFile(env.R2, "exports/acme/subjects.ndjson", rows);
 */
export async function writeTransferFile(
	bucket: R2Bucket,
	key: string,
	lines: AsyncIterable<string> | ReadableStream,
): Promise<void> {
	let stream = lines instanceof ReadableStream ? lines : toLineStream(lines);
	await bucket.put(key, stream);
}

/** Options narrowing where {@link readTransferFileLines} starts yielding. */
export interface ReadTransferFileLinesOptions {
	/**
	 * How many rows to skip before the first one yielded, matching a run's
	 * own `cursor`. Skipped by reading and discarding from the start of the
	 * object rather than by a ranged read: a batching job reads 200 rows at a
	 * tick, and tracking the byte offset each row starts at would mean the
	 * writer recording an index alongside the file it writes, for a cost that
	 * only shows up once a resuming file is very large. Left as the simpler
	 * of the two for now — a known inefficiency on a large file near the end
	 * of its run, where most of a tick's work is bytes read only to be
	 * thrown away.
	 */
	startLine?: number;
}

/**
 * Reads an NDJSON object back one line at a time, the reverse of
 * {@link writeTransferFile}, optionally skipping past rows a previous tick
 * already consumed.
 *
 * @param bucket - The R2 bucket the object lives in.
 * @param key - The object key to read.
 * @param options - How many leading rows to skip.
 * @returns An async iterable of the object's NDJSON lines, in order.
 * @throws When no object exists at `key`.
 * @example
 * for await (let line of readTransferFileLines(env.R2, sourceKey, { startLine: cursor })) {
 *   let row = JSON.parse(line);
 * }
 */
export async function* readTransferFileLines(
	bucket: R2Bucket,
	key: string,
	options?: ReadTransferFileLinesOptions,
): AsyncGenerator<string> {
	let object = await bucket.get(key);
	if (!object) throw new Error(`transfer file not found: ${key}`);

	let toSkip = options?.startLine ?? 0;
	let skipped = 0;
	let buffer = "";
	let decoder = new TextDecoder();
	let reader = object.body.getReader();

	try {
		while (true) {
			let { done, value } = await reader.read();
			if (value) buffer += decoder.decode(value, { stream: true });

			let newlineIndex = buffer.indexOf("\n");
			while (newlineIndex !== -1) {
				let line = buffer.slice(0, newlineIndex);
				buffer = buffer.slice(newlineIndex + 1);

				if (line.length > 0) {
					if (skipped < toSkip) skipped += 1;
					else yield line;
				}

				newlineIndex = buffer.indexOf("\n");
			}

			if (done) break;
		}

		buffer += decoder.decode();
		if (buffer.length > 0 && skipped >= toSkip) yield buffer;
	} finally {
		reader.releaseLock();
	}
}

/** What {@link mintTransferDownloadTicket} needs to name a downloadable object. */
export interface MintTransferDownloadTicketInput {
	r2Key: string;
	tenantId: string;
	/** Overrides the default 24-hour lifetime, for a caller that wants a shorter one. */
	expiresInMs?: number;
}

/**
 * Mints a single-use ticket naming the R2 key and tenant of a finished
 * transfer object, storing only the ticket's hash.
 *
 * @param db - The control-plane database.
 * @param input - The object's key and owning tenant, and an optional TTL override.
 * @returns The plaintext ticket to hand back as a download link.
 * @example
 * let ticket = await mintTransferDownloadTicket(db, { r2Key, tenantId });
 */
export async function mintTransferDownloadTicket(
	db: Database,
	input: MintTransferDownloadTicketInput,
): Promise<string> {
	let ticket = generateUUID();

	let hashed = await sha256(ticket);
	if (isFailure(hashed)) throw new Error("failed to hash the transfer download ticket");

	let now = Date.now();

	await db.create(transferDownloadTickets, {
		id: transferDownloadTicketId(generateUUIDv7()).toString(),
		ticket_hash: Hex.encode(hashed.data),
		tenant_id: input.tenantId,
		r2_key: input.r2Key,
		expires_at: now + (input.expiresInMs ?? TRANSFER_DOWNLOAD_TICKET_TTL_MS),
		created_at: now,
	});

	return ticket;
}

export type SpendTransferDownloadTicketResult =
	| { ok: true; r2Key: string; tenantId: string }
	| { ok: false; reason: "invalid-ticket" };

/**
 * Spends a download ticket: deleted the moment its row is found, before its
 * expiry is even checked, so a replayed spend always finds nothing left to
 * take — the same rule a password reset ticket answers a second attempt with.
 *
 * @param db - The control-plane database.
 * @param input - The ticket as it was presented.
 * @returns The object it named, or that it does not work.
 * @example
 * let spent = await spendTransferDownloadTicket(db, { ticket });
 */
export async function spendTransferDownloadTicket(
	db: Database,
	input: { ticket: string },
): Promise<SpendTransferDownloadTicketResult> {
	let hashed = await sha256(input.ticket);
	if (isFailure(hashed)) return { ok: false, reason: "invalid-ticket" };

	let row = await db.findOne(transferDownloadTickets, {
		where: { ticket_hash: Hex.encode(hashed.data) },
	});
	if (!row) return { ok: false, reason: "invalid-ticket" };

	await db.delete(transferDownloadTickets, { id: row.id });

	if (row.expires_at <= Date.now()) return { ok: false, reason: "invalid-ticket" };

	return { ok: true, r2Key: row.r2_key, tenantId: row.tenant_id };
}
