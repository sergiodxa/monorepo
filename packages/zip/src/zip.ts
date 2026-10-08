/**
 * A streaming ZIP writer: entries are added from strings, bytes or streams, then written in
 * order as one `ReadableStream`, so a Worker answers a multi-file download without holding
 * the archive. Every entry is stored, with its CRC-32 and sizes in the local header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { WrittenRecord } from "./headers.js";

import { crc32 } from "./crc32.js";
import {
	centralHeader,
	dosDateTime,
	endOfCentralDirectory,
	localHeader,
	MAX_32,
	MAX_ENTRIES,
} from "./headers.js";

/** What an entry's content may be; a string is written as UTF-8. */
export type ZipSource = string | Uint8Array | ReadableStream<Uint8Array>;

/** Per-entry choices for {@link Zip.add}. */
export interface ZipEntryOptions {
	/**
	 * The entry's timestamp. The fixed default makes the same entries produce the same bytes.
	 *
	 * @default new Date("1980-01-01T00:00:00Z")
	 */
	modified?: Date;
	/** A comment unarchivers show beside the entry, written in the central directory. */
	comment?: string;
}

/**
 * Why an entry was refused or the archive could not be written. `add` answers it as a
 * `Result`; while streaming, it is the error the output stream fails with.
 */
export class ZipError extends Error {
	override name = "ZipError";

