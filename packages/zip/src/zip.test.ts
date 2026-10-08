/**
 * Writes archives with the package and reads them back with independent readers — fflate,
 * and Info-ZIP's `unzip -t` where it is installed — then walks the raw records to confirm
 * every entry is stored with its sizes in the local header and bit 3 clear.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import { unzipSync } from "fflate";
import { describe, expect, test } from "vitest";

import { crc32 } from "./crc32.js";
import { Zip, ZipError } from "./zip.js";

/** Whether Info-ZIP's `unzip` is on this machine's PATH. */
const HAS_UNZIP = (() => {
	try {
		execFileSync("unzip", ["-v"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
})();

/** The archive's bytes, failing the test when writing failed. */
async function archive(zip: Zip): Promise<Uint8Array> {
	let result = await zip.bytes();
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** A stream that yields the chunks given, one per pull. */
function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			let chunk = chunks.shift();
			if (chunk) controller.enqueue(chunk);
			else controller.close();
		},
	});
}

/** The fields of every local file header, read in order from the start of the archive. */
function localHeaders(bytes: Uint8Array) {
	let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let headers = [];
	let offset = 0;
	while (view.getUint32(offset, true) === 0x04034b50) {
		let size = view.getUint32(offset + 18, true);
		let nameLength = view.getUint16(offset + 26, true);
		let extraLength = view.getUint16(offset + 28, true);
		headers.push({
			flags: view.getUint16(offset + 6, true),
			method: view.getUint16(offset + 8, true),
			crc: view.getUint32(offset + 14, true),
			compressed: size,
			size: view.getUint32(offset + 22, true),
			extraLength,
			name: new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength)),
		});
		offset += 30 + nameLength + extraLength + size;
	}
	return headers;
}

let encode = (text: string) => new TextEncoder().encode(text);

