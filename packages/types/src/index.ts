/**
 * Public surface of the types package: the resolved type of an async function,
 * the JSON boundary types for writing, reading and the round trip between them,
 * the scalars at their leaves, and the type-level `any` check. Types only, so
 * every consumer imports from here with `import type`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { IsAny } from "./is-any.js";
export type { JSONPrimitive } from "./json-primitive.js";
export type { JSONSerializable } from "./json-serializable.js";
export type { JSONSerialized } from "./json-serialized.js";
export type { JSONValue } from "./json-value.js";
export type { ResolvedType } from "./resolved-type.js";
