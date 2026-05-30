import { Location } from "@pkg/location";
import { badRequest } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate, ValidationError } from "@pkg/validate";
import { useMemo } from "react";
import { Form, href, redirectDocument, useNavigation, useSearchParams } from "react-router";

import { Product } from "~/data/product";
import polar from "~/services/polar";

import type { Route } from "./+types/route";

import { upgradeSchema } from "./schemas.server";

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let validationResult = await validate(formData, upgradeSchema);

	if (isFailure(validationResult)) {
		let error = validationResult.error;
		if (error instanceof ValidationError && error.issues[0]) {
			return badRequest({ error: error.issues[0].message });
		}
		return badRequest({ error: "Invalid form data" });
	}

	let { email } = validationResult.data;
	let customers = await polar.customers.list({ email });

	// The user never purchased anything
	if (!customers.result.items[0]) {
		let location = new Location({
			pathname: href("/api/checkout/:type", { type: "complete" }),
			search: new URLSearchParams({ email }),
		});

		return redirectDocument(location.toString());
	}

	let [customer] = customers.result.items;
	let orders = await polar.orders.list({
		customerId: customer.id,
		productId: Product.Essentials,
	});

	// The user has never purchased the Essentials package
	if (!orders.result.items[0]) {
		let location = new Location({
			pathname: href("/api/checkout/:type", { type: "complete" }),
			search: new URLSearchParams({ email }),
		});

		return redirectDocument(location.toString());
	}

	let checkout = await polar.checkouts.create({
		customerId: customer.id,
		discountId: "e0fa5513-ad25-4140-a72a-b5d0cd88c29d",
		products: [Product.Complete],
		allowDiscountCodes: false,
	});

	return redirectDocument(checkout.url);
}

export default function Component({ actionData }: Route.ComponentProps) {
	const [searchParams] = useSearchParams();

	const navigation = useNavigation();

	const status = useMemo<"idle" | "loading" | "failure">(() => {
		if (actionData?.ok === false) return "failure";
		if (navigation.state === "submitting") return "loading";
		if (navigation.state === "loading") return "loading";
		return "idle";
	}, [navigation.state, actionData]);

	return (
		<section id="sample" className="flex w-full max-w-5xl flex-col gap-10 py-5 max-lg:px-5">
			<header className="flex flex-col gap-2.5 lg:px-5">
				<h2 className="font-serif text-3xl leading-none font-light text-balance capitalize lg:text-4xl">
					Upgrade to the Complete Package
				</h2>

				<p className="max-w-prose text-balance">
					Upgrade from "The Book" to get the "Complete Package" and access all the content,
					including the sample application, and access to the Discord community.
				</p>
			</header>

			<Form
				method="POST"
				className="group flex w-full max-w-xl flex-col gap-2.5"
				data-status={status}
				reloadDocument
			>
				<input type="hidden" name="source" value={searchParams.get("utm_source") ?? ""} />
				<input type="hidden" name="campaign" value={searchParams.get("utm_campaign") ?? ""} />
				<input type="hidden" name="medium" value={searchParams.get("utm_medium") ?? ""} />
				<input type="hidden" name="referral" value={searchParams.get("utm_referral") ?? ""} />

				<div className="flex flex-col items-stretch gap-2.5 lg:flex-row">
					<div className="w-full">
						<label htmlFor="email" className="sr-only">
							Email address
						</label>
						<input
							id="email"
							type="email"
							name="email"
							required
							aria-label="Email address"
							className="w-full rounded-xs border-2 border-stone-200 bg-white px-5 py-2.5 placeholder-stone-500 outline-none group-data-[status=failure]:border-red-500 group-data-[status=success]:border-green-500 focus-visible:border-black dark:border-black dark:bg-black dark:text-stone-100 dark:placeholder-stone-300 dark:focus-visible:border-white"
							placeholder="user@domain.tld"
							readOnly={status !== "idle"}
						/>
					</div>

					<button
						type="submit"
						className="relative shrink-0 rounded-xs bg-stone-950 px-5 py-2.5 text-stone-50 group-data-[status=success]:bg-green-500 dark:bg-stone-50 dark:text-stone-950 dark:group-data-[status=success]:bg-green-600"
						disabled={status !== "idle"}
					>
						<span className="absolute inset-0 hidden items-center justify-center group-data-[status=loading]:flex">
							<svg
								className="size-5 text-white group-data-[status=loading]:animate-spin dark:text-black"
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

						<span className="capitalize group-data-[status=loading]:invisible group-data-[status=success]:invisible">
							Get Upgrade Link
						</span>
					</button>
				</div>

				{actionData?.ok === false && (
					<p className="text-sm text-red-600 dark:text-red-400">{actionData.error}</p>
				)}
			</Form>
		</section>
	);
}
