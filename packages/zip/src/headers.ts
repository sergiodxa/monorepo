/**
 * The three ZIP records the writer emits — local file header, central directory header and
 * end of central directory — laid out byte for byte from PKWARE's APPNOTE for stored entries
 * whose CRC-32 and sizes are known before their data, so no record carries a data descriptor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The largest size or offset a 32-bit field records; `0xFFFFFFFF` itself tells a reader to
 * look for ZIP64 fields, which this writer leaves out.
 */
export const MAX_32 = 0xfffffffe;

/** The most entries a 16-bit count records; ZIP64 is what goes past it. */
export const MAX_ENTRIES = 0xffff;

/** Bit 11 declares the name and comment UTF-8, so every unarchiver decodes them alike. */
const FLAGS = 0x0800;

/** Version 1.0 is the lowest that extracts a stored entry, so every reader accepts it. */
const VERSION_NEEDED = 10;

/** Version 2.0 on MS-DOS: the host whose attributes unarchivers read as plain files. */
const VERSION_MADE_BY = 20;

/** Method 0, stored: the data is written as it is. */
const STORED = 0;

/** What a local and a central header both record about one entry. */
export interface EntryRecord {
	name: Uint8Array;
	comment: Uint8Array;
	time: number;
	date: number;
	crc: number;
	size: number;
}

/** A written entry, with the offset of its local header the central directory points back to. */
export interface WrittenRecord extends EntryRecord {
	offset: number;
}

/**
 * The header written immediately before an entry's data. The CRC-32 and both sizes are set
 * and bit 3 is clear, so a streaming reader finds the end of the data from the header alone.
 */
export function localHeader(entry: EntryRecord): Uint8Array {
	let bytes = new Uint8Array(30 + entry.name.length);
	let view = new DataView(bytes.buffer);
	view.setUint32(0, 0x04034b50, true);
	view.setUint16(4, VERSION_NEEDED, true);
	view.setUint16(6, FLAGS, true);
	view.setUint16(8, STORED, true);
	view.setUint16(10, entry.time, true);
	view.setUint16(12, entry.date, true);
	view.setUint32(14, entry.crc, true);
	view.setUint32(18, entry.size, true);
	view.setUint32(22, entry.size, true);
	view.setUint16(26, entry.name.length, true);
	view.setUint16(28, 0, true);
	bytes.set(entry.name, 30);
	return bytes;
}

/** One entry's record in the central directory, which is what unarchivers list from. */
export function centralHeader(entry: WrittenRecord): Uint8Array {
	let bytes = new Uint8Array(46 + entry.name.length + entry.comment.length);
	let view = new DataView(bytes.buffer);
	view.setUint32(0, 0x02014b50, true);
	view.setUint16(4, VERSION_MADE_BY, true);
	view.setUint16(6, VERSION_NEEDED, true);
	view.setUint16(8, FLAGS, true);
	view.setUint16(10, STORED, true);
	view.setUint16(12, entry.time, true);
	view.setUint16(14, entry.date, true);
	view.setUint32(16, entry.crc, true);
	view.setUint32(20, entry.size, true);
	view.setUint32(24, entry.size, true);
	view.setUint16(28, entry.name.length, true);
	view.setUint16(30, 0, true);
	view.setUint16(32, entry.comment.length, true);
	view.setUint16(34, 0, true);
	view.setUint16(36, 0, true);
	view.setUint32(38, 0, true);
	view.setUint32(42, entry.offset, true);
	bytes.set(entry.name, 46);
	bytes.set(entry.comment, 46 + entry.name.length);
	return bytes;
}

/** The trailing record that locates the central directory, for an archive on one disk. */
export function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
	let bytes = new Uint8Array(22);
	let view = new DataView(bytes.buffer);
	view.setUint32(0, 0x06054b50, true);
	view.setUint16(4, 0, true);
	view.setUint16(6, 0, true);
	view.setUint16(8, count, true);
	view.setUint16(10, count, true);
	view.setUint32(12, size, true);
	view.setUint32(16, offset, true);
	view.setUint16(20, 0, true);
	return bytes;
}

/**
 * Packs a moment into the DOS time and date fields, read in UTC so the same `Date` writes the
 * same bytes on every machine. DOS time counts seconds in pairs, so odd seconds round down.
 *
 * @returns `undefined` for an invalid date or one outside 1980–2107, the years DOS dates span
 */
export function dosDateTime(moment: Date): { time: number; date: number } | undefined {
	let year = moment.getUTCFullYear();
	if (Number.isNaN(year) || year < 1980 || year > 2107) return undefined;
	let time =
		(moment.getUTCHours() << 11) | (moment.getUTCMinutes() << 5) | (moment.getUTCSeconds() >> 1);
	let date = ((year - 1980) << 9) | ((moment.getUTCMonth() + 1) << 5) | moment.getUTCDate();
	return { time, date };
}
