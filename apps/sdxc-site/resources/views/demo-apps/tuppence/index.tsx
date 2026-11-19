/**
 * Tuppence, an invented personal bank and budgeting app: one person's euro, pound, dollar and
 * yen accounts, a statement by day, spending and budgets, savings pots, bills, cards and a
 * transfer flow. Oat paper, terracotta clay and serif balances; no money ever moves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { iife } from "@sdxc/iife";
import { raw } from "@sdxc/u/general";
import { HeadingScope, LinkButton } from "@sdxc/ui";
import { APP_SHELL_COOKIE, readAppShellCookie } from "@sdxc/ui/app/app-shell";
import { Empty } from "@sdxc/ui/app/empty";

import type { DemoApp, DemoAppRequest } from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import {
	MAIN_FRAME,
	MainFrame,
	MainScreen,
	mainSource,
} from "~/resources/views/demo-apps/main-frame";

import type { Destination } from "./shell";

import { AccountScreen } from "./accounts";
import { BudgetsScreen } from "./budgets";
import { CardsScreen } from "./cards";
import { ACCOUNTS, CARDS, MONTHS, PAYEES, POTS, findAccount, href } from "./data";
import Home from "./home";
import { PotsScreen, potScreen } from "./pots";
import { RecurringScreen } from "./recurring";
import TuppenceShell from "./shell";
import { SpendingScreen } from "./spending";
import { isPersonal, readWallet } from "./state";
import { submit } from "./submit";
import { TuppenceThumbnail } from "./thumbnail";
import { TOASTS } from "./toasts";
import { TransactionsScreen } from "./transactions";
import { transferStep } from "./transfer";

/** Terracotta clay at hue 40: the warm, earthy accent of a clay coin. */
const BRAND = [
	"oklch(0.975 0.014 55)",
	"oklch(0.945 0.03 52)",
	"oklch(0.89 0.06 48)",
	"oklch(0.81 0.1 45)",
	"oklch(0.72 0.135 42)",
	"oklch(0.64 0.15 40)",
	"oklch(0.56 0.145 38)",
	"oklch(0.48 0.125 36)",
	"oklch(0.4 0.1 35)",
	"oklch(0.32 0.075 34)",
	"oklch(0.23 0.05 33)",
] as const;

/** Oat paper: neutrals leaning warm, so white cards sit on a page like linen. */
const NEUTRAL = [
	"oklch(0.985 0.006 80)",
	"oklch(0.962 0.01 78)",
	"oklch(0.915 0.013 76)",
	"oklch(0.85 0.015 74)",
	"oklch(0.72 0.016 70)",
	"oklch(0.6 0.016 66)",
	"oklch(0.48 0.014 62)",
	"oklch(0.38 0.012 60)",
	"oklch(0.28 0.01 58)",
	"oklch(0.21 0.008 56)",
	"oklch(0.155 0.006 55)",
] as const;

/**
 * A humanist sans for words and a book serif for money, generous radii, and a categorical
 * palette of earthy tones (`--tuppence-cat-*`) that each spending category keeps on every chart.
 */
const TOKENS = {
	"--ui-font-sans":
		"Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', 'Segoe UI', ui-sans-serif, system-ui, sans-serif",
	"--ui-radius-sm": "0.375rem",
	"--ui-radius-md": "0.625rem",
	"--ui-radius-lg": "0.875rem",
	"--ui-app-inset-radius": "1.25rem",
	"--tuppence-card": "light-dark(oklch(0.997 0.003 80), oklch(0.235 0.008 58))",
	"--tuppence-hairline": "light-dark(oklch(0.9 0.014 76 / 0.9), oklch(0.36 0.012 60 / 0.9))",
	"--tuppence-cat-1": "light-dark(oklch(0.6 0.12 148), oklch(0.74 0.12 148))",
	"--tuppence-cat-2": "light-dark(oklch(0.62 0.15 40), oklch(0.74 0.13 42))",
	"--tuppence-cat-3": "light-dark(oklch(0.52 0.09 255), oklch(0.74 0.09 255))",
	"--tuppence-cat-4": "light-dark(oklch(0.6 0.1 200), oklch(0.76 0.09 200))",
	"--tuppence-cat-5": "light-dark(oklch(0.54 0.13 330), oklch(0.74 0.11 330))",
	"--tuppence-cat-6": "light-dark(oklch(0.72 0.13 85), oklch(0.82 0.12 85))",
	"--tuppence-cat-7": "light-dark(oklch(0.62 0.14 12), oklch(0.75 0.12 12))",
	"--tuppence-cat-8": "light-dark(oklch(0.56 0.12 290), oklch(0.74 0.1 290))",
} as const;

/** One Tuppence screen: its title and status, the nav entry it marks, and its content. */
interface TuppenceScreen {
	title: string;
	status?: number;
	current: Destination;
	content: RemixNode;
}

/** The app's own 404, inside its frame. */
function NotFound() {
	return () => (
		<HeadingScope
			level={1}
			mix={raw({ maxInlineSize: "40rem", marginInline: "auto", paddingBlock: "2rem" })}
		>
			<Empty kind="no-results">
				<Empty.Title>Nothing at this address</Empty.Title>
				<Empty.Description>
					It may have been a transaction that only lived in another visitor's demo, or the address
					has a typo.
				</Empty.Description>
				<Empty.Action>
					<LinkButton href={href()}>Back to home</LinkButton>
				</Empty.Action>
			</Empty>
		</HeadingScope>
	);
}

