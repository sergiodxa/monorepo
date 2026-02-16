/**
 * Extracts the resolved type from an async function's return type.
 * Useful for typing props that receive data from loaders or async queries.
 *
 * @example
 * async function fetchUser(id: string): Promise<{ name: string; email: string }> { ... }
 * type User = ResolvedType<typeof fetchUser>; // { name: string; email: string }
 */
export type ResolvedType<T extends (...args: any) => Promise<any>> = Awaited<ReturnType<T>>;

/**
 * Represents any JSON-serializable value.
 * This includes primitives, arrays, and plain objects that can be
 * safely serialized to JSON and deserialized back.
 *
 * @example
 * let value: JSONValue = { name: "John", age: 30 };
 * let array: JSONValue = [1, 2, 3];
 * let primitive: JSONValue = "hello";
 */
export type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };

/**
 * Detects if a type is `any`.
 * Returns `true` if T is `any`, `false` otherwise.
 *
 * Useful for handling functions like `JSON.parse` that return `any`,
 * allowing conditional type logic based on whether a type is `any`.
 *
 * @template T - The type to check
 *
 * @example
 * type A = IsAny<any>;     // true
 * type B = IsAny<unknown>; // false
 * type C = IsAny<string>;  // false
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;
