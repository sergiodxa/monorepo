import { z } from "zod/v4";

const BASE_URL = new URL("https://cloudflare-dns.com/dns-query");

const Schema = z.object({
	Answer: z
		.object({
			name: z.string(),
			type: z.number(),
			TTL: z.number(),
			data: z.string(),
		})
		.array()
		.optional(),
});

export async function dnsLookup(domain: string, expectedValue: string) {
	let url = new URL(BASE_URL);
	url.searchParams.set("name", `_ping-verification.${domain}`);
	url.searchParams.set("type", "TXT");

	let response = await fetch(url, {
		headers: { accept: "application/dns-json" },
	});

	if (!response.ok) throw new Error(`Error fetching DNS: ${response.status}`);

	let unparsedBody = await response.json();

	console.debug("Unparsed DNS lookup response", unparsedBody);

	let body = Schema.parse(unparsedBody);

	console.debug("Parsed DNS lookup response", body);

	if (!body.Answer) return false;

	return body.Answer.some((r) => r.data === JSON.stringify(`ping_${expectedValue}`));
}