describe("Zip", () => {
	test("writes strings, bytes and streams that fflate reads back", async () => {
		let zip = new Zip();
		zip.add("README.txt", "Exported on 2026-10-08\n");
		zip.add("images/pixel.bin", new Uint8Array([0, 1, 2, 255]));
		zip.add("reports/daily.csv", streamOf(encode("a,b\n"), encode("1,2\n")));
		zip.add("empty.txt", "");
		zip.add("ünïcode/日本.txt", "héllo");

		let files = unzipSync(await archive(zip));

		expect(Object.keys(files)).toEqual([
			"README.txt",
			"images/pixel.bin",
			"reports/daily.csv",
			"empty.txt",
			"ünïcode/日本.txt",
		]);
		expect(new TextDecoder().decode(files["README.txt"])).toBe("Exported on 2026-10-08\n");
		expect(files["images/pixel.bin"]).toEqual(new Uint8Array([0, 1, 2, 255]));
		expect(new TextDecoder().decode(files["reports/daily.csv"])).toBe("a,b\n1,2\n");
		expect(files["empty.txt"]).toEqual(new Uint8Array());
		expect(new TextDecoder().decode(files["ünïcode/日本.txt"])).toBe("héllo");
	});

	test("stores every entry with its CRC and sizes in the local header and bit 3 clear", async () => {
		let zip = new Zip();
		zip.add("mimetype", "application/epub+zip");
		zip.add("streamed.txt", streamOf(encode("one"), encode("two")));

		let headers = localHeaders(await archive(zip));

		expect(headers.map((header) => header.name)).toEqual(["mimetype", "streamed.txt"]);
		for (let header of headers) {
			expect(header.method).toBe(0);
			expect(header.flags & 0x0008).toBe(0);
			expect(header.flags & 0x0800).toBe(0x0800);
			expect(header.extraLength).toBe(0);
			expect(header.compressed).toBe(header.size);
		}
		expect(headers[0]).toMatchObject({ size: 20, crc: crc32(encode("application/epub+zip")) });
		expect(headers[1]).toMatchObject({ size: 6, crc: crc32(encode("onetwo")) });
	});

	test("writes the mimetype bytes at offset 30, where EPUB readers sniff them", async () => {
		let zip = new Zip();
		zip.add("mimetype", "application/epub+zip");
		let bytes = await archive(zip);
		expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe("mimetype");
		expect(new TextDecoder().decode(bytes.subarray(38, 58))).toBe("application/epub+zip");
	});

	test("chunked streams produce the same bytes as the equivalent buffer", async () => {
		let whole = new Zip();
		whole.add("data.txt", encode("abcdefghij"));
		let chunked = new Zip();
		chunked.add("data.txt", streamOf(encode("abc"), encode("defg"), encode("hij")));

		expect(await archive(chunked)).toEqual(await archive(whole));
	});

	test("writes the same bytes for the same entries", async () => {
		let build = () => {
			let zip = new Zip();
			zip.add("a.txt", "a", { modified: new Date("2026-10-08T12:34:56Z"), comment: "first" });
			zip.add("b.txt", "b");
			return zip;
		};
		expect(await archive(build())).toEqual(await archive(build()));
	});

	test("records the modified time in UTC and the comment in the central directory", async () => {
		let zip = new Zip();
		zip.add("a.txt", "a", { modified: new Date("2026-10-08T12:34:56Z"), comment: "first" });
		let bytes = await archive(zip);
		let view = new DataView(bytes.buffer);

		expect(view.getUint16(10, true)).toBe((12 << 11) | (34 << 5) | 28);
		expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 8);
		expect(new TextDecoder().decode(bytes)).toContain("first");
	});

	test("writes an empty archive as the end record alone", async () => {
		let bytes = await archive(new Zip());
		expect(bytes.length).toBe(22);
		expect(unzipSync(bytes)).toEqual({});
	});

	test.skipIf(!HAS_UNZIP)("passes Info-ZIP's integrity test", async () => {
		let zip = new Zip();
		zip.add("mimetype", "application/epub+zip");
		zip.add("dir/a.txt", "hello", { comment: "a comment" });
		zip.add("dir/b.bin", streamOf(new Uint8Array(70_000).fill(7)));

		let directory = mkdtempSync(join(tmpdir(), "sdxc-zip-"));
		try {
			let file = join(directory, "test.zip");
			writeFileSync(file, await archive(zip));
			let output = execFileSync("unzip", ["-t", file], { encoding: "utf8" });
			expect(output).toContain("No errors detected");
			let listing = execFileSync("zipinfo", [file], { encoding: "utf8" });
			expect(listing).toMatch(/stor.*mimetype/);
			expect(listing).not.toMatch(/defN/);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	describe("names", () => {
		test.each([
			["", "empty"],
			["/etc/passwd", "leading slash"],
			["a\\b.txt", "backslash"],
			["a//b.txt", "empty segment"],
			["dir/", "trailing slash"],
			["./a.txt", "dot segment"],
			["../a.txt", "dot-dot segment"],
			["a/../../b", "traversal"],
			["a\u0000b", "control character"],
		])("refuses %j (%s) with invalid-entry", (name) => {
			let added = new Zip().add(name, "x");
			expect(isFailure(added) && added.error.code).toBe("invalid-entry");
		});

		test("refuses a duplicate and keeps the first entry", async () => {
			let zip = new Zip();
			expect(isSuccess(zip.add("a.txt", "first"))).toBe(true);
			let duplicate = zip.add("a.txt", "second");
			expect(isFailure(duplicate) && duplicate.error).toMatchObject({
				code: "invalid-entry",
				entry: "a.txt",
			});
			let files = unzipSync(await archive(zip));
			expect(new TextDecoder().decode(files["a.txt"])).toBe("first");
		});

		test("refuses a modified date DOS cannot record", () => {
			let zip = new Zip();
			for (let modified of [new Date("1979-12-31T00:00:00Z"), new Date("nope")]) {
				let added = zip.add("a.txt", "x", { modified });
				expect(isFailure(added) && added.error.code).toBe("invalid-entry");
			}
		});
	});

	test("refuses the 65,536th entry with too-large", () => {
		let zip = new Zip();
		let empty = new Uint8Array();
		for (let index = 0; index < 65_535; index++) {
			expect(isSuccess(zip.add(`f${index}`, empty))).toBe(true);
		}
		let added = zip.add("one-too-many", empty);
		expect(isFailure(added) && added.error.code).toBe("too-large");
	});

	describe("a source that fails", () => {
		test("errors the output stream with source-failed carrying the cause", async () => {
			let cause = new Error("database went away");
			let zip = new Zip();
			zip.add("first.txt", "fine");
			zip.add(
				"broken.csv",
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encode("a,b\n"));
						controller.error(cause);
					},
				}),
			);

			let result = await zip.bytes();

			expect(isFailure(result) && result.error).toBeInstanceOf(ZipError);
			expect(isFailure(result) && result.error).toMatchObject({
				code: "source-failed",
				entry: "broken.csv",
				cause,
			});
		});

		test("errors the stream when a chunk is not bytes", async () => {
			let zip = new Zip();
			zip.add(
				"text.txt",
				new ReadableStream<string>({
					start(controller) {
						controller.enqueue("not bytes");
						controller.close();
					},
				}) as unknown as ReadableStream<Uint8Array>,
			);
			let result = await zip.bytes();
			expect(isFailure(result) && result.error.code).toBe("source-failed");
		});

		test("cancels the stream sources it never reached", async () => {
			let cancelled: unknown[] = [];
			let zip = new Zip();
			zip.add(
				"broken.txt",
				new ReadableStream<Uint8Array>({
					pull(controller) {
						controller.error(new Error("boom"));
					},
				}),
			);
			zip.add(
				"later.txt",
				new ReadableStream<Uint8Array>({
					cancel(reason) {
						cancelled.push(reason);
					},
				}),
			);

			await zip.bytes();

			expect(cancelled).toHaveLength(1);
			expect(cancelled[0]).toBeInstanceOf(ZipError);
		});
	});

	test("cancelling the output cancels the pending stream sources", async () => {
		let cancelled = false;
		let zip = new Zip();
		zip.add("first.txt", "fine");
		zip.add(
			"later.txt",
			new ReadableStream<Uint8Array>({
				cancel() {
					cancelled = true;
				},
			}),
		);

		let reader = zip.stream().getReader();
		await reader.read();
		await reader.cancel("client went away");

		expect(cancelled).toBe(true);
	});
});
