/**
 * Answers whether a `User-Agent` names automated software: a crawler, a link-preview fetcher,
 * an uptime monitor, a headless browser or a bare HTTP library. Such clients keep no cookies, so
 * a caller skips per-visitor work such as session writes for them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Tokens automated clients put in their `User-Agent`, matched case-insensitively. The generic
 * words cover most crawlers; the named ones are link-preview fetchers and tools whose header
 * carries none of them.
 */
const BOT_PATTERN = new RegExp(
	[
		"bot\\b",
		"bot/",
		"bot-",
		"crawl",
		"spider",
		"slurp",
		"scraper",
		"preview",
		"fetcher",
		"monitor",
		"headless",
		"phantomjs",
		"lighthouse",
		"facebookexternalhit",
		"facebookcatalog",
		"meta-externalagent",
		"slack-imgproxy",
		"slackbot",
		"whatsapp",
		"telegrambot",
		"discordbot",
		"skypeuripreview",
		"embedly",
		"vkshare",
		"bitlybot",
		"redditbot",
		"mastodon",
		"pleroma",
		"misskey",
		"feedfetcher",
		"feedly",
		"newsblur",
		"inoreader",
		"curl/",
		"wget/",
		"python-requests",
		"python-urllib",
		"aiohttp",
		"httpx",
		"go-http-client",
		"okhttp",
		"java/",
		"apache-httpclient",
		"node-fetch",
		"undici",
		"axios/",
		"libwww-perl",
		"postmanruntime",
		"insomnia",
		"pingdom",
		"uptimerobot",
		"statuscake",
		"site24x7",
		"chrome-lighthouse",
		"google-inspectiontool",
		"googleother",
		"google-read-aloud",
		"mediapartners-google",
		"adsbot",
		"apis-google",
		"gptbot",
		"chatgpt-user",
		"claudebot",
		"claude-web",
		"anthropic-ai",
		"perplexity",
		"bytespider",
		"ccbot",
		"amazonbot",
		"baiduspider",
		"petalbot",
		"semrush",
		"ahrefs",
		"mj12bot",
		"dotbot",
	].join("|"),
	"i",
);

/**
 * Whether the header names automated software. An empty or whitespace-only header counts as a
 * bot, since every browser sends one.
 *
 * @param header - The raw `User-Agent` header value.
 * @example isBot(request.headers.get("user-agent") ?? "")
 */
export function isBot(header: string): boolean {
	if (header.trim() === "") return true;
	return BOT_PATTERN.test(header);
}
