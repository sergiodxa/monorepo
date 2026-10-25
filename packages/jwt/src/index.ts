/**
 * Public surface of `@sdxc/jwt`: the `JWT` payload class and its RFC 8417
 * `SecurityEventToken` subclass, the `JWK` key namespace, and the storage contract
 * signing-key rotation is written against.
 *
 * The claim parser behind `JWT`'s accessors stays internal, existing solely for
 * token classes to read their own claims through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { KeyStorage, KeyStorageListOptions, KeyStorageListResult } from "./key-storage.js";

export { JWK } from "./jwk.js";
export { JWT } from "./jwt.js";
export { SecurityEventToken } from "./security-event-token.js";
