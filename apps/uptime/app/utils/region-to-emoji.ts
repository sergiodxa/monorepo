export default function regionToEmoji(locationHint: DurableObjectLocationHint) {
	if (locationHint === "afr") return "🦁"; // Africa
	if (locationHint === "apac") return "🐉"; // Asia-Pacific
	if (locationHint === "eeur") return "🐻"; // Eastern Europe
	if (locationHint === "enam") return "🦅"; // Eastern North America
	if (locationHint === "me") return "🐫"; // Middle East
	if (locationHint === "oc") return "🐨"; // Oceania
	if (locationHint === "sam") return "🦙"; // South America
	if (locationHint === "weur") return "🦊"; // Western Europe
	if (locationHint === "wnam") return "🦬"; // Western North America
	return "🌍"; // Default to Earth emoji if no match
}
