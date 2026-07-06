/**
 * Renders the landing page FAQ section, splitting a list of question/answer items
 * into two balanced accordion columns under a badge, heading, and description. It
 * exists to present frequently asked questions in a compact, expandable two-column
 * layout on the marketing pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Accordion, Badge } from "@pkg/ui";
import { ChevronDownIcon } from "lucide-react";

interface FAQItem {
	question: string;
	answer: string;
}

interface LandingFAQProps {
	badge?: string;
	title: string;
	description: string;
	items: FAQItem[];
}

export function LandingFAQ({ badge = "FAQ", title, description, items }: LandingFAQProps) {
	let halfwayIndex = Math.ceil(items.length / 2);
	let firstHalf = items.slice(0, halfwayIndex);
	let secondHalf = items.slice(halfwayIndex);

	return (
		<section id="faq" className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						{badge}
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						{title}
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{description}</p>
				</div>

				<div className="mt-16 grid gap-8 lg:grid-cols-2">
					<Accordion type="multiple" className="flex flex-col gap-4">
						{firstHalf.map((item, index) => (
							<Accordion.Item
								key={`first-${index}`}
								value={`first-${index}`}
								className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
							>
								<Accordion.Trigger className="flex w-full items-center justify-between px-6 py-4 text-left font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:text-neutral-50 dark:hover:bg-neutral-800">
									<span className="pr-4">{item.question}</span>
									<ChevronDownIcon className="size-5 shrink-0 text-neutral-500 transition-transform [[data-state=open]>&]:rotate-180" />
								</Accordion.Trigger>
								<Accordion.Content className="overflow-hidden pb-0 transition-all">
									<div className="border-t border-neutral-200 px-6 py-4 whitespace-pre-line text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
										{item.answer}
									</div>
								</Accordion.Content>
							</Accordion.Item>
						))}
					</Accordion>

					{secondHalf.length > 0 && (
						<Accordion type="multiple" className="flex flex-col gap-4">
							{secondHalf.map((item, index) => (
								<Accordion.Item
									key={`second-${index}`}
									value={`second-${index}`}
									className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
								>
									<Accordion.Trigger className="flex w-full items-center justify-between px-6 py-4 text-left font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:text-neutral-50 dark:hover:bg-neutral-800">
										<span className="pr-4">{item.question}</span>
										<ChevronDownIcon className="size-5 shrink-0 text-neutral-500 transition-transform [[data-state=open]>&]:rotate-180" />
									</Accordion.Trigger>
									<Accordion.Content className="overflow-hidden pb-0 transition-all">
										<div className="border-t border-neutral-200 px-6 py-4 whitespace-pre-line text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
											{item.answer}
										</div>
									</Accordion.Content>
								</Accordion.Item>
							))}
						</Accordion>
					)}
				</div>
			</div>
		</section>
	);
}
