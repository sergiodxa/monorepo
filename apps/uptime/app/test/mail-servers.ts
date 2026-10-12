/**
 * Test helper answering the DNS-over-HTTPS lookups the mail-server check makes: every
 * domain receives mail unless a test names it otherwise, so a form test states only the
 * domains its case is about and every lookup it triggers stays on MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CLOUDFLARE } from "@sdxc/doh";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

/** What a domain's lookups answer: mail hosts, no mail host at all, or a resolver failure. */
export type MailServerAnswer = "receives-mail" | "no-mail-server" | "lookup-failed";

/** The IANA codes of the record types the mail-server check asks for. */
const TYPE_CODES: Record<string, number> = { A: 1, MX: 15, AAAA: 28 };

/** A scripted resolver, plus the domains each test asked it about. */
export interface MailServerDns {
	/** Answers `domain`'s lookups this way until the test ends. */
	answer(domain: string, answer: MailServerAnswer): void;
	/** Every domain an MX lookup asked about, in order. */
	readonly asked: string[];
}

/**
 * Starts an MSW server for the file and resets its answers after every test. Requests to
 * any other host fail the test, so an unexpected outbound call is visible.
 *
 * @returns The resolver the file's tests script.
 * @example let dns = useMailServerDns(); dns.answer("nomail.example", "no-mail-server");
 */
export function useMailServerDns(): MailServerDns {
	let answers = new Map<string, MailServerAnswer>();
	let asked: string[] = [];

	let server = setupServer(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let url = new URL(request.url);
			let name = url.searchParams.get("name") ?? "";
			let type = url.searchParams.get("type") ?? "";
			if (type === "MX") asked.push(name);

			let answer = answers.get(name) ?? "receives-mail";
			if (answer === "lookup-failed") return new HttpResponse("{}", { status: 502 });

			let records = answer === "receives-mail" && type === "MX" ? [`10 mx.${name}.`] : [];
			let code = TYPE_CODES[type] ?? 0;
			return HttpResponse.json({
				Status: 0,
				Question: [{ name, type: code }],
				Answer: records.map((data) => ({ name: `${name}.`, type: code, TTL: 300, data })),
			});
		}),
	);

	beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
	afterEach(() => {
		answers.clear();
		asked.length = 0;
	});
	afterAll(() => server.close());

	return {
		answer: (domain, answer) => void answers.set(domain, answer),
		asked,
	};
}
