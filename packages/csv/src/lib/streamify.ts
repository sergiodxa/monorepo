/**
 * Writes rows as a UTF-8 byte stream while they arrive, for exports too large to hold as
 * one string in a Worker. Rows from a database cursor go out as they are read, in chunks
 * of several records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";

import type { Encoding } from "./encode.js";
import type { CellRecord, Column, StringifyOptions } from "./types.js";

import { BOM, encodeRecord, resolveEncoding } from "./encode.js";
import { headerCells } from "./stringify.js";

/**
 * Characters buffered before a chunk is sent: large enough that a stream of short
 * records is not one chunk per record, small enough to start the download promptly.
 */
const CHUNK_SIZE = 16_384;

/**
 * Writes rows as a stream of UTF-8 bytes with the same text `stringify` returns.
 *
 * `columns` is required, since the header record is sent before any row is read. A bad
 * cell in untyped input errors the stream with a `CSVStringifyError`; rows typed as cells
 * never produce one. Cancelling the stream stops the source iterator.
 *
 * @param rows - A sync or async source of objects whose fields are cells
 * @param options - Writer settings, with the columns to write
 * @returns The CSV as a byte stream, ready for a `Response` body
 * @example new Response(streamify(cursor, { columns: [{ key: "date" }, { key: "uptime" }] }))
 */
export function streamify<Row extends CellRecord<Row>>(
	rows: Iterable<Row> | AsyncIterable<Row>,
	options: StringifyOptions<Row> & { columns: Column<Row>[] },
): ReadableStream<Uint8Array> {
	let encoder = new TextEncoder();
	let keys = options.columns.map((column) => column.key);
	let iterator: Iterator<Row> | AsyncIterator<Row> | undefined;
	let encoding: Encoding | undefined;
	let index = 0;

	return new ReadableStream<Uint8Array>({
		/**
		 * Sends the BOM and header before the first row is read, so a slow source still
		 * starts the download.
		 *
		 * @param controller - The stream's controller
		 */
		start(controller) {
			let resolved = resolveEncoding(options);
			if (isFailure(resolved)) return controller.error(resolved.error);
			encoding = resolved.data;

			let head = encoding.bom ? BOM : "";
			if (options.header ?? true) {
				let header = encodeRecord(headerCells(options.columns), encoding, undefined, keys);
				if (isFailure(header)) return controller.error(header.error);
				head += header.data;
			}
			if (head !== "") controller.enqueue(encoder.encode(head));

			iterator =
				Symbol.asyncIterator in rows
					? rows[Symbol.asyncIterator]()
					: (rows as Iterable<Row>)[Symbol.iterator]();
		},

		/**
		 * Reads rows until a chunk's worth of text is buffered or the source ends.
		 *
		 * @param controller - The stream's controller
		 */
		async pull(controller) {
			if (!encoding || !iterator) return;

			let buffer = "";
			while (buffer.length < CHUNK_SIZE) {
				let next = await iterator.next();
				if (next.done) {
					if (buffer !== "") controller.enqueue(encoder.encode(buffer));
					return controller.close();
				}

				let row = next.value as Record<string, unknown>;
				let record = encodeRecord(
					keys.map((key) => row[key]),
					encoding,
					index,
					keys,
				);
				index += 1;
				if (isFailure(record)) {
					await iterator.return?.();
					return controller.error(record.error);
				}
				buffer += record.data;
			}
			controller.enqueue(encoder.encode(buffer));
		},

		/**
		 * Stops the source when the reader goes away, so a cursor is released.
		 */
		async cancel() {
			await iterator?.return?.();
		},
	});
}
