/**
 * Sample toasts for the developer tools: one of each kind the player shows on its own (a CG, a
 * track, an encyclopedia entry, a bio section, an ending, a story notification), worded with the
 * player's labels and the novel's first declarations, so a theme's toasts can be checked at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NovelInternals } from "../novel.js";
import type { NotificationInput } from "../ui/behaviors/notifications.js";
import type { NovelLabels } from "../ui/settings.js";

import { eachDirective } from "../unlocks.js";

/** A kind of toast the player pushes by itself, which {@link sampleNotification} imitates. */
export type SampleKind = "image" | "music" | "entry" | "bio" | "ending" | "notify";

/** Every sample kind, in the order the panel offers them. */
export const SAMPLE_KINDS: readonly SampleKind[] = [
	"entry",
	"bio",
	"image",
	"music",
	"ending",
	"notify",
];

/** What a sample reads from the player: its labels and translator. */
export interface SampleSource {
	labels: NovelLabels;
	t: (key: string) => string;
}

/**
 * Builds the toast the player would push for `kind`: "New entry: <the first entry>" opening it,
 * "New entry: <the first character with a bio>" opening them, "Ending 1/<every ending>", and the
 * first `notify` line the scenes hold, or plain text when the novel declares none of them.
 *
 * @param internals - The novel, whose scenes load for the ending count and the `notify` line.
 * @param kind - The toast to imitate.
 * @param source - The player's labels and translator.
 * @returns The toast to push.
 */
export async function sampleNotification(
	internals: NovelInternals,
	kind: SampleKind,
	source: SampleSource,
): Promise<NotificationInput> {
	let { labels, t } = source;
	if (kind === "image") return { text: labels.imageUnlocked, kind };
	if (kind === "music") return { text: labels.musicUnlocked, kind };
	if (kind === "entry") {
		let entry = internals.entries.values().next().value;
		if (entry === undefined) return { text: labels.entryUnlocked, kind };
		return { text: `${labels.entryUnlocked}: ${t(entry.title)}`, kind, opens: { entry: entry.id } };
	}
	if (kind === "bio") {
		let character = [...internals.characters.values()].find((each) => each.bio !== undefined);
		if (character === undefined) return { text: labels.entryUnlocked, kind };
		return {
			text: `${labels.entryUnlocked}: ${t(character.name)}`,
			kind,
			opens: { character: character.id },
		};
	}
	let directives = await Promise.all(internals.mapped.map((scene) => internals.load(scene)));
	if (kind === "ending") {
		let endings = new Set<string>();
		for (let index of directives) {
			if (index.status === "failure") continue;
			eachDirective(index.data.module.directives, (directive) => {
				if (directive.type === "ending") endings.add(directive.key);
			});
		}
		return { text: `${labels.endingReached} 1/${Math.max(1, endings.size)}`, kind };
	}
	let key: string | undefined;
	for (let index of directives) {
		if (index.status === "failure" || key !== undefined) continue;
		eachDirective(index.data.module.directives, (directive) => {
			if (directive.type === "notify") key ??= directive.key;
		});
	}
	return key === undefined ? { text: "A story notification", kind } : { key, kind };
}
