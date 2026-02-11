import {
	BoxIcon,
	CheckCircleIcon,
	CreditCardIcon,
	DollarSignIcon,
	PackageIcon,
	ShoppingCartIcon,
	TruckIcon,
	ZapIcon,
} from "lucide-react";
import { useRouteLoaderData } from "react-router";

import {
	LandingFAQ,
	LandingFeatures,
	LandingFinalCTA,
	LandingHero,
	LandingHowItWorks,
	LandingTrustIndicators,
} from "~/components/landing";

import type { loader as landingLoader } from "./_landing";

export function meta() {
	return [
		{ title: "E-commerce Monitoring | Protect Your Revenue with Uptime" },
		{
			name: "description",
			content:
				"Monitor checkout flows, payment APIs, and product pages. Catch issues before they cost you sales. Usage-based pricing for stores of all sizes.",
		},
	];
}

export default function UseCasesEcommercePage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="E-commerce Monitoring"
				title={
					<>
						Protect your <strong className="text-primary-600 dark:text-primary-400">revenue</strong>
					</>
				}
				description="Monitor checkout flows, payment APIs, and product pages. Catch issues before they cost you sales."
				highlights={["Checkout monitoring", "Payment API checks", "Revenue protection"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <ShoppingCartIcon className="size-6" />,
						value: "Checkout",
						label: "Monitoring",
					},
					{
						icon: <CreditCardIcon className="size-6" />,
						value: "Payment",
						label: "APIs",
					},
					{
						icon: <ZapIcon className="size-6" />,
						value: "<1s",
						label: "Alerts",
					},
					{
						icon: <DollarSignIcon className="size-6" />,
						value: "Revenue",
						label: "Protected",
					},
				]}
			/>

			<LandingFeatures
				title="Monitor your revenue-critical paths"
				description="Comprehensive monitoring for e-commerce stores"
				features={[
					{
						icon: <ShoppingCartIcon className="size-6" />,
						title: "Checkout flow monitoring",
						description: "Ensure your cart and checkout process works 24/7.",
					},
					{
						icon: <CreditCardIcon className="size-6" />,
						title: "Payment gateway checks",
						description: "Monitor Stripe, PayPal, or custom payment endpoints.",
					},
					{
						icon: <PackageIcon className="size-6" />,
						title: "Product page availability",
						description: "Keep product and category pages accessible.",
					},
					{
						icon: <BoxIcon className="size-6" />,
						title: "Inventory API monitoring",
						description: "Ensure stock levels sync correctly.",
					},
					{
						icon: <TruckIcon className="size-6" />,
						title: "Cart API health",
						description: "Monitor add-to-cart and cart retrieval endpoints.",
					},
					{
						icon: <CheckCircleIcon className="size-6" />,
						title: "Order confirmation",
						description: "Verify order processing and confirmation pages work.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Start protecting your sales"
				description="Get comprehensive e-commerce monitoring in three steps"
				steps={[
					{
						title: "Identify revenue-critical paths",
						description: "Map checkout, payment, and product endpoints.",
					},
					{
						title: "Create monitors",
						description: "Set up checks for each critical e-commerce flow.",
					},
					{
						title: "Get instant alerts",
						description: "Know immediately when something affects sales.",
					},
				]}
			/>

			<LandingFAQ
				title="E-commerce monitoring FAQ"
				description="Common questions about monitoring online stores"
				items={[
					{
						question: "What e-commerce endpoints should I monitor?",
						answer: "Checkout, payment callbacks, product pages, cart API, inventory sync.",
					},
					{
						question: "Can I monitor third-party payment providers?",
						answer:
							"Yes, monitor your payment endpoint responses. For provider status, check their status pages.",
					},
					{
						question: "How quickly will I know about checkout issues?",
						answer: "Alerts are sent within seconds of detecting a failure.",
					},
					{
						question: "Do you support monitoring authenticated endpoints?",
						answer: "Yes, add custom headers for authentication tokens.",
					},
					{
						question: "Can I monitor multiple storefronts?",
						answer: "Yes, create separate monitors for each store or region.",
					},
					{
						question: "What about Shopify/WooCommerce/etc?",
						answer: "Monitor any HTTP endpoint, regardless of platform.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Don't lose sales to downtime"
				description="Monitor your e-commerce critical paths and catch issues before customers do."
			/>
		</>
	);
}
