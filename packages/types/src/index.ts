/**
 * Extracts the resolved type from an async function's return type.
 * Useful for typing props that receive data from loaders or async queries.
 *
 * @example
 * async function fetchUser(id: string): Promise<{ name: string; email: string }> { ... }
 * type User = ResolvedType<typeof fetchUser>; // { name: string; email: string }
 */
export type ResolvedType<T extends (...args: any) => Promise<any>> = Awaited<ReturnType<T>>;
