import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { href, Link } from "react-router";
import { z } from "zod";
import alem from "~/assets/alem.png";
import avatar from "~/assets/avatar.png";
import { SampleChapterForm } from "~/components/sample-chapter-form";
import frequentQuestions from "~/data/frequent-questions";
import { Discounts, Product } from "~/data/product";
import polar from "~/services/polar";
import { findApplicableDiscount } from "~/use-case/find-applicable-discount";
import type { Route } from "./+types/release";

const priceFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

export async function loader() {
	let [essentials, complete, discount] = await Promise.all([
		polar.products.get({ id: Product.Essentials }),
		polar.products.get({ id: Product.Complete }),
		findApplicableDiscount(),
	]);

	let pricesSchema = z
		.object({
			prices: z
				.object({ priceAmount: z.number().transform((v) => v / 100) })
				.array()
				.transform((v) => v[0]),
		})
		.transform((v) => v.prices?.priceAmount ?? 0);

	return {
		ppp: discount?.id !== Discounts.EARLY,
		products: {
			essentials: pricesSchema.parse(essentials),
			complete: pricesSchema.parse(complete),
		},
		discount: z
			.object({
				amount: z.number().transform((v) => v / 100),
				endsAt: z.date(),
			})
			.optional()
			.parse(discount),
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return (
		<>
			{loaderData.ppp && <script src="https://cdn.paritydeals.com/banner.js" />}
			<div className="flex flex-col gap-5 py-5 lg:gap-15 lg:py-10">
				<Hero />
				<hr className="border-stone-300" />
				<Description />
				<hr className="border-stone-300" />
				<SampleChapterForm />
				<hr className="border-stone-300" />
				<Testimonial />
				<hr className="border-stone-300" />
				<Pricing {...loaderData.products} discount={loaderData.discount} />
				<hr className="border-stone-300" />
				<Author />
				<hr className="border-stone-300" />
				<FrequentQuestions />
				<footer className="text-center font-light text-sm">
					© 2025 Sergio Xalambrí. All Rights Reserved.
				</footer>
			</div>
		</>
	);
}

function Hero() {
	return (
		<div id="hero" className="w-full max-w-5xl flex flex-col gap-10 p-5">
			<header className="flex flex-col gap-5 font-serif">
				<h1 className="text-4xl lg:text-8xl leading-none font-light text-balance">
					React Router OAuth2 Handbook
				</h1>

				<p className="text-xl lg:text-3xl max-w-prose">
					A practical, modern guide to implementing{" "}
					<strong className="font-semibold">OAuth2 authentication</strong> in React Router and Remix
					apps—built on patterns you can apply to any web application.
				</p>

				<a href="#pricing" className="underline capitalize underline-offset-6">
					⬇️ View the packages
				</a>
			</header>
		</div>
	);
}

function Description() {
	let blocks = [
		{
			title: "📘 47-page handbook",
			description:
				"A concise, no-fluff guide that walks you through the core concepts of OAuth2 and OpenID Connect using React Router v7 in framework mode. Learn how to implement secure auth flows, refresh tokens, and introspection endpoints — all in a modern full-stack app context.",
		},
		{
			title: "🧪 Real World Example Application",
			description:
				"You’ll get access to a complete React Router + OAuth2 example app that mirrors production use cases. From login screens to token storage strategies, it shows how everything fits together — with code you can run, read, and reuse.",
		},
		{
			title: "🔒 Security-First Approach",
			description:
				"OAuth2 is easy to get wrong. This book emphasizes the why behind each step, helping you avoid common pitfalls like insecure token handling or incorrect client configuration. Whether you're new to OAuth or want to level up, this will sharpen your instincts.",
		},
		{
			title: "🚀 Fast, Framework-Ready Setup",
			description:
				"Built for devs using React Router in framework mode (like Remix), the patterns you’ll learn are ready to drop into your stack. No boilerplate. No guessing. Just a focused, modern approach to authentication that respects both DX and security.",
		},
	];

	return (
		<section id="description" className="w-full max-w-5xl flex flex-col gap-7 p-5">
			<h2 className="font-serif text-3xl lg:text-4xl leading-none font-light text-balance capitalize">
				What’s inside
			</h2>

			<dl className="grid lg:grid-cols-2 gap-10">
				{blocks.map((block) => (
					<div key={block.title} className="flex flex-col gap-4">
						<dt className="font-serif text-2xl font-medium lg:leading-none">{block.title}</dt>
						<dd className="leading-relaxed">{block.description}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function Testimonial() {
	return (
		<section
			id="testimonial"
			className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-5 p-5"
		>
			<img src={alem} alt="Alem Tuzlak" className="rounded-full size-24" />

			<div className="flex flex-col gap-2 max-w-prose text-center lg:text-left">
				<blockquote className="text-balance italic before:content-['“'] after:content-['”'] before:text-balance after:text-balance">
					I always learned enough of <strong>OAuth2</strong> to get the job done, after reading this
					I finally understand how it works.
				</blockquote>
				<div className="flex flex-col gap-2">
					<h2 className="text-lg lg:text-xl leading-none font-medium text-balance">
						<a href="https://x.com/AlemTuzlak" target="_blank" rel="noreferrer">
							Alem Tuzlak
						</a>
					</h2>
					<p className="leading-none text-sm font-light">
						Co-founder of{" "}
						<a href="https://x.com/forge42dev" target="_blank" rel="noreferrer">
							Forge 42
						</a>
					</p>
				</div>
			</div>
		</section>
	);
}

function Pricing({
	discount,
	essentials,
	complete,
}: {
	discount?: { amount: number; endsAt: Date };
	essentials: number;
	complete: number;
}) {
	let packages = [
		{
			title: "🚀 Complete Package",
			link: href("/api/checkout/:type", { type: "complete" }),
			price: complete,
			discount: discount,
			description: (
				<>
					<p>
						Everything you need to master OAuth2 with React Router in production-ready environments.
					</p>

					<p>Includes:</p>

					<ul className="list-disc list-inside pl-2 space-y-1.5">
						<li>
							📘 <strong>The Book</strong> — 47-page guide in PDF and EPUB formats
						</li>
						<li>
							🧪 <strong>Example App</strong> — Web App, API, Authorization Server, and E2E tests
						</li>
						<li>
							💬 <strong>Private Discord Access</strong> — Get support, ask questions, and connect
							with other devs
						</li>
					</ul>

					<p>
						Whether you're building an internal tool, a SaaS product, or integrating with a
						third-party identity provider, this package gives you the confidence and code to ship it
						right.
					</p>
				</>
			),
		},
		{
			title: "📘 The Book",
			link: href("/api/checkout/:type", { type: "essentials" }),
			price: essentials,
			discount: undefined,
			description: (
				<>
					<p>Just the essentials. The complete 47-page guide in PDF and EPUB formats</p>

					<p>
						If you want a clear, hands-on explanation of how to implement secure OAuth2 flows using
						React Router v7 — from login to token refresh and everything in between — this is your
						starting point.
					</p>
				</>
			),
		},
	];

	return (
		<section id="pricing" className="flex flex-col gap-10 w-full max-w-5xl p-5">
			<header className="flex flex-col gap-2">
				<h2 className="font-serif text-3xl lg:text-4xl leading-none font-light text-balance capitalize">
					Get React Router OAuth2 Handbook
				</h2>

				<p className="max-w-prose text-xl text-balance">
					Choose the option that fits your needs — whether you're just looking to understand the
					core concepts or want the full experience with hands-on code and private support.
				</p>
			</header>

			{packages.map((pkg) => (
				<article key={pkg.title} className="flex flex-col gap-3">
					<h3 className="font-serif text-xl lg:text-2xl leading-none font-medium text-balance">
						{pkg.title}
					</h3>

					<div className="flex flex-col gap-2 max-w-prose">{pkg.description}</div>

					<div className="flex flex-col items-start gap-1">
						{pkg.discount && (
							<mark className="text-sm font-light py-1 px-2 rounded-xs animate-bounce mt-2 text-center">
								Limited time offer – only{" "}
								<time dateTime={pkg.discount.endsAt.toISOString()} className="font-bold">
									{differenceInCalendarDays(pkg.discount.endsAt, new Date())}
								</time>{" "}
								days left
							</mark>
						)}

						<a
							href={pkg.link}
							className="shrink-0 px-5 py-2.5 rounded-xs relative bg-stone-950 text-stone-50 dark:bg-stone-50 dark:text-stone-950 group-data-[status=success]:bg-green-500 dark:group-data-[status=success]:bg-green-600 w-fit"
						>
							<span>Purchase for</span>{" "}
							{pkg.discount ? (
								<span>
									<s>{priceFormatter.format(pkg.price)}</s>{" "}
									<strong>{priceFormatter.format(pkg.price - pkg.discount.amount)}</strong>
								</span>
							) : (
								<span>{priceFormatter.format(pkg.price)}</span>
							)}
						</a>
					</div>
				</article>
			))}

			<div className="bg-stone-100 dark:bg-stone-950 border border-stone-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 lg:-mx-6">
				<div>
					<p className="text-sm text-stone-600 dark:text-stone-400 mb-1">
						Do you already have The Book?
					</p>
					<h3 className="text-lg font-medium dark:text-white">
						Upgrade to the <strong>Complete Package</strong>
					</h3>
					<p className="text-sm text-stone-500 mt-1">
						You only pay the difference and get access to the app + community.
					</p>
				</div>
				<Link
					to={href("/upgrade")}
					className="shrink-0 px-5 py-2.5 rounded-xs relative bg-stone-950 text-stone-50 dark:bg-stone-50 dark:text-stone-950 group-data-[status=success]:bg-green-500 dark:group-data-[status=success]:bg-green-600 w-fit"
				>
					Upgrade now →
				</Link>
			</div>
		</section>
	);
}

function Author() {
	return (
		<section id="author" className="flex flex-col lg:flex-row gap-5 w-full max-w-5xl p-5">
			<div className="flex flex-col gap-2 max-w-prose">
				<h2 className="font-serif text-3xl lg:text-4xl leading-none font-light text-balance capitalize">
					About the Author
				</h2>

				<p>
					Hi,{" "}
					<a
						href="https://x.com/sergiodxa"
						className="underline font-semibold"
						target="_blank"
						rel="noreferrer"
					>
						I’m Sergio
					</a>{" "}
					— a full-stack developer working with TypeScript, React, and Rails to build scalable apps
					and secure APIs. I’ve spent years refining OAuth2 flows, deploying to Cloudflare, and
					optimizing systems from the backend to the edge.
				</p>

				<p>
					Everything{" "}
					<a
						href="https://sergiodxa.com"
						className="underline font-semibold"
						target="_blank"
						rel="noreferrer"
					>
						I write
					</a>{" "}
					comes from real-world experience: things I’ve built, broken, and fixed. My goal is to
					share clear, practical insights that help other developers ship better code with
					confidence.
				</p>
			</div>

			<img
				src={avatar}
				alt="Sergio Xalambrí"
				className="size-50 rounded-full order-first mx-auto lg:mx-0 lg:order-last"
			/>
		</section>
	);
}

function FrequentQuestions() {
	return (
		<section id="faq" className="flex flex-col gap-10 w-full max-w-5xl p-5">
			<h2 className="font-serif text-3xl lg:text-4xl leading-none font-light text-balance capitalize">
				Frequently Asked Questions
			</h2>

			<div className="grid gap-5 lg:grid-cols-2 lg:gap-10">
				{frequentQuestions.map((block, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: This is static
					<dl key={index} className="flex flex-col gap-5">
						{block.map((item) => (
							<div key={item.q} className="flex flex-col gap-4 text-balance">
								<dt className="font-serif text-lg lg:text-xl font-semibold">{item.q}</dt>
								<dd className="font-light whitespace-pre-line">{item.a}</dd>
							</div>
						))}
					</dl>
				))}
			</div>
		</section>
	);
}