/** The screens two segments deep: an account, a pot, and the transfer flow's steps. */
function deepScreen(
	request: DemoAppRequest,
	first: string,
	second: string,
): TuppenceScreen | undefined {
	let wallet = readWallet(request.cookie);
	if (first === "accounts") {
		let account = findAccount(second);
		return account === undefined
			? undefined
			: {
					title: `${account.name} · ${account.currency}`,
					current: `account-${account.id}`,
					content: <AccountScreen wallet={wallet} account={account} url={request.url} />,
				};
	}
	if (first === "pots") {
		let screen = potScreen(wallet, second, request.url);
		return screen === undefined
			? undefined
			: { title: screen.title, current: "pots", content: screen.content };
	}
	if (first === "transfer") {
		let screen = transferStep(wallet, second, request.url);
		return screen === undefined
			? undefined
			: { title: screen.title, current: "transfer", content: screen.content };
	}
	return undefined;
}

/** The screens one segment deep. */
function topScreen(request: DemoAppRequest, page: string): TuppenceScreen | undefined {
	let wallet = readWallet(request.cookie);
	let url = request.url;
	if (page === "") return { title: "Home", current: "home", content: <Home wallet={wallet} /> };
	if (page === "transactions")
		return {
			title: "Transactions",
			current: "transactions",
			content: <TransactionsScreen wallet={wallet} url={url} />,
		};
	if (page === "spending")
		return {
			title: "Spending",
			current: "spending",
			content: <SpendingScreen wallet={wallet} url={url} />,
		};
	if (page === "budgets")
		return {
			title: "Budgets",
			current: "budgets",
			content: <BudgetsScreen wallet={wallet} url={url} />,
		};
	if (page === "pots")
		return { title: "Pots", current: "pots", content: <PotsScreen wallet={wallet} /> };
	if (page === "recurring")
		return {
			title: "Bills & subscriptions",
			current: "recurring",
			content: <RecurringScreen wallet={wallet} url={url} />,
		};
	if (page === "cards")
		return { title: "Cards", current: "cards", content: <CardsScreen wallet={wallet} url={url} /> };
	if (page === "transfer") {
		let screen = transferStep(wallet, "", url);
		return screen === undefined
			? undefined
			: { title: screen.title, current: "transfer", content: screen.content };
	}
	return undefined;
}

/**
 * Picks the screen a page path names; every path Tuppence lacks gets its own 404 inside the
 * frame, so a mistyped address still shows where the visitor is.
 */
function route(request: DemoAppRequest): TuppenceScreen {
	let [first = "", second, extra] = request.page.split("/");
	let found = iife(() => {
		if (extra !== undefined) return undefined;
		if (second === undefined) return topScreen(request, first);
		return deepScreen(request, first, second);
	});
	return found ?? { title: "Not found", status: 404, current: "none", content: <NotFound /> };
}

/** Every screen and state a visitor reaches by clicking, so a test can walk them all. */
const SCREENS = [
	"",
	"transactions",
	"transactions?q=cafe",
	"transactions?category=eating-out",
	"transactions?flow=in",
	"transactions?account=gbp",
	"transactions?q=zzz",
	"transactions?tx=t0190",
	"spending",
	...MONTHS.map((month) => `spending?month=${month}`),
	"budgets",
	"budgets?edit=groceries",
	"pots",
	...POTS.map((pot) => `pots/${pot.id}`),
	"recurring",
	"recurring?on=2026-11-20",
	"cards",
	...CARDS.map((card) => `cards?card=${card.id}`),
	"transfer",
	...PAYEES.map((payee) => `transfer/amount?payee=${payee.id}`),
	"transfer/review?payee=tomas&amount=25.00&reference=Dinner",
	"transfer/sent?payee=tomas&amount=2500",
	...ACCOUNTS.map((account) => `accounts/${account.id}`),
];

export default {
	name: "Tuppence",
	kind: "Banking & budgets",
	tagline: "Money, kept calmly.",
	artDirection: "Oat paper, terracotta clay, serif balances.",
	description:
		"Tuppence, an invented personal bank: multi-currency accounts, a statement by day with search and splits, spending and budgets, savings pots, bills ahead, cards that freeze and a transfer flow, all with fake money.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <TuppenceThumbnail />,
	screens: SCREENS,
	cookies: [APP_SHELL_COOKIE],
	isPersonal,
	toasts: TOASTS,
	render(request) {
		let screen = route(request);
		return {
			title: screen.title,
			status: screen.status,
			body: (
				<TuppenceShell current={screen.current} collapsed={readAppShellCookie(request.cookie)}>
					<MainFrame src={mainSource(request.url)} />
				</TuppenceShell>
			),
		};
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let screen = route(request);
		let key = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		return (
			<MainScreen
				title={screen.title}
				nav={screen.current}
				url={request.url}
				toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
			>
				{screen.content}
			</MainScreen>
		);
	},
	submit,
} satisfies DemoApp;
