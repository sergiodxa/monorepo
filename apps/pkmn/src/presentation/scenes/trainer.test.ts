/**
 * Tests for the trainer card's pure content rows.
 *
 * Covers `trainerCardRows`, asserting the labelled name and money rows it
 * builds from a player view: row order and the `₽`-prefixed money format,
 * keeping the card a plain function of that view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { trainerCardRows } from "./trainer";

test("trainerCardRows lists the name then the money in order", () => {
	let rows = trainerCardRows({ name: "RED", money: 93200 });
	expect(rows.map((row) => row.label)).toEqual(["NAME", "MONEY"]);
});

test("trainerCardRows shows the player name verbatim", () => {
	expect(trainerCardRows({ name: "RED", money: 0 })[0]).toEqual({ label: "NAME", value: "RED" });
});

test("trainerCardRows formats money with the ₽ prefix", () => {
	expect(trainerCardRows({ name: "RED", money: 93200 })[1]).toEqual({
		label: "MONEY",
		value: "₽93200",
	});
});

test("trainerCardRows renders a zero balance as ₽0", () => {
	expect(trainerCardRows({ name: "RED", money: 0 })[1]?.value).toBe("₽0");
});
