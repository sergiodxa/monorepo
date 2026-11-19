/**
 * Money in integer minor units: the currency's precision from `Intl`, reading typed amounts,
 * splitting and converting without losing a cent, and formatting in any locale. Floats
 * never hold an amount, so totals add up to the cent on every screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export * from "./arithmetic.js";
export * from "./currency.js";
export * from "./format.js";
export * from "./parse.js";
