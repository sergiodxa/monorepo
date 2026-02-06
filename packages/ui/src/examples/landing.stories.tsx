import type { Meta, StoryObj } from "@storybook/react";

import { Avatar } from "../components/avatar";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Heading } from "../components/heading";
import { Link } from "../components/link";
import { Separator } from "../components/separator";
import { Text } from "../components/text";

// Icons
function ZapIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
		</svg>
	);
}

function ShieldIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
			<path d="m9 12 2 2 4-4" />
		</svg>
	);
}

function BarChartIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="12" x2="12" y1="20" y2="10" />
			<line x1="18" x2="18" y1="20" y2="4" />
			<line x1="6" x2="6" y1="20" y2="16" />
		</svg>
	);
}

function UsersIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function CodeIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	);
}

function CloudIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	);
}

function StarIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="currentColor"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
		</svg>
	);
}

function TwitterIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
		</svg>
	);
}

function GitHubIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
			<path d="M9 18c-4.51 2-5-2-7-2" />
		</svg>
	);
}

function LinkedInIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
			<rect width="4" height="12" x="2" y="9" />
			<circle cx="4" cy="4" r="2" />
		</svg>
	);
}

// Feature data
const features = [
	{
		icon: <ZapIcon />,
		title: "Lightning Fast",
		description: "Built for speed with optimized performance that keeps your users engaged.",
	},
	{
		icon: <ShieldIcon />,
		title: "Secure by Default",
		description: "Enterprise-grade security with end-to-end encryption and compliance built in.",
	},
	{
		icon: <BarChartIcon />,
		title: "Powerful Analytics",
		description: "Gain deep insights with real-time analytics and customizable dashboards.",
	},
	{
		icon: <UsersIcon />,
		title: "Team Collaboration",
		description: "Work together seamlessly with real-time collaboration and shared workspaces.",
	},
	{
		icon: <CodeIcon />,
		title: "Developer Friendly",
		description: "Extensive APIs, SDKs, and documentation to integrate with your workflow.",
	},
	{
		icon: <CloudIcon />,
		title: "Cloud Native",
		description: "Scales automatically with your business. No infrastructure to manage.",
	},
];

// Testimonial data
const testimonials = [
	{
		quote:
			"This platform has transformed how our team works. The productivity gains have been incredible.",
		author: "Sarah Chen",
		role: "CTO at TechCorp",
		avatar:
			"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face",
	},
	{
		quote:
			"The best investment we've made for our engineering team. Setup was a breeze and the results speak for themselves.",
		author: "Marcus Johnson",
		role: "VP Engineering at Scale",
		avatar:
			"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face",
	},
	{
		quote:
			"Finally, a solution that actually delivers on its promises. Our deployment time dropped by 80%.",
		author: "Emily Rodriguez",
		role: "Lead Developer at Startup",
		avatar:
			"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&fit=crop&crop=face",
	},
];

// Pricing data
const pricingTiers = [
	{
		name: "Starter",
		price: "$19",
		description: "Perfect for individuals and small projects",
		features: ["Up to 5 projects", "Basic analytics", "24/7 support", "1GB storage"],
		popular: false,
	},
	{
		name: "Pro",
		price: "$49",
		description: "Best for growing teams and businesses",
		features: [
			"Unlimited projects",
			"Advanced analytics",
			"Priority support",
			"10GB storage",
			"Team collaboration",
			"API access",
		],
		popular: true,
	},
	{
		name: "Enterprise",
		price: "$149",
		description: "For large organizations with custom needs",
		features: [
			"Everything in Pro",
			"Unlimited storage",
			"Custom integrations",
			"Dedicated support",
			"SLA guarantee",
			"On-premise option",
		],
		popular: false,
	},
];

// Section Components
function Header() {
	return (
		<header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-8">
					<Link href="#" className="flex items-center gap-2 no-underline">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 font-bold text-white">
							A
						</div>
						<span className="text-lg font-semibold text-neutral-900">Acme</span>
					</Link>
					<nav className="hidden items-center gap-6 md:flex">
						<Link href="#features" color="neutral" className="text-sm">
							Features
						</Link>
						<Link href="#testimonials" color="neutral" className="text-sm">
							Testimonials
						</Link>
						<Link href="#pricing" color="neutral" className="text-sm">
							Pricing
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-4">
					<Button variant="ghost" color="neutral">
						Sign in
					</Button>
					<Button>Get Started</Button>
				</div>
			</div>
		</header>
	);
}

