/**
 * The contact-bait rule: scams move the conversation off the site, so they post a messaging
 * handle, a phone number or a wallet address to pay into. A phone number alone scores low, since
 * support requests carry them too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

/** A Telegram or WhatsApp link, or either app named next to a handle or number. */
const MESSAGING =
	/\b(?:t\.me|wa\.me|telegram\.me)\/\w|\b(?:telegram|whatsapp|signal|wechat|viber)\b[^.\n]{0,20}?(?:@\w{3,}|\+?\d[\d\s-]{6,})/i;

/** An international phone number: a `+`, a country code and at least eight more digits. */
const PHONE = /\+\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}\b/;

/** Ethereum-style, Bitcoin bech32 and Tron addresses. */
const WALLET = /\b0x[a-fA-F0-9]{40}\b|\bbc1[a-z0-9]{25,59}\b|\bT[1-9A-HJ-NP-Za-km-z]{33}\b/;

/**
 * Scores a messaging-app handle, an international phone number and a cryptocurrency wallet, each
 * once.
 *
 * @example contactBait({ phoneScore: 0 }) // for a form that asks for a phone number
 */
export function contactBait(options: contactBait.Options = {}): SpamCheck {
	let messagingScore = options.messagingScore ?? 4;
	let phoneScore = options.phoneScore ?? 2;
	let walletScore = options.walletScore ?? 4;

	return {
		name: "contact-bait",
		stage: "local",
		check(submission): Signal[] {
			let content = submission.content;
			let signals: Signal[] = [];
			if (MESSAGING.test(content)) {
				signals.push({
					check: "contact-bait.messaging",
					score: messagingScore,
					detail: "a messaging-app handle",
				});
			}
			if (PHONE.test(content)) {
				signals.push({ check: "contact-bait.phone", score: phoneScore, detail: "a phone number" });
			}
			if (WALLET.test(content)) {
				signals.push({
					check: "contact-bait.wallet",
					score: walletScore,
					detail: "a cryptocurrency wallet address",
				});
			}
			return signals;
		},
	};
}

/** The options {@link contactBait} takes. */
export namespace contactBait {
	/** Weights for the contact-bait rule. */
	export interface Options {
		/** @default 4 */
		messagingScore?: number;
		/** @default 2 */
		phoneScore?: number;
		/** @default 4 */
		walletScore?: number;
	}
}
