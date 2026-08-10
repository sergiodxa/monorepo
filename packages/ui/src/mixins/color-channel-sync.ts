/**
 * Keeps every track in a group of sibling ColorSlider channels painting a
 * gradient that reflects what every other channel is currently settled on:
 * whenever an `input` event bubbles up from any channel's native range
 * thumb, reads every sibling channel's own `data-channel`/`valueAsNumber`
 * pair under the same wrapping host, then mirrors each of those settled
 * values onto every *other* channel's own track element as a live CSS
 * custom property — the same property a track's gradient already reads at
 * render time, so a track whose formula depends on a sibling's value keeps
 * painting against whatever that sibling is actually set to. Once every
 * value has been mirrored, dispatches one namespaced change event on the
 * host carrying every channel's settled value together.
 *
 * Why JS: a channel's own track gradient sweeps that channel from its own
 * minimum to its own maximum while every other channel holds at whatever it
 * is currently settled on — a red channel's track, for instance, has to keep
 * painting against the group's current green, blue, and alpha the whole
 * time red itself is being dragged. Once a group of independent
 * `<input type="range">` elements is on the page, none of them has any way
 * to notice a sibling's value changing; only script can read one thumb's
 * settled value and carry it over to the tracks whose gradient depends on
 * it.
 * No-JS baseline: every channel still renders as its own independent
 * `<input type="range">`, keyboard-operable and posting its own value with
 * the form, and every track's gradient still paints correctly for whatever
 * values were current at render time; only following a sibling channel's
 * live, in-progress drag is unavailable until the next full render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * `data-*` attribute a ColorSlider channel's native range thumb carries,
 * naming the channel it controls (`"r"`, `"g"`, `"b"`, `"h"`, `"s"`, `"l"`,
 * `"a"`, or any other name a color model gives its channels).
 * {@link channelSync} reads it, paired with the thumb's own `valueAsNumber`,
 * to tell one channel's settled value from the next.
 */
export const COLOR_CHANNEL_ATTRIBUTE = "data-channel";

/**
 * Selector matching a channel's own track — the element its gradient paints
 * on — identified by carrying `data-slot="track"`, the same "mark the part,
 * look it up from a relative" convention a swatch preview uses for its own
 * paired element. {@link channelSync} walks up from a thumb to the nearest
 * ancestor matching this selector to find the track it belongs to.
 */
const CHANNEL_TRACK_SELECTOR = '[data-slot="track"]';

/**
 * Prefix {@link colorChannelProperty} builds every channel's CSS custom
 * property name from. Kept private so the naming scheme has exactly one
 * source of truth, shared between {@link channelSync}'s live updates and
 * whatever renders a channel's track with its initial gradient at render
 * time.
 */
const COLOR_CHANNEL_PROPERTY_PREFIX = "--ui-color-slider-channel-";

/**
 * Builds the CSS custom property name {@link channelSync} mirrors a given
 * channel's settled value onto, e.g. `colorChannelProperty("g")` →
 * `"--ui-color-slider-channel-g"`. A channel's track reads a sibling's
 * current value back through this same property — a red channel's gradient
 * formula referencing `var(--ui-color-slider-channel-g)` and
 * `var(--ui-color-slider-channel-b)`, for instance — and whatever renders a
 * group's initial markup builds the same property name for the values it
 * already knows at render time, so the two stay in agreement without
 * duplicating the naming scheme.
 *
 * @param channel Channel name, matching a {@link COLOR_CHANNEL_ATTRIBUTE} value.
 * @returns The full custom property name for `channel`.
 * @example
 * colorChannelProperty("h"); // "--ui-color-slider-channel-h"
 */
export function colorChannelProperty(channel: string): string {
	return `${COLOR_CHANNEL_PROPERTY_PREFIX}${channel}`;
}

/** DOM event type dispatched by {@link channelSync} on its host every time a settled input reports every channel's value together. */
const COLOR_CHANNEL_CHANGE_EVENT = "ui:color-channel-change" as const;

declare global {
	interface HTMLElementEventMap {
		[COLOR_CHANNEL_CHANGE_EVENT]: ColorChannelChangeEvent;
	}
}

/**
 * Dispatched on a ColorSlider group's host by {@link channelSync} every time
 * any channel's thumb settles on a new value, carrying every channel's
 * current value together so a consumer can compose the full color — writing
 * it into a hidden field, a preview swatch, a combined text readout — without
 * reading each channel's own `<input>` itself.
 */
export class ColorChannelChangeEvent extends Event {
	/** Name of the channel whose thumb just fired the `input` event that triggered this report. */
	readonly channel: string;
	/** Every channel's settled value, keyed by its own {@link COLOR_CHANNEL_ATTRIBUTE} name. */
	readonly values: Readonly<Record<string, number>>;

	/**
	 * @param init The channel that just moved, and every channel's settled value at dispatch time.
	 */
	constructor(init: { channel: string; values: Record<string, number> }) {
		super(COLOR_CHANNEL_CHANGE_EVENT, { bubbles: true });
		this.channel = init.channel;
		this.values = Object.freeze({ ...init.values });
	}
}

