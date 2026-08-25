/**
 * Catalog of the Polar identifiers this funnel sells against: the two
 * products and the four discount campaigns. Every id here names a live
 * object in Polar — the webhook branches on the product ids and the
 * checkout endpoint applies the discount ids — so each one is copied here
 * verbatim.
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
 * The discount campaigns, by Polar discount id. `UPGRADE` is handed out
 * manually to an Essentials owner moving up to Complete, so discount
 * selection excludes it from the automatic launch-window set.
 */
export enum Discounts {
	EARLY = "e1612305-d990-4f77-90fc-97eced27781d",
	FIRST_WEEK = "6efbd8d0-8474-4359-a454-736d17846158",
	SECOND_WEEK = "bac96749-027c-4372-ae96-c2db1c2d9998",
	UPGRADE = "e0fa5513-ad25-4140-a72a-b5d0cd88c29d",
}
