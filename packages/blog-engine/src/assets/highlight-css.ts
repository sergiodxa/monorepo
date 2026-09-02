/**
 * The syntax-highlighting stylesheet the engine self-serves at
 * `/assets/highlight.css`, read from `@pkg/highlight` so the token colors have
 * one definition and hosts still need no build-pipeline cooperation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import styles from "@pkg/highlight/styles.css?raw";

/** The stylesheet text, served as-is. */
export const HIGHLIGHT_CSS: string = styles;

/** A stable content hash for cache-busting the stylesheet URL. */
export const HIGHLIGHT_CSS_VERSION = "2";
