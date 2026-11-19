/**
 * The emoji a chat's picker offers by default, each with the English name its filter matches
 * and its button announces, in the groups the picker draws under headings. A small common
 * set keeps the picker light; an app passes its own list for more or for other languages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One emoji the picker offers. Plain data, since the list crosses into the browser. */
export type EmojiEntry = {
	/** The emoji itself, which is what gets inserted or submitted. */
	char: string;
	/** What the filter matches and the button announces, such as "thumbs up". */
	name: string;
	/** The heading it is listed under; groups show in the order they first appear. */
	group: string;
};

/** The default set: about ninety common emoji under Smileys, People, Nature, Food, Objects and Symbols. */
export const EMOJI: readonly EmojiEntry[] = [
	{ char: "😀", name: "grinning face", group: "Smileys" },
	{ char: "😃", name: "smiling face with big eyes", group: "Smileys" },
	{ char: "😄", name: "smiling face with smiling eyes", group: "Smileys" },
	{ char: "😁", name: "beaming face", group: "Smileys" },
	{ char: "😆", name: "laughing face", group: "Smileys" },
	{ char: "😅", name: "sweat smile", group: "Smileys" },
	{ char: "😂", name: "tears of joy", group: "Smileys" },
	{ char: "🙂", name: "slightly smiling face", group: "Smileys" },
	{ char: "😉", name: "winking face", group: "Smileys" },
	{ char: "😊", name: "blushing face", group: "Smileys" },
	{ char: "😍", name: "heart eyes", group: "Smileys" },
	{ char: "😘", name: "face blowing a kiss", group: "Smileys" },
	{ char: "😋", name: "yummy face", group: "Smileys" },
	{ char: "😎", name: "cool face with sunglasses", group: "Smileys" },
	{ char: "🤔", name: "thinking face", group: "Smileys" },
	{ char: "🤨", name: "raised eyebrow", group: "Smileys" },
	{ char: "😐", name: "neutral face", group: "Smileys" },
	{ char: "🙄", name: "rolling eyes", group: "Smileys" },
	{ char: "😴", name: "sleeping face", group: "Smileys" },
	{ char: "😮", name: "surprised face", group: "Smileys" },
	{ char: "😢", name: "crying face", group: "Smileys" },
	{ char: "😭", name: "loudly crying face", group: "Smileys" },
	{ char: "😡", name: "angry face", group: "Smileys" },
	{ char: "🤯", name: "mind blown", group: "Smileys" },
	{ char: "🥳", name: "party face", group: "Smileys" },
	{ char: "🫠", name: "melting face", group: "Smileys" },
	{ char: "👍", name: "thumbs up", group: "People" },
	{ char: "👎", name: "thumbs down", group: "People" },
	{ char: "👏", name: "clapping hands", group: "People" },
	{ char: "🙌", name: "raising hands", group: "People" },
	{ char: "🙏", name: "folded hands thanks", group: "People" },
	{ char: "👋", name: "waving hand", group: "People" },
	{ char: "🤝", name: "handshake", group: "People" },
	{ char: "✌️", name: "victory hand", group: "People" },
	{ char: "🤞", name: "crossed fingers", group: "People" },
	{ char: "👌", name: "ok hand", group: "People" },
	{ char: "💪", name: "flexed biceps", group: "People" },
	{ char: "👀", name: "eyes", group: "People" },
	{ char: "🫡", name: "saluting face", group: "People" },
	{ char: "🤷", name: "person shrugging", group: "People" },
	{ char: "🙋", name: "person raising hand", group: "People" },
	{ char: "🐶", name: "dog face", group: "Nature" },
	{ char: "🐱", name: "cat face", group: "Nature" },
	{ char: "🦊", name: "fox", group: "Nature" },
	{ char: "🐼", name: "panda", group: "Nature" },
	{ char: "🐢", name: "turtle", group: "Nature" },
	{ char: "🦄", name: "unicorn", group: "Nature" },
	{ char: "🐝", name: "honeybee", group: "Nature" },
	{ char: "🌱", name: "seedling", group: "Nature" },
	{ char: "🌵", name: "cactus", group: "Nature" },
	{ char: "🌸", name: "cherry blossom", group: "Nature" },
	{ char: "🌻", name: "sunflower", group: "Nature" },
	{ char: "🌈", name: "rainbow", group: "Nature" },
	{ char: "☀️", name: "sun", group: "Nature" },
	{ char: "🌙", name: "crescent moon", group: "Nature" },
	{ char: "❄️", name: "snowflake", group: "Nature" },
	{ char: "☕", name: "hot coffee", group: "Food" },
	{ char: "🍵", name: "tea", group: "Food" },
	{ char: "🍕", name: "pizza", group: "Food" },
	{ char: "🍔", name: "hamburger", group: "Food" },
	{ char: "🌮", name: "taco", group: "Food" },
	{ char: "🍣", name: "sushi", group: "Food" },
	{ char: "🍩", name: "doughnut", group: "Food" },
	{ char: "🍪", name: "cookie", group: "Food" },
	{ char: "🎂", name: "birthday cake", group: "Food" },
	{ char: "🍎", name: "red apple", group: "Food" },
	{ char: "🥑", name: "avocado", group: "Food" },
	{ char: "🍺", name: "beer", group: "Food" },
	{ char: "🍷", name: "wine glass", group: "Food" },
	{ char: "💻", name: "laptop", group: "Objects" },
	{ char: "📱", name: "mobile phone", group: "Objects" },
	{ char: "📎", name: "paperclip", group: "Objects" },
	{ char: "📌", name: "pushpin", group: "Objects" },
	{ char: "📅", name: "calendar", group: "Objects" },
	{ char: "📝", name: "memo", group: "Objects" },
	{ char: "📦", name: "package", group: "Objects" },
	{ char: "🔑", name: "key", group: "Objects" },
	{ char: "🔒", name: "lock", group: "Objects" },
	{ char: "💡", name: "light bulb idea", group: "Objects" },
	{ char: "🎉", name: "party popper tada", group: "Objects" },
	{ char: "🚀", name: "rocket", group: "Objects" },
	{ char: "🐛", name: "bug", group: "Objects" },
	{ char: "❤️", name: "red heart", group: "Symbols" },
	{ char: "💯", name: "hundred points", group: "Symbols" },
	{ char: "🔥", name: "fire", group: "Symbols" },
	{ char: "✨", name: "sparkles", group: "Symbols" },
	{ char: "⭐", name: "star", group: "Symbols" },
	{ char: "✅", name: "check mark", group: "Symbols" },
	{ char: "❌", name: "cross mark", group: "Symbols" },
	{ char: "⚠️", name: "warning", group: "Symbols" },
	{ char: "❓", name: "question mark", group: "Symbols" },
	{ char: "➕", name: "plus", group: "Symbols" },
	{ char: "👉", name: "pointing right", group: "Symbols" },
];

/**
 * The entries whose name holds every word of `query`, in the list's order, ignoring case;
 * an entry also matches its own character. An empty query keeps the whole list.
 *
 * @param emoji The list to filter.
 * @param query What the reader typed in the filter.
 * @returns The matching entries.
 * @example filterEmoji(EMOJI, "thumbs") // [👍 thumbs up, 👎 thumbs down]
 */
export function filterEmoji(emoji: readonly EmojiEntry[], query: string): EmojiEntry[] {
	let words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [...emoji];
	return emoji.filter((entry) => {
		let name = entry.name.toLowerCase();
		return entry.char === query.trim() || words.every((word) => name.includes(word));
	});
}
