import { useMemo } from "react";
import { useFetcher, useSearchParams } from "react-router";

import type { action } from "./api.subscribe";

export default function Home() {
	return (
		<div className="flex w-full max-w-5xl flex-col gap-10 py-5">
			<header className="flex max-w-prose flex-col gap-5 px-5 font-serif">
				<h1 className="text-3xl leading-none font-light text-balance lg:text-4xl">
					React Router OAuth2 Handbook
				</h1>

				<p className="text-lg">
					A practical, modern guide to implementing{" "}
					<strong className="font-semibold">OAuth2 authentication</strong> in React Router and Remix
					apps—built on patterns you can apply to any web application.
				</p>
			</header>

			<SubscribeForm title="Get early access & special pricing" label="Email Address" />
		</div>
	);
}

type SubscribeFormStatus = "idle" | "loading" | "success" | "failure";

type SubscribeFormProps = {
	title: string;
	label: string;
};

function SubscribeForm({ title, label }: SubscribeFormProps) {
	const [searchParams] = useSearchParams();
	const fetcher = useFetcher<typeof action>();

	const status = useMemo<SubscribeFormStatus>(() => {
		if (fetcher.state === "submitting") return "loading";
		if (fetcher.state === "loading") return "loading";
		// if (fetcher.data?.ok === true) return "success";
		if (fetcher.data?.ok === false) return "failure";
		return "idle";
	}, [fetcher.state, fetcher.data]);

	return (
		<fetcher.Form
			method="POST"
			action="/api/subscribe"
			className="group flex w-full max-w-xl flex-col gap-2.5"
			data-status={status}
		>
			<input type="hidden" name="source" value={searchParams.get("utm_source") ?? ""} />
			<input type="hidden" name="campaign" value={searchParams.get("utm_campaign") ?? ""} />
			<input type="hidden" name="medium" value={searchParams.get("utm_medium") ?? ""} />
			<input type="hidden" name="referral" value={searchParams.get("utm_referral") ?? ""} />

			<h2 className="px-5 text-base font-semibold">{title}</h2>

			<div className="flex flex-col items-stretch gap-2.5 max-lg:px-5 lg:flex-row">
				<div className="w-full">
					<label htmlFor="email" className="sr-only">
						{label}
					</label>
					<input
						id="email"
						type="email"
						name="email"
						required
						className="w-full rounded-xs border-2 border-stone-200 bg-white px-5 py-2.5 placeholder-stone-500 outline-none group-data-[status=failure]:border-red-500 group-data-[status=success]:border-green-500 focus-visible:border-black dark:border-stone-800 dark:bg-black dark:text-stone-100 dark:placeholder-stone-300 dark:focus-visible:border-white"
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

					<span className="group-data-[status=loading]:invisible group-data-[status=success]:invisible">
						Subscribe
					</span>

					<span className="absolute inset-0 hidden items-center justify-center text-green-100 group-data-[status=success]:flex">
						<svg
							className="size-5"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<title>Success</title>
							<path
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</span>
				</button>
			</div>

			<small className="flex flex-col items-baseline gap-0.5 text-pretty text-stone-700 lg:px-5 dark:text-stone-300">
				<span>No spam. Unsubscribe anytime.</span>
				{fetcher.data?.ok === false && (
					<em className="font-medium whitespace-pre-line text-red-500 not-italic dark:text-red-400">
						{fetcher.data.error}
					</em>
				)}
			</small>
		</fetcher.Form>
	);
}
