/**
 * Barrel for `@sdxc/ui/video`: a video player and its parts, and the catalogue pieces a
 * video library browses with (cards, shelves, heroes, episode lists), with the helpers only they use.
 * Each module also imports on its own, as `@sdxc/ui/video/video-player`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export * from "./mixins/video-player-sync.js";
export * from "./utils/timeline.js";
export * from "./episode-list.js";
export * from "./title-hero.js";
export * from "./video-card.js";
export * from "./video-player.js";
export * from "./video-shelf.js";