	/**
	 * @param code - What went wrong
	 * @param message - A description for logs
	 * @param entry - The entry name it concerns
	 * @param options - The underlying error, as `cause`
	 */
	constructor(
		readonly code: ZipError.Code,
		message: string,
		readonly entry?: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

/** The types {@link ZipError} carries. */
export namespace ZipError {
	/**
	 * `invalid-entry` for a name, timestamp or comment ZIP cannot record; `too-large` past the
	 * 4 GiB or 65,535-entry limits of an archive without ZIP64; `source-failed` when an entry's
	 * stream errors or yields something other than bytes.
	 */
	export type Code = "invalid-entry" | "too-large" | "source-failed";
}

/** One added entry, waiting for `stream()` to write it. */
interface PendingEntry {
	path: string;
	name: Uint8Array;
	comment: Uint8Array;
	time: number;
	date: number;
	source: Uint8Array | ReadableStream<Uint8Array>;
}

/** The DOS timestamp of 1980-01-01 00:00:00, the earliest DOS dates record. */
const DEFAULT_MODIFIED = new Date(Date.UTC(1980, 0, 1));

/**
 * A ZIP archive being assembled. Entries are written in the order they were added, each one
 * stored uncompressed, so the output opens in every unarchiver and satisfies the EPUB rule
 * for its `mimetype` entry.
 *
 * @example let zip = new Zip(); zip.add("a.csv", csv); return new Response(zip.stream())
 */
export class Zip {
	#entries: PendingEntry[] = [];
	#paths = new Set<string>();

	/**
	 * Add an entry. The name is checked here, so a refused entry leaves the archive unchanged.
	 * A stream source is read when `stream()` reaches it, once, so an archive holding one is
	 * written once.
	 *
	 * @param path - A `/`-separated relative path such as `reports/daily.csv`
	 * @param source - The content: text (written as UTF-8), bytes, or a stream of bytes
	 * @param options - Timestamp and comment
	 * @returns `invalid-entry` for a name ZIP or a safe extractor refuses, a duplicate, a date outside 1980–2107 or a field past 64 KiB; `too-large` for the 65,536th entry or bytes past 4 GiB
	 * @example zip.add("README.txt", "Exported on 2026-10-08\n")
	 * @example zip.add("images/a.png", bytes, { modified: new Date("2026-10-01T00:00:00Z") })
	 */
	add(path: string, source: ZipSource, options: ZipEntryOptions = {}): Result<void, ZipError> {
		let problem = pathProblem(path);
		if (problem) return failure(new ZipError("invalid-entry", problem, path));
		if (this.#paths.has(path)) {
			return failure(new ZipError("invalid-entry", `"${path}" was already added`, path));
		}
		if (this.#entries.length >= MAX_ENTRIES) {
			return failure(
				new ZipError("too-large", `An archive holds at most ${MAX_ENTRIES} entries`, path),
			);
		}

		let stamp = dosDateTime(options.modified ?? DEFAULT_MODIFIED);
		if (!stamp) {
			return failure(
				new ZipError("invalid-entry", "modified must be a valid date in 1980–2107", path),
			);
		}

		let encoder = new TextEncoder();
		let name = encoder.encode(path);
		let comment = encoder.encode(options.comment ?? "");
		if (name.length > 0xffff || comment.length > 0xffff) {
			return failure(
				new ZipError("invalid-entry", "A name or comment is limited to 65,535 bytes", path),
			);
		}

		let content = typeof source === "string" ? encoder.encode(source) : source;
		if (content instanceof Uint8Array && content.length > MAX_32) {
			return failure(new ZipError("too-large", "An entry is limited to 4 GiB", path));
		}

		this.#paths.add(path);
		this.#entries.push({ path, name, comment, ...stamp, source: content });
		return success(undefined);
	}

	/**
	 * Write the archive: each entry's header and data in the order added, then the central
	 * directory. A stream entry is read whole before its header, so memory holds one entry at
	 * a time. The stream fails with a `ZipError` when a source errors or a limit is passed.
	 *
	 * @returns The archive's bytes, `application/zip`
	 */
	stream(): ReadableStream<Uint8Array> {
		let pending = [...this.#entries];
		let written: WrittenRecord[] = [];
		let offset = 0;
		let index = 0;

		return new ReadableStream<Uint8Array>({
			async pull(controller) {
				let entry = pending[index++];
				if (!entry) {
					let directory = centralDirectory(written, offset);
					if (directory.status === "failure") return controller.error(directory.error);
					controller.enqueue(directory.data);
					return controller.close();
				}

				let data = await readSource(entry);
				if (data.status === "failure") {
					await cancelSources(pending.slice(index), data.error);
					return controller.error(data.error);
				}
				if (offset > MAX_32) {
					await cancelSources(pending.slice(index), undefined);
					return controller.error(
						new ZipError("too-large", "The archive passed 4 GiB", entry.path),
					);
				}

				let record = { ...entry, crc: crc32(data.data), size: data.data.length };
				let header = localHeader(record);
				controller.enqueue(header);
				if (data.data.length > 0) controller.enqueue(data.data);
				written.push({ ...record, offset });
				offset += header.length + data.data.length;
			},

			async cancel(reason) {
				await cancelSources(pending.slice(index), reason);
			},
		});
	}

	/**
	 * Write the archive into one buffer, for a test, a stored object, or a caller that needs
	 * the length up front.
	 *
	 * @returns The archive, or the `ZipError` the stream failed with
	 */
	async bytes(): Promise<Result<Uint8Array, ZipError>> {
		let reader = this.stream().getReader();
		let chunks: Uint8Array[] = [];
		try {
			for (;;) {
				let chunk = await reader.read();
				if (chunk.done) return success(concat(chunks));
				chunks.push(chunk.value);
			}
		} catch (error) {
			if (error instanceof ZipError) return failure(error);
			return failure(
				new ZipError("source-failed", "The archive could not be written", undefined, {
					cause: error,
				}),
			);
		}
	}
}

/**
 * Names the first rule a path breaks: empty, absolute, a backslash, an empty, `.` or `..`
 * segment, or a control character. Each of those either breaks the format or lets an
 * extractor write outside the folder it extracts into.
 */
function pathProblem(path: string): string | undefined {
	if (path.length === 0) return "An entry name is empty";
	if (path.startsWith("/")) return `"${path}" starts with "/"`;
	if (path.includes("\\")) return `"${path}" contains a backslash; separate segments with "/"`;
	// oxlint-disable-next-line no-control-regex -- control characters are what this rejects
	if (/[\u0000-\u001f\u007f]/u.test(path)) return `"${path}" contains a control character`;
	for (let segment of path.split("/")) {
		if (segment === "" || segment === "." || segment === "..") {
			return `"${path}" has an empty, "." or ".." segment`;
		}
	}
	return undefined;
}

/** Reads an entry's content into one buffer, so its CRC-32 and size precede the data. */
async function readSource(entry: PendingEntry): Promise<Result<Uint8Array, ZipError>> {
	if (entry.source instanceof Uint8Array) return success(entry.source);

	let reader: ReadableStreamDefaultReader<Uint8Array>;
	try {
		reader = entry.source.getReader();
	} catch (error) {
		return failure(sourceFailed(entry.path, error));
	}

	let chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			let { done, value } = await reader.read();
			if (done) return success(concat(chunks, size));
			if (!(value instanceof Uint8Array)) {
				await reader.cancel();
				return failure(
					new ZipError(
						"source-failed",
						`"${entry.path}" yielded a chunk that is not bytes`,
						entry.path,
					),
				);
			}
			size += value.length;
			if (size > MAX_32) {
				await reader.cancel();
				return failure(new ZipError("too-large", "An entry is limited to 4 GiB", entry.path));
			}
			chunks.push(value);
		}
	} catch (error) {
		return failure(sourceFailed(entry.path, error));
	}
}

/** The error for a source stream that failed while being read, carrying its error as `cause`. */
function sourceFailed(path: string, cause: unknown): ZipError {
	return new ZipError("source-failed", `Reading "${path}" failed`, path, { cause });
}

/**
 * Releases the stream sources an archive will never reach, so the work producing them stops
 * when the archive fails or its reader goes away.
 */
async function cancelSources(entries: readonly PendingEntry[], reason: unknown): Promise<void> {
	for (let entry of entries) {
		if (entry.source instanceof ReadableStream && !entry.source.locked) {
			await entry.source.cancel(reason).catch(() => undefined);
		}
	}
}

/** The central directory and its end record, checked against the 32-bit offset limit. */
function centralDirectory(
	written: readonly WrittenRecord[],
	offset: number,
): Result<Uint8Array, ZipError> {
	let headers = written.map(centralHeader);
	let size = headers.reduce((total, header) => total + header.length, 0);
	if (offset > MAX_32 || size > MAX_32) {
		return failure(new ZipError("too-large", "The archive passed 4 GiB"));
	}
	return success(concat([...headers, endOfCentralDirectory(written.length, size, offset)]));
}

/** Joins chunks into one buffer; one chunk is answered as it is. */
function concat(chunks: readonly Uint8Array[], size?: number): Uint8Array {
	if (chunks.length === 1 && chunks[0]) return chunks[0];
	let bytes = new Uint8Array(size ?? chunks.reduce((total, chunk) => total + chunk.length, 0));
	let position = 0;
	for (let chunk of chunks) {
		bytes.set(chunk, position);
		position += chunk.length;
	}
	return bytes;
}