/**
 * Finds every channel thumb under `host`, keyed by its own
 * {@link COLOR_CHANNEL_ATTRIBUTE} name.
 *
 * @param host Wrapping host the sibling ColorSlider channels render inside.
 * @returns Every matched thumb, in document order, keyed by channel name.
 */
function findChannelThumbs(host: HTMLElement): Map<string, HTMLInputElement> {
	let thumbs = new Map<string, HTMLInputElement>();

	for (let thumb of host.querySelectorAll<HTMLInputElement>(
		`input[type="range"][${COLOR_CHANNEL_ATTRIBUTE}]`,
	)) {
		let channel = thumb.getAttribute(COLOR_CHANNEL_ATTRIBUTE);
		if (channel) thumbs.set(channel, thumb);
	}

	return thumbs;
}

/**
 * Finds a channel's own track — the nearest ancestor of `thumb` matching
 * {@link CHANNEL_TRACK_SELECTOR} — the element {@link channelSync} mirrors
 * sibling values onto.
 *
 * @param thumb The channel's own native range thumb.
 * @returns The matched track, or `null` when no ancestor carries the slot.
 */
function findChannelTrack(thumb: HTMLInputElement): HTMLElement | null {
	return thumb.closest<HTMLElement>(CHANNEL_TRACK_SELECTOR);
}

/**
 * Reads every channel's current settled value off its own thumb.
 *
 * @param thumbs Every channel thumb under a group's host, keyed by channel name.
 * @returns Every channel's current value, keyed the same way.
 */
function readChannelValues(thumbs: Map<string, HTMLInputElement>): Record<string, number> {
	let values: Record<string, number> = {};
	for (let [channel, thumb] of thumbs) values[channel] = thumb.valueAsNumber;
	return values;
}

/**
 * Mirrors `values` onto every channel's own track, skipping `firedChannel`'s
 * own track — its gradient sweeps that very channel, so it never depends on
 * its own current value — and, on every track it does write, skipping that
 * track's own channel within `values`, since a channel's gradient formula
 * only ever reads its *other* siblings.
 *
 * @param thumbs Every channel thumb under a group's host, keyed by channel name.
 * @param values Every channel's current settled value, keyed the same way.
 * @param firedChannel Channel whose thumb just fired the triggering `input` event.
 */
function writeOtherChannelProperties(
	thumbs: Map<string, HTMLInputElement>,
	values: Record<string, number>,
	firedChannel: string,
): void {
	for (let [channel, thumb] of thumbs) {
		if (channel === firedChannel) continue;

		let track = findChannelTrack(thumb);
		if (!track) continue;

		for (let [otherChannel, value] of Object.entries(values)) {
			if (otherChannel === channel) continue;
			track.style.setProperty(colorChannelProperty(otherChannel), String(value));
		}
	}
}

/**
 * Keeps a group of sibling ColorSlider channel tracks painting a gradient
 * that stays current with one another as the person dragging any one
 * channel's thumb settles it on a new value.
 *
 * Apply it to the group's wrapping host — the element containing every
 * channel's track-and-thumb pair. Each channel's native range thumb carries
 * {@link COLOR_CHANNEL_ATTRIBUTE} naming the channel it controls, nested
 * inside that channel's own track element, marked `data-slot="track"` so
 * {@link channelSync} can find it. The mixin listens for the `input` event
 * bubbling up from any thumb, so no listener needs attaching to the thumbs
 * themselves.
 *
 * On every settled input, reads every channel's current value, mirrors it
 * onto every *other* channel's own track through {@link colorChannelProperty},
 * and dispatches {@link ColorChannelChangeEvent} on the host with every
 * channel's value together.
 *
 * @returns A mixin descriptor for a ColorSlider group's wrapping host's `mix` prop.
 * @example
 * <div mix={channelSync()}>
 *   <div data-slot="track">
 *     <input type="range" data-channel="r" min={0} max={255} defaultValue={120} aria-label={t("colorSlider.red")} />
 *   </div>
 *   <div data-slot="track">
 *     <input type="range" data-channel="g" min={0} max={255} defaultValue={45} aria-label={t("colorSlider.green")} />
 *   </div>
 *   <div data-slot="track">
 *     <input type="range" data-channel="b" min={0} max={255} defaultValue={200} aria-label={t("colorSlider.blue")} />
 *   </div>
 * </div>
 */
export const channelSync: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let hostNode: HTMLElement | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	/** Mirrors every channel's settled value onto every other channel's track, then reports the full set. */
	function handleChannelInput(target: EventTarget | null): void {
		if (!hostNode || !(target instanceof HTMLInputElement)) return;

		let firedChannel = target.getAttribute(COLOR_CHANNEL_ATTRIBUTE);
		if (firedChannel === null) return;

		let thumbs = findChannelThumbs(hostNode);
		if (!thumbs.has(firedChannel)) return;

		let values = readChannelValues(thumbs);
		writeOtherChannelProperties(thumbs, values, firedChannel);

		hostNode.dispatchEvent(new ColorChannelChangeEvent({ channel: firedChannel, values }));
	}

	return () =>
		createElement(handle.element, {
			mix: [on<HTMLElement, "input">("input", (event) => handleChannelInput(event.target))],
		});
});
