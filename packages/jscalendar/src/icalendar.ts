/**
 * Converts between JSCalendar and `@sdxc/icalendar`'s model, following
 * draft-ietf-calext-jscalendar-icalendar in RFC 8984's properties. It lives on its own
 * subpath so a JSCalendar-only consumer never loads the iCalendar model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { FromICalendarOptions } from "./lib/from-icalendar.js";
export type { ToICalendarOptions } from "./lib/to-icalendar.js";

export { ConversionError } from "./lib/errors.js";
export { eventFromICalendar, fromICalendar, taskFromICalendar } from "./lib/from-icalendar.js";
export { toICalendar } from "./lib/to-icalendar.js";
