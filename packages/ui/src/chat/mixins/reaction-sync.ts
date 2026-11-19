/**
 * Makes every `ReactionBar` on the page answer at once: pressing a chip flips it and its count
 * before the form posts in the background, a `ui:reaction-add` event adds or presses a chip,
 * and a post the server refuses puts the row back. Without it each chip is a plain form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin } from "remix/component";

/** DOM event type that asks a `ReactionBar` to add, or press, a reaction. */
export const REACTION_ADD_EVENT = "ui:reaction-add" as const;

/** What a {@link ReactionAddEvent} asks for. */
export interface ReactionAddDetail {
	/** The emoji as the chip's form submits it: a character, or a custom's `:shortcode:`. */
	emoji: string;
	/** What the emoji is called, for the chip's accessible name. */
	label: string;
	/** A custom emoji's image. */
	image?: string;
	/** Takes the reader's reaction off when they already reacted with this emoji. */
	toggle?: boolean;
}

declare global {
	interface HTMLElementEventMap {
		[REACTION_ADD_EVENT]: ReactionAddEvent;
	}
}

/**
 * Dispatched on a `ReactionBar` (or any element inside the message holding one) to add the
 * reader's reaction: an existing chip is pressed, a missing one is cloned from the row's
 * `ReactionBar.Template`, and either posts through its form.
 */
export class ReactionAddEvent extends Event {
	readonly detail: ReactionAddDetail;

	/** @param detail The reaction to add. */
	constructor(detail: ReactionAddDetail) {
		super(REACTION_ADD_EVENT, { bubbles: true, cancelable: true });
		this.detail = detail;
	}
}

/** The chip a form submits with, when the form is one of a `ReactionBar`'s. */
function chipOf(form: HTMLFormElement, submitter: Element | null): HTMLButtonElement | null {
	if (!form.closest("[data-slot=reaction-bar]")) return null;
	let chip = submitter ?? form.querySelector("[data-slot=reaction]");
	return chip instanceof HTMLButtonElement && chip.matches("[data-slot=reaction]") ? chip : null;
}

/** Reads a chip's count. */
function countOf(chip: HTMLButtonElement): number {
	return Number(chip.querySelector("[data-reaction-count]")?.textContent ?? "0") || 0;
}

/** Draws a chip as pressed or not with `count`, and points its value at the next flip. */
function paint(chip: HTMLButtonElement, pressed: boolean, count: number): void {
	chip.setAttribute("aria-pressed", pressed ? "true" : "false");
	chip.value = (pressed ? chip.dataset.toggleOff : chip.dataset.toggleOn) ?? chip.value;
	let counter = chip.querySelector("[data-reaction-count]");
	if (counter) counter.textContent = String(count);
}

/**
 * Flips a chip at once and posts its form in the background; a refused or failed post restores
 * the chip, and a chip whose count reaches zero leaves the row until then.
 */
function flip(form: HTMLFormElement, chip: HTMLButtonElement, signal: AbortSignal): void {
	let body = new URLSearchParams();
	for (let [name, value] of new FormData(form, chip)) {
		if (typeof value === "string") body.append(name, value);
	}
	let pressed = chip.getAttribute("aria-pressed") === "true";
	let count = countOf(chip);
	let next = Math.max(0, count + (pressed ? -1 : 1));
	let parent = form.parentNode;
	let sibling = form.nextSibling;
	paint(chip, !pressed, next);
	if (next === 0) form.remove();
	let restore = () => {
		paint(chip, pressed, count);
		if (!form.isConnected && parent) parent.insertBefore(form, sibling);
	};
	void fetch(form.action, {
		method: "POST",
		body,
		redirect: "manual",
		credentials: "same-origin",
		signal,
	})
		.then((response) => {
			if (response.type !== "opaqueredirect" && !response.ok) restore();
		})
		.catch(() => {
			if (!signal.aborted) restore();
		});
}

/** Fills a chip cloned from the template with the reaction a {@link ReactionAddEvent} names. */
function fill(form: HTMLFormElement, detail: ReactionAddDetail): HTMLButtonElement | null {
	let chip = form.querySelector<HTMLButtonElement>("[data-slot=reaction]");
	if (chip === null) return null;
	for (let input of form.querySelectorAll<HTMLInputElement>("[data-reaction-emoji]")) {
		input.value = detail.emoji;
	}
	chip.dataset.emoji = detail.emoji;
	let glyph = chip.querySelector("[data-reaction-emoji-glyph]");
	if (glyph) {
		if (detail.image === undefined) glyph.textContent = detail.emoji;
		else {
			let image = document.createElement("img");
			image.src = detail.image;
			image.alt = "";
			glyph.replaceChildren(image);
		}
	}
	let label = chip.querySelector("[data-reaction-label]");
	if (label) label.textContent = detail.label;
	paint(chip, false, 0);
	return chip;
}

/** Adds or presses the reaction a {@link ReactionAddEvent} names in the bar it reached. */
function add(bar: HTMLElement, detail: ReactionAddDetail, signal: AbortSignal): void {
	let existing = [...bar.querySelectorAll<HTMLButtonElement>("[data-slot=reaction]")].find(
		(chip) => chip.dataset.emoji === detail.emoji && !chip.closest("template"),
	);
	if (existing) {
		let form = existing.form;
		let pressed = existing.getAttribute("aria-pressed") === "true";
		if (form && (!pressed || detail.toggle)) flip(form, existing, signal);
		return;
	}
	let template = bar.querySelector<HTMLTemplateElement>("template[data-reaction-template]");
	let source = template?.content.firstElementChild ?? template?.firstElementChild;
	let form = source?.cloneNode(true);
	if (!(form instanceof HTMLFormElement)) return;
	let chip = fill(form, detail);
	if (chip === null) return;
	let slot = bar.querySelector("[data-slot=reaction-add], template[data-reaction-template]");
	bar.insertBefore(form, slot);
	flip(form, chip, signal);
}

/**
 * Put on one element that stays on the page, such as an island's host: from then on every
 * reaction chip under `document` flips at once and posts in the background, and
 * `ui:reaction-add` events add reactions in place. Submits are claimed in the capture phase,
 * before any navigation handler sees them.
 *
 * @returns A mixin with no visible effect on its host.
 * @example <span hidden mix={[reactionSync()]} />
 */
export const reactionSync: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;
	handle.addEventListener("insert", () => {
		controller?.abort();
		controller = new AbortController();
		let { signal } = controller;
		document.addEventListener(
			"submit",
			(event) => {
				let form = event.target;
				if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
				let chip = chipOf(form, event.submitter);
				if (chip === null) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				flip(form, chip, signal);
			},
			{ capture: true, signal },
		);
		document.addEventListener(
			REACTION_ADD_EVENT,
			(event) => {
				let target = event.target;
				if (!(event instanceof ReactionAddEvent) || !(target instanceof Element)) return;
				let bar = target.matches("[data-slot=reaction-bar]")
					? target
					: target.querySelector("[data-slot=reaction-bar]");
				if (!(bar instanceof HTMLElement)) return;
				event.preventDefault();
				add(bar, event.detail, signal);
			},
			{ signal },
		);
	});
	handle.addEventListener("remove", () => controller?.abort());
	return (props = {}) => createElement(handle.element, props);
});
