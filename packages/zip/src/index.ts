/**
 * The package entry point: `Zip` assembles an archive from strings, bytes and streams and
 * writes it as a stream of stored entries, and `crc32` is the checksum it records. Both run
 * wherever Web Streams do and do no work at import time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { ZipEntryOptions, ZipSource } from "./zip.js";

export { crc32 } from "./crc32.js";
export { Zip, ZipError } from "./zip.js";