function HeroSection() {
	return (
		<section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white py-20 sm:py-32">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-3xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Now in Public Beta
					</Badge>
					<Heading level={1} className="text-4xl font-bold tracking-tight sm:text-6xl">
						Build better products, faster
					</Heading>
					<Text className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-neutral-600">
						The modern platform for teams who ship. Streamline your workflow, collaborate
						seamlessly, and deliver exceptional results with our powerful suite of tools.
					</Text>
					<div className="mt-10 flex items-center justify-center gap-4">
						<Button size="lg">Start Free Trial</Button>
						<Button variant="outline" color="neutral" size="lg">
							View Demo
						</Button>
					</div>
					<div className="mt-10 flex items-center justify-center gap-8 text-sm text-neutral-500">
						<div className="flex items-center gap-2">
							<CheckIcon />
							<span>No credit card required</span>
						</div>
						<div className="flex items-center gap-2">
							<CheckIcon />
							<span>14-day free trial</span>
						</div>
						<div className="flex items-center gap-2">
							<CheckIcon />
							<span>Cancel anytime</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function FeaturesSection() {
	return (
		<section id="features" className="py-20 sm:py-32">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Features
					</Badge>
					<Heading level={2} className="text-3xl font-bold tracking-tight sm:text-4xl">
						Everything you need to succeed
					</Heading>
					<Text className="mt-4 text-lg text-neutral-600">
						Powerful features designed to help you and your team work smarter, not harder.
					</Text>
				</div>
				<div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
					{features.map((feature) => (
						<Card key={feature.title} className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
									{feature.icon}
								</div>
								<Card.Title className="text-lg">{feature.title}</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<Text className="text-neutral-600">{feature.description}</Text>
							</Card.Content>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}

function TestimonialsSection() {
	return (
		<section id="testimonials" className="bg-neutral-50 py-20 sm:py-32">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Testimonials
					</Badge>
					<Heading level={2} className="text-3xl font-bold tracking-tight sm:text-4xl">
						Loved by teams worldwide
					</Heading>
					<Text className="mt-4 text-lg text-neutral-600">
						See what our customers have to say about their experience.
					</Text>
				</div>
				<div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
					{testimonials.map((testimonial) => (
						<Card key={testimonial.author}>
							<Card.Content className="pt-6">
								<div className="mb-4 flex gap-1 text-warning-500">
									{[...Array(5)].map((_, i) => (
										<StarIcon key={i} />
									))}
								</div>
								<Text className="text-neutral-700">"{testimonial.quote}"</Text>
								<div className="mt-6 flex items-center gap-3">
									<Avatar size="md">
										<Avatar.Image src={testimonial.avatar} alt={testimonial.author} />
										<Avatar.Fallback>
											{testimonial.author
												.split(" ")
												.map((n) => n[0])
												.join("")}
										</Avatar.Fallback>
									</Avatar>
									<div>
										<Text className="font-semibold text-neutral-900">{testimonial.author}</Text>
										<Text className="text-sm text-neutral-500">{testimonial.role}</Text>
									</div>
								</div>
							</Card.Content>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}

function PricingSection() {
	return (
		<section id="pricing" className="py-20 sm:py-32">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Pricing
					</Badge>
					<Heading level={2} className="text-3xl font-bold tracking-tight sm:text-4xl">
						Simple, transparent pricing
					</Heading>
					<Text className="mt-4 text-lg text-neutral-600">
						Choose the plan that's right for you. All plans include a 14-day free trial.
					</Text>
				</div>
				<div className="mt-16 grid gap-8 lg:grid-cols-3">
					{pricingTiers.map((tier) => (
						<Card
							key={tier.name}
							className={tier.popular ? "relative border-2 border-primary-500 shadow-lg" : ""}
						>
							{tier.popular && (
								<div className="absolute -top-3 left-1/2 -translate-x-1/2">
									<Badge color="primary">Most Popular</Badge>
								</div>
							)}
							<Card.Header className="text-center">
								<Card.Title className="text-xl">{tier.name}</Card.Title>
								<div className="mt-4">
									<span className="text-4xl font-bold">{tier.price}</span>
									<span className="text-neutral-500">/month</span>
								</div>
								<Card.Description className="mt-2">{tier.description}</Card.Description>
							</Card.Header>
							<Card.Content>
								<ul className="space-y-3">
									{tier.features.map((feature) => (
										<li key={feature} className="flex items-center gap-3">
											<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600">
												<CheckIcon />
											</span>
											<Text className="text-neutral-700">{feature}</Text>
										</li>
									))}
								</ul>
							</Card.Content>
							<Card.Footer>
								<Button
									className="w-full"
									variant={tier.popular ? "solid" : "outline"}
									color={tier.popular ? "primary" : "neutral"}
								>
									Get Started
								</Button>
							</Card.Footer>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}

function CTASection() {
	return (
		<section className="bg-primary-600 py-20 sm:py-32">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Heading level={2} className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
						Ready to get started?
					</Heading>
					<Text className="mt-4 text-lg text-primary-100">
						Join thousands of teams already using our platform to build better products.
					</Text>
					<div className="mt-10 flex items-center justify-center gap-4">
						<Button
							size="lg"
							color="neutral"
							className="bg-white text-primary-600 hover:bg-neutral-100"
						>
							Start Free Trial
						</Button>
						<Button
							variant="outline"
							size="lg"
							className="border-white text-white hover:bg-primary-700"
						>
							Contact Sales
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}

function Footer() {
	const footerLinks = {
		Product: ["Features", "Pricing", "Integrations", "Changelog", "Roadmap"],
		Company: ["About", "Blog", "Careers", "Press", "Partners"],
		Resources: ["Documentation", "Help Center", "Community", "Templates", "Webinars"],
		Legal: ["Privacy", "Terms", "Security", "Cookies"],
	};

	return (
		<footer className="border-t border-neutral-200 bg-white">
			<div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
				<div className="grid gap-8 lg:grid-cols-6">
					<div className="lg:col-span-2">
						<Link href="#" className="flex items-center gap-2 no-underline">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 font-bold text-white">
								A
							</div>
							<span className="text-lg font-semibold text-neutral-900">Acme</span>
						</Link>
						<Text className="mt-4 max-w-xs text-neutral-600">
							Building the future of team collaboration, one feature at a time.
						</Text>
						<div className="mt-6 flex gap-4">
							<Link href="#" color="neutral" className="hover:text-primary-600">
								<TwitterIcon />
							</Link>
							<Link href="#" color="neutral" className="hover:text-primary-600">
								<GitHubIcon />
							</Link>
							<Link href="#" color="neutral" className="hover:text-primary-600">
								<LinkedInIcon />
							</Link>
						</div>
					</div>
					{Object.entries(footerLinks).map(([category, links]) => (
						<div key={category}>
							<Text className="font-semibold text-neutral-900">{category}</Text>
							<ul className="mt-4 space-y-3">
								{links.map((link) => (
									<li key={link}>
										<Link href="#" color="neutral" className="text-sm hover:text-primary-600">
											{link}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<Separator className="my-8" />
				<div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
					<Text className="text-sm text-neutral-500">
						&copy; {new Date().getFullYear()} Acme Inc. All rights reserved.
					</Text>
					<div className="flex gap-6">
						<Link href="#" color="neutral" className="text-sm">
							Privacy Policy
						</Link>
						<Link href="#" color="neutral" className="text-sm">
							Terms of Service
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}

// Main Landing Page Component
function LandingPage() {
	return (
		<div className="min-h-screen bg-white">
			<Header />
			<main>
				<HeroSection />
				<FeaturesSection />
				<TestimonialsSection />
				<PricingSection />
				<CTASection />
			</main>
			<Footer />
		</div>
	);
}

const meta: Meta<typeof LandingPage> = {
	title: "Examples/Landing",
	component: LandingPage,
	parameters: {
		layout: "fullscreen",
	},
};

export default meta;
type Story = StoryObj<typeof LandingPage>;

export const Default: Story = {};
