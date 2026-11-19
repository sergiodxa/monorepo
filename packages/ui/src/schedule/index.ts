/**
 * Barrel for `@sdxc/ui/schedule`: the pieces of a calendar or scheduling app (a time grid of days and hours, a
 * month, an agenda, a strip of days, and a people-by-hours availability grid). Each component also
 * imports on its own as `@sdxc/ui/schedule/<module>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export * from "./agenda.js";
export * from "./day-strip.js";
export * from "./free-busy.js";
export * from "./month-view.js";
export * from "./time-grid.js";
export * from "./utils/time-grid-layout.js";
