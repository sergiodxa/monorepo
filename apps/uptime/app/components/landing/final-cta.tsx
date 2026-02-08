import { ArrowRightIcon } from "lucide-react";
import { href, Link } from "react-router";

interface LandingFinalCTAProps {
	isSignedIn: boolean;
	title: string;
	description: string;
	ctaIn?: string;
	ctaOut?: string;
}

export function LandingFinalCTA({
	isSignedIn,
	title,
	description,
	ctaIn = "Open Dashboard",
	ctaOut = "Start Monitoring",
}: LandingFinalCTAProps) {
	return (
		<section className="bg-gradient-to-r from-primary-600 to-primary-700 py-16 sm:py-24">
			<div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
				<h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
				<p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">{description}</p>
				<Link
					to={isSignedIn ? href("/app") : href("/auth")}
					reloadDocument={!isSignedIn}
					className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-primary-600 shadow-lg transition hover:bg-primary-50 hover:shadow-xl"
				>
					{isSignedIn ? ctaIn : ctaOut}
					<ArrowRightIcon className="size-5" />
				</Link>
			</div>
		</section>
	);
}
