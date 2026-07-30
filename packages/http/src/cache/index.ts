/**
 * Public surface of the cache subpath: policies that decide who may store a
 * response and for how long, validators that identify its content, and the
 * conditional-request handling that turns a current client copy into a `304`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { EtagOptions } from "./etag";
export type { PrivatePolicyOptions } from "./policies";
export type { CacheVisibility, PolicyOptions } from "./policy";
export type { PreconditionOptions } from "./precondition";

export { conditional } from "./conditional";
export { etag } from "./etag";
export { lastModified } from "./http-date";
export { ifModifiedSince, isModifiedSince } from "./if-modified-since";
export { Policies } from "./policies";
export { policy } from "./policy";
export { precondition, PreconditionFailedError } from "./precondition";
export { vary } from "./vary";
