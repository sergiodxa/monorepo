/**
 * The shared vocabulary of Cloudflare list prices: the meter and price shapes every service
 * module states its numbers in, and the helpers that derive cents per unit and per GB-day.
 * Service prices live in their own export paths, e.g. `@sdxc/cloudflare-pricing/d1`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Allowance, AllowancePeriod, Meter, Price, Unit } from "./meter.js";

export { centsPerGbDay, centsPerUnit, DAYS_PER_BILLING_MONTH } from "./meter.js";
