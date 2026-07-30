/**
 * Catalog of the Polar identifiers this funnel sells against: the two products and the
 * four discount campaigns. Every id here names a live object in Polar — the webhook
 * branches on the product ids and the checkout endpoint applies the discount ids — so
 * they are copied, never regenerated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The two purchasable packages, by Polar product id. */
export enum Product {
	Essentials = "ae57a87c-0ba0-4757-9cf5-22d2f4bd33bf",
	Complete = "297b3608-87f2-415c-ac42-185f34838540",
}

/**
 * The discount campaigns, by Polar discount id.
 *
 * `EARLY`, `FIRST_WEEK` and `SECOND_WEEK` are launch-window campaigns the checkout
 * endpoint picks between automatically. `UPGRADE` is different in kind: it is never
 * auto-applied, it is handed out only to a reader who already owns Essentials and is
 * moving up to Complete, which is why the discount selection rules exclude it.
 */
export enum Discounts {
	EARLY = "e1612305-d990-4f77-90fc-97eced27781d",
	FIRST_WEEK = "6efbd8d0-8474-4359-a454-736d17846158",
	SECOND_WEEK = "bac96749-027c-4372-ae96-c2db1c2d9998",
	UPGRADE = "e0fa5513-ad25-4140-a72a-b5d0cd88c29d",
}
