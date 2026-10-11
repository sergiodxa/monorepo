/**
 * Catalog of what this funnel sells: the two packages, named by our own slugs,
 * and the four discount campaigns, by the id the platform issues them under.
 * The webhook branches on the slugs and the checkout applies the campaign ids.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The two purchasable packages. Each slug is also the `:type` the published
 * checkout URL carries, so a link and a catalog read name the same value.
 */
export enum Product {
	Essentials = "essentials",
	Complete = "complete",
}

/**
 * The discount campaigns, by discount id. `UPGRADE` is handed out manually to
 * an Essentials owner moving up to Complete, so discount selection excludes it
 * from the automatic launch-window set.
 */
export enum Discounts {
	EARLY = "e1612305-d990-4f77-90fc-97eced27781d",
	FIRST_WEEK = "6efbd8d0-8474-4359-a454-736d17846158",
	SECOND_WEEK = "bac96749-027c-4372-ae96-c2db1c2d9998",
	UPGRADE = "e0fa5513-ad25-4140-a72a-b5d0cd88c29d",
}
