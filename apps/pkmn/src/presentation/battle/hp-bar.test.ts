/**
 * Tests for the animated battle HP bar.
 *
 * Covers `setTarget`/`update` easing toward a target, the ~1s rate, the
 * `settled` threshold, and `bindTo` snapping straight to a newly slotted
 * creature's HP (Bug 2). `draw` needs a canvas and is untested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { HpBar } from "./hp-bar";

test("a fresh bar is settled at its starting value", () => {
	let bar = new HpBar(100, 100);
	expect(bar.settled).toBe(true);
});

test("update eases the displayed value down toward a lower target", () => {
	let bar = new HpBar(100, 100);
	bar.setTarget(0);
	expect(bar.settled).toBe(false);
	bar.update(500);
	expect(bar.settled).toBe(false);
	bar.update(500);
	expect(bar.settled).toBe(true);
});

test("update eases the displayed value up toward a higher target", () => {
	let bar = new HpBar(100, 0);
	bar.setTarget(100);
	bar.update(500);
	expect(bar.settled).toBe(false);
	bar.update(500);
	expect(bar.settled).toBe(true);
});

test("update never overshoots the target when a big dt is applied", () => {
	let bar = new HpBar(100, 100);
	bar.setTarget(30);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
	bar.setTarget(90);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});

test("settled crosses its threshold within half an HP point of the target", () => {
	let bar = new HpBar(100, 100);
	bar.setTarget(0);
	bar.update(996);
	expect(bar.settled).toBe(true);
});

test("update is a no-op once the displayed value already equals the target", () => {
	let bar = new HpBar(100, 40);
	bar.update(1000);
	expect(bar.settled).toBe(true);
});

test("setTarget can raise the maximum while pointing at a new value", () => {
	let bar = new HpBar(50, 50);
	bar.setTarget(80, 100);
	expect(bar.settled).toBe(false);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});

test("bindTo snaps to a fresh creature instead of easing up from a fainted 0 (guards Bug 2)", () => {
	let bar = new HpBar(100, 0);
	bar.bindTo("creature-b", 100, 100);
	expect(bar.settled).toBe(true);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});

test("bindTo then a drain on the fresh creature eases downward, not upward", () => {
	let bar = new HpBar(100, 0);
	bar.bindTo("creature-b", 100, 100);
	bar.setTarget(60);
	expect(bar.settled).toBe(false);
	bar.update(400);
	expect(bar.settled).toBe(true);
});

test("bindTo eases ordinary damage while the same creature holds the slot", () => {
	let bar = new HpBar(100, 100);
	bar.bindTo("creature-a", 100, 100);
	bar.bindTo("creature-a", 40, 100);
	expect(bar.settled).toBe(false);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});
