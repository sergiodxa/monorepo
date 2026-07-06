/**
 * Central catalog of Polar identifiers for the book's offerings, exposing the
 * Product enum (Essentials and Complete package IDs) and the Discounts enum
 * (early, first-week, and second-week discount IDs) referenced across checkout code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export enum Product {
	Essentials = "ae57a87c-0ba0-4757-9cf5-22d2f4bd33bf",
	Complete = "297b3608-87f2-415c-ac42-185f34838540",
}

export enum Discounts {
	EARLY = "e1612305-d990-4f77-90fc-97eced27781d",
	FIRST_WEEK = "6efbd8d0-8474-4359-a454-736d17846158",
	SECOND_WEEK = "bac96749-027c-4372-ae96-c2db1c2d9998",
}
