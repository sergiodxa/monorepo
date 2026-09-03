/**
 * Animation mixins: composing `@keyframes` with the host `animation-*`
 * declarations, timing offsets, and the named scroll- and view-timeline
 * declarations that drive scroll-linked animations across elements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export { animation, animationHost } from "./animation.js";
export type { AnimationConfig } from "./animation.js";
export { animationDelay } from "./animation-delay.js";
export { keyframes } from "./keyframes.js";
export { scrollTimelineName } from "./scroll-timeline-name.js";
export { timelineScope } from "./timeline-scope.js";
export { viewTimelineName } from "./view-timeline-name.js";
