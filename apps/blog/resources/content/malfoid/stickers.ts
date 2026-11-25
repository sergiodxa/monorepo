/**
 * Every sticker in the pack, in the order the app lists them, with the mood it belongs to and
 * the alt text that describes it. The artwork is served from `/apps/malfoid/stickers/` as WebP
 * at 240 and 480 pixels, so a tile picks the size its screen needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The six moods the pack is grouped by, in the order the app shows them. */
export const STICKER_CATEGORIES = [
	"pride-and-sarcasm",
	"anger-and-frustration",
	"tsundere-and-embarrassment",
	"happiness-and-affection",
	"sadness-and-exhaustion",
	"everyday-reactions",
] as const;

/** One of the pack's six moods. */
export type StickerCategory = (typeof STICKER_CATEGORIES)[number];

/** What a sticker shows and the mood it belongs to. */
export interface StickerEntry {
	category: StickerCategory;
	alt: string;
}

/** All 60 stickers by file name, ten per mood, in the app's order. */
export const STICKER_CATALOG = {
	smug: { category: "pride-and-sarcasm", alt: "Malfoid smiles smugly with her arms crossed." },
	"superior-look": {
		category: "pride-and-sarcasm",
		alt: "Malfoid gives a superior look with her chin raised.",
	},
	"eye-roll": { category: "pride-and-sarcasm", alt: "Malfoid rolls her eyes in exasperation." },
	"disappointed-stare": {
		category: "pride-and-sarcasm",
		alt: "Malfoid gives a disappointed stare.",
	},
	"judging-you": {
		category: "pride-and-sarcasm",
		alt: "Malfoid points at you with a judging look.",
	},
	"sarcastic-applause": { category: "pride-and-sarcasm", alt: "Malfoid claps sarcastically." },
	"arms-crossed": {
		category: "pride-and-sarcasm",
		alt: "Malfoid stands stubbornly with her arms crossed.",
	},
	"dismissive-look-away": {
		category: "pride-and-sarcasm",
		alt: "Malfoid looks away dismissively and raises a hand.",
	},
	"condescending-laugh": {
		category: "pride-and-sarcasm",
		alt: "Malfoid covers her mouth while laughing condescendingly.",
	},
	unimpressed: {
		category: "pride-and-sarcasm",
		alt: "Malfoid rests her cheek on her hand, unimpressed.",
	},
	"angry-pout": {
		category: "anger-and-frustration",
		alt: "Malfoid puffs out her cheeks in an angry pout.",
	},
	furious: { category: "anger-and-frustration", alt: "Malfoid clenches her fists, furious." },
	screaming: {
		category: "anger-and-frustration",
		alt: "Malfoid cups her hands around her mouth and screams.",
	},
	stomping: { category: "anger-and-frustration", alt: "Malfoid stomps her foot angrily." },
	"extremely-annoyed": {
		category: "anger-and-frustration",
		alt: "Malfoid pinches the bridge of her nose, extremely annoyed.",
	},
	facepalm: {
		category: "anger-and-frustration",
		alt: "Malfoid covers her forehead with her palm in frustration.",
	},
	"silent-rage": {
		category: "anger-and-frustration",
		alt: "Malfoid stares in silent rage with her hands clasped.",
	},
	"death-stare": {
		category: "anger-and-frustration",
		alt: "Malfoid gives an intense angry glare.",
	},
	tantrum: {
		category: "anger-and-frustration",
		alt: "Malfoid throws a tantrum, kicking and waving her fists.",
	},
	offended: {
		category: "anger-and-frustration",
		alt: "Malfoid presses a hand to her chest, completely offended.",
	},
	blushing: {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid blushes and touches her fingertips together shyly.",
	},
	"blushing-look-away": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid looks away while blushing shyly.",
	},
	"pretending-not-to-care": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid blushes while pretending not to care.",
	},
	"hiding-smile": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid hides a pleased smile behind her sleeve.",
	},
	"embarrassed-panic": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid waves her hands in embarrassed panic.",
	},
	"covering-face": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid covers her blushing face with both hands.",
	},
	"offering-heart": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid reluctantly offers a heart while blushing.",
	},
	"blushing-arms-crossed": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid blushes with her arms crossed.",
	},
	jealous: {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid sulks jealously with a sideways glance.",
	},
	"secretly-happy": {
		category: "tsundere-and-embarrassment",
		alt: "Malfoid tries to hide how happy she is.",
	},
	"genuine-smile": {
		category: "happiness-and-affection",
		alt: "Malfoid smiles warmly and sincerely.",
	},
	laughing: { category: "happiness-and-affection", alt: "Malfoid laughs joyfully." },
	excited: { category: "happiness-and-affection", alt: "Malfoid jumps with excitement." },
	"sparkling-eyes": {
		category: "happiness-and-affection",
		alt: "Malfoid clasps her hands with sparkling eyes.",
	},
	"sending-kiss": { category: "happiness-and-affection", alt: "Malfoid winks and blows a kiss." },
	"hugging-heart": { category: "happiness-and-affection", alt: "Malfoid hugs a large pink heart." },
	celebrating: {
		category: "happiness-and-affection",
		alt: "Malfoid raises both arms to celebrate.",
	},
	"thumbs-up": {
		category: "happiness-and-affection",
		alt: "Malfoid smiles and gives a thumbs-up.",
	},
	"proud-of-you": {
		category: "happiness-and-affection",
		alt: "Malfoid smiles proudly and offers encouragement.",
	},
	"asking-for-hug": {
		category: "happiness-and-affection",
		alt: "Malfoid opens her arms, asking for a hug.",
	},
	crying: { category: "sadness-and-exhaustion", alt: "Malfoid wipes away tears as she cries." },
	"dramatic-crying": {
		category: "sadness-and-exhaustion",
		alt: "Malfoid wails with dramatic streams of tears.",
	},
	"sad-pout": { category: "sadness-and-exhaustion", alt: "Malfoid makes a sad little pout." },
	disappointed: {
		category: "sadness-and-exhaustion",
		alt: "Malfoid sits with slumped shoulders, disappointed.",
	},
	exhausted: { category: "sadness-and-exhaustion", alt: "Malfoid droops with exhaustion." },
	sleeping: { category: "sadness-and-exhaustion", alt: "Malfoid sleeps curled up peacefully." },
	bored: { category: "sadness-and-exhaustion", alt: "Malfoid yawns with boredom." },
	"emotionally-defeated": {
		category: "sadness-and-exhaustion",
		alt: "Malfoid slumps down, emotionally defeated.",
	},
	"under-blanket": {
		category: "sadness-and-exhaustion",
		alt: "Malfoid hides beneath an emerald blanket.",
	},
	"seeking-comfort": {
		category: "sadness-and-exhaustion",
		alt: "Malfoid hugs a cushion, seeking comfort.",
	},
	confused: { category: "everyday-reactions", alt: "Malfoid tilts her head in confusion." },
	shocked: {
		category: "everyday-reactions",
		alt: "Malfoid gasps in shock with her hands on her cheeks.",
	},
	suspicious: { category: "everyday-reactions", alt: "Malfoid looks sideways suspiciously." },
	thinking: {
		category: "everyday-reactions",
		alt: "Malfoid rests a finger on her chin, thinking.",
	},
	"waving-hello": {
		category: "everyday-reactions",
		alt: "Malfoid waves hello with a cheerful smile.",
	},
	"waving-goodbye": { category: "everyday-reactions", alt: "Malfoid gives a gentle goodbye wave." },
	"eating-popcorn": {
		category: "everyday-reactions",
		alt: "Malfoid eats popcorn while watching with amusement.",
	},
	"using-phone": {
		category: "everyday-reactions",
		alt: "Malfoid checks her phone with an amused smile.",
	},
	"holding-tea": {
		category: "everyday-reactions",
		alt: "Malfoid calmly holds a cup of tea and saucer.",
	},
	"dramatic-thumbs-down": {
		category: "everyday-reactions",
		alt: "Malfoid gives a dramatic thumbs-down.",
	},
} as const satisfies Record<string, StickerEntry>;

/** A sticker's file name without its size or extension. */
export type StickerId = keyof typeof STICKER_CATALOG;

/** One sticker with its id, as the gallery lists it. */
export interface Sticker extends StickerEntry {
	id: StickerId;
}

/** Every sticker in the app's order. */
export const STICKERS: ReadonlyArray<Sticker> = Object.entries(STICKER_CATALOG).map(
	([id, entry]) => ({ id: id as StickerId, ...entry }),
);
