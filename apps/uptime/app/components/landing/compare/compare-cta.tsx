/**
 * Renders the closing call-to-action band for a comparison page, prompting visitors to
 * switch from the named competitor with a primary CTA that adapts to the signed-in
 * state and reassurance badges. It exists to convert readers at the end of each versus
 * page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { href, Link } from "react-router";

interface CompareCTAProps {
	isSignedIn: boolean;
	competitor: string;
}

export function CompareCTA({ isSignedIn, competitor }: CompareCTAProps) {
	return (
		<section className="bg-gradient-to-r from-primary-600 to-primary-700 py-16 sm:py-24">
			<div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
				<h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
					Ready to switch from {competitor}?
				</h2>
				<p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
					Join thousands of teams who chose simplicity over complexity. Start monitoring in minutes,
					not hours.
				</p>

				<div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
					<Link
						to={isSignedIn ? href("/app") : href("/auth")}
						reloadDocument={!isSignedIn}
						className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-primary-600 shadow-lg transition hover:bg-primary-50 hover:shadow-xl"
					>
						{isSignedIn ? "Open Dashboard" : "Start Free Trial"}
						<ArrowRightIcon className="size-5" />
					</Link>
				</div>

				<div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-100">
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-primary-200" />
						<span>No credit card required</span>
					</div>
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-primary-200" />
						<span>Free manual pings</span>
					</div>
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-primary-200" />
						<span>2 minute setup</span>
					</div>
				</div>
			</div>
		</section>
	);
}
