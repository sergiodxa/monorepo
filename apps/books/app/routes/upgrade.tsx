import { useMemo } from "react";
import { Form, href, redirectDocument, useNavigation, useSearchParams } from "react-router";
import { z } from "zod";
import { Product } from "~/data/product";
import polar from "~/services/polar";
import type { Route } from "./+types/upgrade";

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	let email = z.string().email().parse(formData.get("email"));
	let customers = await polar.customers.list({ email });

	// The user never purchased anything
	if (!customers.result.items[0]) {
		let url = new URL(href("/api/checkout/:type", { type: "complete" }), request.url);

		url.searchParams.set("email", email);

		return redirectDocument(url.toString());
	}

	let [customer] = customers.result.items;
	let orders = await polar.orders.list({
		customerId: customer.id,
		productId: Product.Essentials,
	});

	// The user has never purchased the Essentials package
	if (!orders.result.items[0]) {
		let url = new URL(href("/api/checkout/:type", { type: "complete" }), request.url);

		url.searchParams.set("email", email);

		return redirectDocument(url.toString());
	}

	let checkout = await polar.checkouts.create({
		customerId: customer.id,
		discountId: "e0fa5513-ad25-4140-a72a-b5d0cd88c29d",
		products: [Product.Complete],
		allowDiscountCodes: false,
	});

	return redirectDocument(checkout.url);
}

export default function Component() {
	const [searchParams] = useSearchParams();

	let navigation = useNavigation();

	const status = useMemo<"idle" | "loading">(() => {
		if (navigation.state === "submitting") return "loading";
		if (navigation.state === "loading") return "loading";
		return "idle";
	}, [navigation.state]);

	return (
		<section id="sample" className="flex flex-col gap-10 w-full max-w-5xl py-5 max-lg:px-5">
			<header className="lg:px-5 flex flex-col gap-2.5">
				<h2 className="font-serif text-3xl lg:text-4xl leading-none font-light text-balance capitalize">
					Upgrade to the Complete Package
				</h2>

				<p className="max-w-prose text-balance">
					Upgrade from "The Book" to get the "Complete Package" and access all the content,
					including the sample application, and access to the Discord community.
				</p>
			</header>

			<Form
				method="POST"
				className="flex flex-col gap-2.5 w-full max-w-xl group"
				data-status={status}
				reloadDocument
			>
				<input type="hidden" name="source" value={searchParams.get("utm_source") ?? ""} />
				<input type="hidden" name="campaign" value={searchParams.get("utm_campaign") ?? ""} />
				<input type="hidden" name="medium" value={searchParams.get("utm_medium") ?? ""} />
				<input type="hidden" name="referral" value={searchParams.get("utm_referral") ?? ""} />

				<div className="flex items-stretch gap-2.5 flex-col lg:flex-row">
					<div className="w-full">
						<label htmlFor="email" className="sr-only">
							Email address
						</label>
						<input
							id="email"
							type="email"
							name="email"
							required
							className="w-full px-5 py-2.5 rounded-xs border-2 border-stone-200 dark:border-black outline-none focus-visible:border-black placeholder-stone-500 dark:focus-visible:border-white group-data-[status=failure]:border-red-500 group-data-[status=success]:border-green-500 bg-white dark:bg-black dark:placeholder-stone-300 dark:text-stone-100"
							placeholder="user@domain.tld"
							readOnly={status !== "idle"}
						/>
					</div>

					<button
						type="submit"
						className="flex-shrink-0 px-5 py-2.5 rounded-xs relative bg-stone-950 text-stone-50 dark:bg-stone-50 dark:text-stone-950 group-data-[status=success]:bg-green-500 dark:group-data-[status=success]:bg-green-600"
						disabled={status !== "idle"}
					>
						<span className="hidden absolute inset-0 items-center justify-center group-data-[status=loading]:flex">
							<svg
								className="group-data-[status=loading]:animate-spin size-5 text-white dark:text-black"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<title>Loading...</title>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
						</span>

						<span className="group-data-[status=loading]:invisible group-data-[status=success]:invisible capitalize">
							Get Upgrade Link
						</span>
					</button>
				</div>
			</Form>
		</section>
	);
}
