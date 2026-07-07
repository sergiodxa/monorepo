/**
 * Tests for the animated battle HP bar.
 *
 * Covers `setTarget` and `update` easing the displayed value toward the target
 * (both draining and refilling), the ~1s-per-full-bar rate, and the `settled`
 * threshold. `draw` needs a real canvas context and is not tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { HpBar } from "./hp-bar";

test("a fresh bar is settled at its starting value", () => {
	let bar = new HpBar(100, 100);
	expect(bar.settled).toBe(true);
});

test("update eases the displayed value down toward a lower target", () => {
	let bar = new HpBar(100, 100);
	bar.setTarget(0);
	expect(bar.settled).toBe(false);
	bar.update(500); // rate = (100/1000)*500 = 50 -> displayed 50
	expect(bar.settled).toBe(false);
	bar.update(500); // another 50 -> reaches 0
	expect(bar.settled).toBe(true);
});

test("update eases the displayed value up toward a higher target", () => {
	let bar = new HpBar(100, 0);
	bar.setTarget(100);
	bar.update(500); // -> 50, not yet there
	expect(bar.settled).toBe(false);
	bar.update(500); // -> 100
	expect(bar.settled).toBe(true);
});

test("update never overshoots the target when a big dt is applied", () => {
	let bar = new HpBar(100, 100);
	bar.setTarget(30);
	bar.update(100_000); // huge dt, clamps at the target
	expect(bar.settled).toBe(true);
	bar.setTarget(90);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});

test("settled crosses its threshold within half an HP point of the target", () => {
	let bar = new HpBar(100, 100);
	bar.setTarget(0);
	// 100/1000 * 996 = 99.6 displayed -> 0.4 away from 0 -> settled.
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
	bar.setTarget(80, 100); // level-up style max increase
	expect(bar.settled).toBe(false);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});

test("bindTo snaps to a fresh creature instead of easing up from a fainted 0 (guards Bug 2)", () => {
	// The slot's bar is reused across replacements. A fainted creature leaves it at 0;
	// when a fresh full-HP creature takes the slot the bar must jump straight to full
	// rather than ANIMATING up from the previous occupant's 0 — the Bug 2 symptom.
	let bar = new HpBar(100, 0); // previous creature fainted at 0
	bar.bindTo("creature-b", 100, 100); // a fresh full-HP creature takes the slot
	expect(bar.settled).toBe(true); // snapped straight to 100: no upward animation queued
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});

test("bindTo then a drain on the fresh creature eases downward, not upward", () => {
	// After a switch-in the bar is snapped to full, so an incoming hit drains it down
	// (the correct direction) instead of the reused bar climbing up from 0.
	let bar = new HpBar(100, 0); // previous occupant fainted
	bar.bindTo("creature-b", 100, 100); // snap to full for the switched-in creature
	bar.setTarget(60); // the foe hits it: drain toward 60
	expect(bar.settled).toBe(false);
	bar.update(400); // rate 100/1000*400 = 40 -> reaches 60
	expect(bar.settled).toBe(true);
});

test("bindTo eases ordinary damage while the same creature holds the slot", () => {
	let bar = new HpBar(100, 100);
	bar.bindTo("creature-a", 100, 100); // first bind: same creature, holds at 100
	bar.bindTo("creature-a", 40, 100); // same key: track the new HP the ordinary way
	expect(bar.settled).toBe(false);
	bar.update(100_000);
	expect(bar.settled).toBe(true);
});
