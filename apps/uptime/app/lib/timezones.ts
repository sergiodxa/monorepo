/**
 * The cron-job time-zone settings the forms, the API and the database share: the zone a
 * job falls back to, and the wording a rejected zone is reported with. The zone list and
 * its check come from the runtime's IANA database through `@sdxc/dates`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The zone a cron job falls back to, matching the database column and every stored row. */
export const DEFAULT_TIMEZONE = "UTC";

/**
 * Rejection message for a `timezone` the runtime's IANA database doesn't know, shared by
 * the form and API schemas for one consistent wording that the API client reads verbatim
 * in a `validation-error` problem.
 */
export const UNKNOWN_TIMEZONE_MESSAGE = "Expected a valid IANA time zone";
