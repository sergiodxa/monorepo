/**
 * Barrel for `@sdxc/ui/chat`: the message log, its rows, bubbles, markers and
 * attachments, with the helpers only they use. Each component also imports on its own
 * as `@sdxc/ui/chat/<module>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export * from "./attachment.js";
export * from "./behaviors/scroll-follow-model.js";
export * from "./bubble.js";
export * from "./marker.js";
export * from "./message-scroller.js";
export * from "./message.js";
export * from "./mixins/attachment-trigger.js";
export * from "./mixins/message-follow.js";
