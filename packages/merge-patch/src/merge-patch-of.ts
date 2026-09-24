/**
 * The type of a valid merge patch for a resource type, for clients that build patches
 * by hand and want a removal typed as the `null` it is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The patches valid for a resource of type `T`: every member optional, `null` wherever
 * the member itself is optional (removing it), objects recursively patchable, and arrays
 * and scalars replaced whole.
 *
 * @template T - The resource's writable shape.
 */
export type MergePatchOf<T> = T extends readonly unknown[]
	? T
	: T extends object
		? { [K in keyof T]?: MergePatchOf<T[K]> | (undefined extends T[K] ? null : never) }
		: T;
