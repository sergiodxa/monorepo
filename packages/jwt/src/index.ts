/**
 * Public surface of `@pkg/jwt`: the `JWT` payload class, the `JWK` key namespace,
 * and the storage contract signing-key rotation is written against.
 *
 * The claim parser behind `JWT`'s accessors stays internal — it is an implementation
 * detail of how token classes read their claims, not something a caller constructs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { KeyStorage, KeyStorageListOptions, KeyStorageListResult } from "./key-storage";

export { JWK } from "./jwk";
export { JWT } from "./jwt";
