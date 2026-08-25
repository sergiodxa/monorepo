/**
 * Keeps every track in a group of sibling ColorSlider channels painting a
 * gradient that reflects what every other channel is currently settled on,
 * since none of the independent `<input type="range">` thumbs can otherwise
 * notice a sibling's value changing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * `data-*` attribute a ColorSlider channel's native range thumb carries,
 * naming the channel it controls. {@link channelSync} reads it, paired
 * with the thumb's own `valueAsNumber`, to tell one channel's value from the next.
 */
export const COLOR_CHANNEL_ATTRIBUTE = "data-channel";

/**
 * Selector matching a channel's own track — the element its gradient paints
 * on — identified by carrying `data-slot="track"`. {@link channelSync}
 * walks up from a thumb to the nearest ancestor matching this selector.
 */
const CHANNEL_TRACK_SELECTOR = '[data-slot="track"]';

/**
 * Prefix {@link colorChannelProperty} builds every channel's CSS custom
 * property name from. Kept private so the naming scheme has exactly one
 * source of truth, shared with whatever renders a track's initial gradient.
 */
const COLOR_CHANNEL_PROPERTY_PREFIX = "--ui-color-slider-channel-";

/**
 * Builds the CSS custom property name {@link channelSync} mirrors a given
 * channel's settled value onto, shared with whatever renders a group's
 * initial markup so both sides agree on the name without duplicating it.
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
 * Dispatched on a ColorSlider group's host by {@link channelSync} every
 * time any channel's thumb settles on a new value, carrying every
 * channel's current value together so a consumer can compose the full color without reading each channel's own `<input>` itself.
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
 * own track since its gradient never depends on its own value, and skipping
 * each track's own channel within `values` since a gradient only reads its own siblings.
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
 * that stays current with one another as each channel's thumb settles, by
 * mirroring every settled value onto the others via {@link colorChannelProperty}.
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
