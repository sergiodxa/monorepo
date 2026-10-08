/**
 * Reads and writes RFC 1035 master files (BIND zone files), reporting every entry it cannot
 * use beside the records it read, and owns the RDATA presentation codec, so record data from
 * a zone file and from a resolver reads into the same typed fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type * from "./types.js";
export type * as ZoneFile from "./types.js";

export { RecordDataError, ZoneFileError } from "./errors.js";
export { formatRecordData } from "./format-record-data.js";
export { parse } from "./parse.js";
export { parseRecordData } from "./parse-record-data.js";
export { canonicalType, typeName } from "./record-types.js";
export { stringify } from "./stringify.js";
