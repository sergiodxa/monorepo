/**
 * Animation mixins: composing `@keyframes` with the host `animation-*`
 * declarations, timing offsets, and the named scroll- and view-timeline
 * declarations that drive scroll-linked animations across elements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export { animation, animationHost } from "./animation";
export type { AnimationConfig } from "./animation";
export { animationDelay } from "./animation-delay";
export { keyframes } from "./keyframes";
export { scrollTimelineName } from "./scroll-timeline-name";
export { timelineScope } from "./timeline-scope";
export { viewTimelineName } from "./view-timeline-name";
