/**
 * Barrel for `@sdxc/ui/audio`: the pieces of a music app (track tables, artwork tiles, the
 * player bar and its phone form, the queue, the playing mark) and the queue and Media Session
 * helpers a player drives them with. Each module also imports on its own, as `@sdxc/ui/audio/player-bar`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export * from "./utils/media-session.js";
export * from "./utils/play-queue.js";
export * from "./utils/track-time.js";
export * from "./equalizer.js";
export * from "./media-tile.js";
export * from "./player-bar.js";
export * from "./queue-list.js";
export * from "./track-list.js";
