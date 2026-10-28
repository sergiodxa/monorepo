/**
 * Router integration: middleware that publishes one {@link Seller} as `ctx.x402`,
 * and a per-route guard that collects payment before the handler runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { PaymentReceipt, ResourceInfo, SettleResponse } from "./types.js";

import { PAYMENT_RESPONSE, encodePaymentResponse } from "./headers.js";
import { Seller, type PriceRequest, type SellerConfig } from "./seller.js";

/**
 * Declared in an imported module, so a project types `ctx.x402` by importing this middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Collects payment for priced routes on this seller. */
		x402: Seller;
		/** Receipt set after {@link requirePayment} settles a request. */
		payment?: PaymentReceipt;
	}
}

/**
 * The published seller, for code that reads it by key rather than `ctx.x402`.
 */
export const X402Key: { defaultValue?: Seller } = createContextKey<Seller>();

/**
 * The payment receipt for the current request, when a guard collected one.
 */
export const PaymentReceiptKey: { defaultValue?: PaymentReceipt } =
	createContextKey<PaymentReceipt>();

/**
 * Publishes a {@link Seller} as `ctx.x402`. Build the seller once per isolate.
 *
 * @param config - Facilitator and receive wallet
 * @returns Middleware that sets `ctx.x402` before the handler runs
 */
export function x402(
	config: SellerConfig,
): Middleware<{ key: typeof X402Key; value: Seller; property: "x402" }> {
	let seller = new Seller(config);
	return (ctx, next) => {
		ctx.set(X402Key, seller, { property: "x402" });
		return next();
	};
}

/** Options for {@link requirePayment}. */
export interface RequirePaymentOptions {
	/** Atomic amount to charge. */
	amount: string;
	/** Description stamped on the 402 resource. */
	description: string;
	/** Response media type when known. @default "application/json" */
	mimeType?: string;
	/**
	 * Builds the resource URL from the request; defaults to the request URL without
	 * the query string so catalog clients can match by path.
	 */
	resourceUrl?: (ctx: RequestContext) => string;
	/** Optional scheme extras. */
	extra?: Record<string, unknown>;
	/** Optional protocol extensions stamped on the 402 (for example Bazaar). */
	extensions?: Record<string, unknown>;
}

/**
 * Guards a route: missing or invalid payment answers 402; a settled payment
 * continues with `ctx.payment` set and `PAYMENT-RESPONSE` on the eventual response.
 *
 * @param options - Price and resource description
 * @returns Middleware that collects payment before `next`
 */
export function requirePayment(options: RequirePaymentOptions): Middleware {
	return async (ctx, next) => {
		let seller = ctx.x402;

		let resource: ResourceInfo = {
			url: options.resourceUrl?.(ctx) ?? stripQuery(ctx.url.href),
			description: options.description,
			mimeType: options.mimeType ?? "application/json",
		};
		let price: PriceRequest = {
			amount: options.amount,
			resource,
			extra: options.extra,
			extensions: options.extensions,
		};

		let collected = await seller.collect(ctx.request, price);
		if (isFailure(collected)) {
			return seller.challenge(price, collected.error.message);
		}

		ctx.set(PaymentReceiptKey, collected.data, { property: "payment" });

		let response = await next();
		let settlement: SettleResponse = {
			success: true,
			payer: collected.data.payer,
			transaction: collected.data.transaction,
			network: collected.data.network,
			amount: collected.data.amount,
		};
		let headers = new Headers(response.headers);
		headers.set(PAYMENT_RESPONSE, encodePaymentResponse(settlement));
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * Drops the query string so payment requirements name a stable resource URL.
 *
 * @param href - Absolute URL
 */
function stripQuery(href: string): string {
	let url = new URL(href);
	url.search = "";
	url.hash = "";
	return url.href;
}
