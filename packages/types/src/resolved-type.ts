/**
 * The resolved-type helper: names the value on the far side of an async
 * function's promise. Lets a consumer type itself from the function it calls
 * instead of restating a shape that then drifts from its source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Unwraps what an async function resolves to, so props and locals taking data
 * from a loader or query stay tied to that function's return type.
 *
 * @template T - The async function type to unwrap
 *
 * @example
 * async function fetchUser(id: string): Promise<{ name: string; email: string }> { ... }
 * type User = ResolvedType<typeof fetchUser>; // { name: string; email: string }
 */
export type ResolvedType<T extends (...args: any) => Promise<any>> = Awaited<ReturnType<T>>;
