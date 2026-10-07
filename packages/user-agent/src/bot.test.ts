/**
 * Tests for `isBot`: crawlers, link-preview fetchers, headless browsers, HTTP libraries and an
 * empty header read as bots, while the browsers people use, on every form factor, do not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isBot } from "./bot.js";

describe(isBot, () => {
	test.each([
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
		"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
		"Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
		"Slack-ImgProxy (+https://api.slack.com/robots)",
		"Twitterbot/1.0",
		"LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
		"WhatsApp/2.23.20.0 A",
		"TelegramBot (like TwitterBot)",
		"Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
		"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
		"Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)",
		"curl/8.4.0",
		"python-requests/2.31.0",
		"Go-http-client/2.0",
		"",
		"   ",
	])("%j is a bot", (header) => {
		expect(isBot(header)).toBe(true);
	});

	test.each([
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
		"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
	])("%j is a person's browser", (header) => {
		expect(isBot(header)).toBe(false);
	});
});
