/**
 * Barrel for `@sdxc/ui/finance`: the pieces a banking, budgeting or wallet app is built
 * from, such as a statement grouped by day and a drawn payment card. Each module also
 * imports on its own, as `@sdxc/ui/finance/ledger`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export * from "./ledger.js";
export * from "./payment-card.js";
