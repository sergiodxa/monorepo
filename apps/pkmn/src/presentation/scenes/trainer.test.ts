/**
 * Tests for the trainer card's pure content rows.
 *
 * Covers `trainerCardRows`, which maps the player view into the labelled name and
 * money lines the trainer card draws. The canvas drawing and scene wiring are not
 * exercised here; only the ordering and the `₽`-prefixed money formatting are
 * asserted so the card stays a plain function of the player view.
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
