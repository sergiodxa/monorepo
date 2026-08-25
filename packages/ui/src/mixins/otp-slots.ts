/**
 * Focus coordination for an OtpField group: advances focus on each typed
 * digit, retreats on `Backspace` from an empty slot, and splits a pasted
 * code across every slot it fits, starting at the slot that received it.
 * Why JS: distributing typed and pasted characters across single-character
 * inputs, moving focus along with them, requires reading each keystroke and
 * clipboard payload as it arrives; no CSS selector expresses that. No-JS
 * baseline: the group still renders as ordinary text inputs, each reachable
 * through `Tab`; only auto-advance, retreat, and paste-splitting are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

/**
 * Attribute every OtpField slot input exposes itself on. `otpSlots()` reads
 * every element carrying this attribute beneath the host, in document
 * order, to find each slot's neighbors and assemble the full code.
 */
export const OTP_SLOT_ATTRIBUTE = "data-otp-slot";

/** DOM event type dispatched by {@link otpSlots} once every slot holds a character. */
const OTP_COMPLETE_EVENT = "ui:otp-complete" as const;

declare global {
	interface HTMLElementEventMap {
		[OTP_COMPLETE_EVENT]: OtpCompleteEvent;
	}
}

/**
 * Dispatched on the OtpField group host by {@link otpSlots} the moment every
 * slot holds a character, carrying the assembled code for validation or
 * auto-submit; redispatches only when the assembled code actually changes.
 */
export class OtpCompleteEvent extends Event {
	/** Slot values joined in document order, one character per slot. */
	readonly code: string;

	/**
	 * @param code Assembled code at dispatch time.
	 */
	constructor(code: string) {
		super(OTP_COMPLETE_EVENT, { bubbles: true });
		this.code = code;
	}
}

/**
 * Reads every enabled slot input beneath `host`, in document order; disabled
 * slots are skipped, so auto-advance, retreat, and paste distribution only
 * ever touch slots a consumer has left interactive.
 *
 * @param host OtpField group element the slots are read from.
 * @returns The group's slot inputs, in document order.
 */
function querySlots(host: HTMLElement): HTMLInputElement[] {
	return Array.from(
		host.querySelectorAll<HTMLInputElement>(`[${OTP_SLOT_ATTRIBUTE}]:not(:disabled)`),
	);
}

/**
 * Joins every slot's value in order, or returns `null` while any slot is
 * still empty, so callers only ever see a code once it's actually complete.
 *
 * @param slots Slot inputs in document order.
 * @returns The assembled code, or `null` when at least one slot is empty.
 */
function assembleCode(slots: readonly HTMLInputElement[]): string | null {
	let values = slots.map((slot) => slot.value);
	return values.some((value) => value.length === 0) ? null : values.join("");
}

/**
 * Writes each character of `text` — interior whitespace stripped, so a code
 * copied as "123 456" lands as six characters — into consecutive slots from
 * `startIndex`, overwriting until every character is placed or slots run out.
 *
 * @param slots Slot inputs in document order.
 * @param startIndex Index of the slot the distribution begins at.
 * @param text Typed or pasted text to distribute across the slots.
 * @returns Index of the slot that should receive focus once distribution finishes.
 */
function distributeAcrossSlots(
	slots: readonly HTMLInputElement[],
	startIndex: number,
	text: string,
): number {
	let characters = Array.from(text.replace(/\s+/g, ""));
	let filled = 0;

	for (let character of characters) {
		let index = startIndex + filled;
		if (index >= slots.length) break;

		slots[index]!.value = character;
		filled++;
	}

	return Math.min(startIndex + filled, slots.length - 1);
}

/**
 * Coordinates focus across an OtpField group's slot inputs identified by
 * {@link OTP_SLOT_ATTRIBUTE}, querying them fresh on every interaction so
 * slots can be added, removed, or disabled without the mixin losing sync.
 *
 * @example
 * <div role="group" mix={otpSlots()}>
 * 	<input data-otp-slot maxLength={1} inputMode="numeric" aria-label={t("otp.slot", { position: 1 })} />
 * 	<input data-otp-slot maxLength={1} inputMode="numeric" aria-label={t("otp.slot", { position: 2 })} />
 * 	<input data-otp-slot maxLength={1} inputMode="numeric" aria-label={t("otp.slot", { position: 3 })} />
 * </div>
 */
export const otpSlots = createMixin<HTMLElement>((handle) => {
	let lastCode: string | null = null;

	/** Dispatches {@link OtpCompleteEvent} on `host` when `slots` just became complete with a code other than the last one reported. */
	function reportIfComplete(host: HTMLElement, slots: readonly HTMLInputElement[]): void {
		let code = assembleCode(slots);

		if (code === null) {
			lastCode = null;
			return;
		}

		if (code === lastCode) return;

		lastCode = code;
		host.dispatchEvent(new OtpCompleteEvent(code));
	}

	return () =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "input">("input", (event) => {
					let target = event.target;
					if (!(target instanceof HTMLInputElement)) return;
					if (!target.matches(`[${OTP_SLOT_ATTRIBUTE}]`)) return;
					if (target.value.length === 0) return;

					let host = event.currentTarget;
					let slots = querySlots(host);
					let index = slots.indexOf(target);
					if (index === -1) return;

					if (target.value.length > 1) {
						let focusIndex = distributeAcrossSlots(slots, index, target.value);
						slots[focusIndex]?.focus();
					} else {
						slots[index + 1]?.focus();
					}

					reportIfComplete(host, slots);
				}),
				on<HTMLElement, "keydown">("keydown", (event) => {
					if (event.key !== "Backspace") return;

					let target = event.target;
					if (!(target instanceof HTMLInputElement)) return;
					if (!target.matches(`[${OTP_SLOT_ATTRIBUTE}]`)) return;
					if (target.value.length > 0) return;

					let host = event.currentTarget;
					let slots = querySlots(host);
					let index = slots.indexOf(target);
					let previous = index === -1 ? undefined : slots[index - 1];
					if (!previous) return;

					event.preventDefault();
					previous.value = "";
					previous.focus();

					reportIfComplete(host, slots);
				}),
				on<HTMLElement, "paste">("paste", (event) => {
					let target = event.target;
					if (!(target instanceof HTMLInputElement)) return;
					if (!target.matches(`[${OTP_SLOT_ATTRIBUTE}]`)) return;

					let text = event.clipboardData?.getData("text") ?? "";
					if (text === "") return;

					event.preventDefault();

					let host = event.currentTarget;
					let slots = querySlots(host);
					let index = slots.indexOf(target);
					if (index === -1) return;

					let focusIndex = distributeAcrossSlots(slots, index, text);
					slots[focusIndex]?.focus();

					reportIfComplete(host, slots);
				}),
			],
		});
});
