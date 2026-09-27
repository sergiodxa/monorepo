/**
 * Disposable-domain detection against the bundled disposable-email-domains blocklist.
 * The list ships as one string and becomes a set on the first lookup, so importing this
 * module costs a Worker's startup nothing beyond reading the string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { EmailAddress } from "./parse.js";

import { DISPOSABLE_DOMAINS } from "./disposable-domains.js";

/** The failure `checkDisposable` returns; `domain` is the listed entry the address matched. */
export class DisposableDomainError extends Error {
	override name = "DisposableDomainError";

	readonly reason = "disposable-domain";

	readonly domain: string;

	/** @param domain - The listed domain the address's domain equals or sits under. */
	constructor(domain: string) {
		super(`${domain} is a disposable email domain`);
		this.domain = domain;
	}
}

/** The decoded list, built once per isolate on the first call. */
const disposableDomains = memoize(() => new Set(DISPOSABLE_DOMAINS.trim().split("\n")));

/**
 * The listed domain `domain` equals or is a subdomain of, so `x.mailinator.com` finds
 * `mailinator.com`. A top-level label alone never matches.
 *
 * @param domain - An ASCII domain; case and one trailing dot are ignored.
 * @returns The matching list entry, or `null` when the domain is not listed.
 */
export function findDisposableDomain(domain: string): string | null {
	let labels = domain.toLowerCase().replace(/\.$/, "").split(".");
	let listed = disposableDomains();

	for (let start = 0; start < labels.length - 1; start++) {
		let candidate = labels.slice(start).join(".");
		if (listed.has(candidate)) return candidate;
	}

	return null;
}

/**
 * Whether `domain` is, or sits under, a disposable domain. Takes the ASCII form
 * `parseEmailAddress` and `normalizeDomain` return; an IDN in Unicode form never matches.
 *
 * @param domain - An ASCII domain; case and one trailing dot are ignored.
 */
export function isDisposableDomain(domain: string): boolean {
	return findDisposableDomain(domain) !== null;
}

/**
 * Refuses an address on a disposable domain, passing any other address through
 * unchanged so checks chain.
 *
 * @param address - A parsed address.
 * @returns The same address, or the listed domain it matched.
 */
export function checkDisposable(
	address: EmailAddress,
): Result<EmailAddress, DisposableDomainError> {
	let listed = findDisposableDomain(address.domain);
	return listed === null ? success(address) : failure(new DisposableDomainError(listed));
}

/**
 * Defers `compute` to its first call and returns that value on every later one.
 *
 * @template T - The computed value.
 */
function memoize<T>(compute: () => T): () => T {
	let cache: { value: T } | null = null;
	return () => {
		cache ??= { value: compute() };
		return cache.value;
	};
}
