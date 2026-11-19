/**
 * Barrel for `@sdxc/ui/travel`: the pieces a travel or booking app is built from, such as
 * price and rating breakdowns, flight segments, fare calendars, seat maps and boarding
 * passes. Each module also imports on its own, as `@sdxc/ui/travel/seat-map`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export * from "./boarding-pass.js";
export * from "./car-offer.js";
export * from "./fare-calendar.js";
export * from "./fare-options.js";
export * from "./flight-itinerary.js";
export * from "./flight-option.js";
export * from "./flight-segment.js";
export * from "./package-savings.js";
export * from "./price-breakdown.js";
export * from "./rating-breakdown.js";
export * from "./seat-map.js";
export * from "./trip-timeline.js";
