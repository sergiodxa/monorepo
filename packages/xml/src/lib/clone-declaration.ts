/**
 * Provides a helper for cloning XML declaration data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "../index.js";

/**
 * Clones declaration data so external code cannot mutate the stored value.
 *
 * @param declaration - The declaration data to clone
 * @returns A shallow clone of the declaration or `undefined`
 */
export function cloneDeclaration(declaration?: XML.Declaration): XML.Declaration | undefined {
	if (!declaration) return undefined;
	return structuredClone(declaration);
}
