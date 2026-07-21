/**
 * The visitor's live `prefers-reduced-motion` preference, read through a
 * single `matchMedia` query — the one check every motion-aware mixin
 * consults before choosing between a full motion effect and its instant or
 * opacity-only alternative.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Reads whether the visitor's platform currently requests reduced motion.
 *
 * @returns `true` when the platform's `prefers-reduced-motion` setting is `reduce`, `false` otherwise.
 * @example
 * let behavior: ScrollBehavior = prefersReducedMotion() ? "instant" : "smooth";
 */
export function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
