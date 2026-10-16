/**
 * Public entry point for the R2 file storage package: the `FileStorage` over an R2 bucket
 * and the bucket surface it calls, so any `R2Bucket` binding plugs in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { R2FileBucket, R2FileObject } from "./r2-file-storage.js";
export { R2FileStorage } from "./r2-file-storage.js";
