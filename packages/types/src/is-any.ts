/**
 * The `any` detector: a type-level check that tells `any` apart from `unknown`
 * and every concrete type. Lets a conditional type branch on values that lose
 * their type at a boundary, such as whatever `JSON.parse` returns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Resolves to `true` only for `any`. `0 extends 1 & T` holds there alone,
 * because intersecting with `any` collapses back to `any`, which `0` extends;
 * every other type leaves `1 & T` incompatible with `0`.
 *
 * @template T - The type to check
 *
 * @example
 * type A = IsAny<any>;     // true
 * type B = IsAny<unknown>; // false
 * type C = IsAny<string>;  // false
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;
