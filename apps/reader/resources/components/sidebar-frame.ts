/**
 * The name the sidebar's feed band is registered under.
 *
 * It sits on its own so that reaching the band costs a control nothing: a mark on a row
 * asks for it by name from wherever it is on the page, and importing the whole of the
 * layout to learn one string would carry the chrome into the browser to move a number.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How the band is found: `handle.frames.get(SIDEBAR_FEEDS_FRAME)?.reload()`. */
export const SIDEBAR_FEEDS_FRAME = "sidebar-feeds";
