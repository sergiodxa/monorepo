/**
 * The leaf of the JSON value type: the four scalars JSON writes directly,
 * without the arrays and objects that nest them. Names the half of a JSON
 * boundary a comparison can be made against, where a structure has no meaning.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A JSON value that holds no other value. An API taking one states that it
 * compares, indexes or keys by what it is handed, which an array or an object
 * cannot answer for.
 *
 * @example
 * let value: JSONPrimitive = "eu-west";
 * @example
 * let values: JSONPrimitive[] = ["free", "pro", 3, null];
 */
export type JSONPrimitive = string | number | boolean | null;
