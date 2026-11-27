/**
 * The player internals the `@sdxc/novel/dev` entry builds on beyond the public `@sdxc/novel/ui`
 * API: the library screens' dialog and labels, and the interface channel's sound playback. The dev
 * tools import the player only through this module and the public entry, so this is their contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { LibraryScreen, ScreenDialogProps } from "./extras.js";

export { LIBRARY_SCREEN_LABELS, ScreenDialog } from "./extras.js";
export { playInterfaceSound } from "./interface-sounds.js";
