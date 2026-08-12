/**
 * German (de) translation dictionary for the Uptime app. It maps every UI copy key
 * to its German string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in German, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ApiKeyScope } from "~/database/schema";

export default {
	landing: {
		meta: {
			title: "Uptime von Sergio Xalambrí",
			description: "Einfache und zuverlässige Uptime-Überwachung für Entwickler",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "Preise",
				features: "Funktionen",
				compare: "Vergleichen",
				docs: "Docs",

				cta: {
					in: "Dashboard öffnen",
					out: "Überwachung starten",
				},
			},
		},

		try: {
			title: "Prüfen Sie jede URL, kostenlos",
			description:
				"Kein Konto nötig. Wir führen eine Prüfung durch und zeigen genau, was ein Monitor melden würde.",
			label: "URL prüfen",
			placeholder: "https://beispiel.de",
			submit: "Prüfung starten",
		},

		hero: {
			pill: "Uptime-Überwachung",
			title: "Überwachen Sie Ihre Dienste <strong>mit Zuversicht</strong>",
			description:
				"Erhalten Sie sofortige Benachrichtigungen, wenn Ihre Websites und APIs ausfallen. Überwachen Sie Ihre Websites und APIs mit Leichtigkeit.",

			cta: {
				in: "Dashboard öffnen",
				out: "Überwachung starten",
				pricing: "Preise ansehen",
				try: "{{days}} Tage gratis überwachen",
			},

			try: {
				label: "URL prüfen",
				placeholder: "https://beispiel.de",
				submit: "Prüfung starten",
			},
			screenshot: {
				alt: "Screenshot des Uptime-Dashboards: eine Seitenleiste mit HTTP-, DNS- und TCP-Monitoren, Cron-Jobs, Benachrichtigungen, Wartung und Statusseiten; Übersichtskarten für monatliche Ping-Nutzung, Gesamt-Uptime-Prozentsatz und den langsamsten Endpunkt; Zählungen aktiver und ausgefallener Monitore pro Typ; und eine Tabelle der HTTP-Monitore mit Latenz-Trendlinien und Status-Badges",
			},

			trustIndicators: {
				freeToStart: "Kostenlos starten",
				payForAutomation: "Zahlen Sie für Automatisierung",
				cancelAnytime: "Jederzeit kündbar",
			},
		},

		trustIndicators: {
			monitorTypes: "Monitor-Typen",
			globalRegions: "Globale Regionen",
			daysDataRetention: "Tage Datenspeicherung",
			minCheckInterval: "Min. Prüfintervall",
		},

		/**
		 * Die drei Dinge, die wahr bleiben, egal wie viel jemand am Ende überwacht. Preis und
		 * Freikontingent werden aus `~/app/lib/pricing.ts` eingesetzt und nicht hier
		 * geschrieben — ein fester Wert wäre am Tag einer Preisänderung veraltet, und
		 * `app/lib/public-claims.ts` lässt den Build daran scheitern.
		 */
		benefits: {
			badge: "Warum Uptime",
			title: "Ein Tarif, alle Prüfungen, kein Rechnen",
			description: "Drei Dinge, die wahr bleiben, egal wie viel Sie am Ende überwachen.",

			list: {
				everythingIncluded: {
					title: "Alles inklusive",
					description:
						"HTTP-, DNS-, TCP- und SSL-Prüfungen, Cron-Job-Heartbeats, Benachrichtigungen und Statusseiten. Ein Tarif, nichts als Zusatzoption verkauft.",
				},
				noMonitorMath: {
					title: "Kein Monitor-Rechnen",
					description:
						"Unbegrenzt Monitore und unbegrenzt Teammitglieder. Nehmen Sie alles auf, was beobachtet werden soll, und jeden, der es sehen muss.",
				},
				payForUsage: {
					title: "Zahlen für tatsächliche Nutzung",
					description:
						"{{price}} pro Monat enthalten {{included}} Prüfungen. Darüber hinaus zahlen Sie für die Prüfungen, die Sie tatsächlich ausführen, und für nichts anderes.",
				},
			},
		},

		features: {
			title: "Leistungsstarke Überwachung einfach gemacht",
			description:
				"Alles, was Sie brauchen, um Ihre Dienste reibungslos am Laufen zu halten, ohne unnötige Komplexität.",
			badge: "Funktionen",
			learnMore: "Mehr erfahren",

			list: {
				first: {
					title: "Überwachen Sie Ihre Uptime",
					description:
						"Verfolgen Sie Ihre Dienste rund um die Uhr, aus neun Regionen und in Intervallen ab einer Minute. Erhalten Sie detaillierte Metriken und Leistungseinblicke auf einen Blick.",
				},
				second: {
					title: "Erhalten Sie Benachrichtigungen überall",
					description:
						"Erhalten Sie sofortige Benachrichtigungen per E-Mail, Slack, Discord oder Webhooks, wenn Ihre Dienste Ausfallzeiten oder Leistungsprobleme haben.",
				},
				third: {
					title: "Zahlen Sie nur, was Sie nutzen",
					description:
						"Transparente Preise ohne versteckte Gebühren. Skalieren Sie nach Bedarf hoch oder runter, mit Plänen, die mit Ihren Überwachungsanforderungen wachsen.",
				},
				fourth: {
					title: "Statusseiten",
					description:
						"Erstellen Sie ansprechende öffentliche Statusseiten, um Ihre Benutzer über die Dienstverfügbarkeit und Vorfälle zu informieren.",
				},
				fifth: {
					title: "SSL-Überwachung",
					description:
						"Verfolgen Sie Zertifikats-Ablaufdaten und erhalten Sie Benachrichtigungen, bevor Ihre SSL-Zertifikate ablaufen, um Sicherheitswarnungen zu vermeiden.",
				},
				sixth: {
					title: "DNS-Überwachung",
					description:
						"Erkennen Sie DNS-Eintragsänderungen und Propagierungsprobleme, bevor sie Ihre Benutzer beeinträchtigen oder gekapert werden.",
				},
				seventh: {
					title: "Native Integrationen",
					description:
						"Direkte Slack- und Discord-Integrationen mit umfangreichen Benachrichtigungen, nicht nur einfache Webhooks.",
				},
			},
		},

		completeFeatureSet: {
			badge: "Komplettes Funktionsset",
			title: "Alles, was Sie für zuverlässige Überwachung brauchen",
			description: "Erweiterte Funktionen, die die Überwachung mühelos und umfassend machen.",

			list: {
				maintenanceWindows: {
					title: "Wartungsfenster",
					description:
						"Planen Sie Ausfallzeiten und unterdrücken Sie Benachrichtigungen während geplanter Wartung",
				},
				contentMonitoring: {
					title: "Inhaltsüberwachung",
					description:
						"Überprüfen Sie, ob bestimmte Schlüsselwörter oder Inhalte auf Ihren Seiten erscheinen",
				},
				recoveryAlerts: {
					title: "Wiederherstellungs-Benachrichtigungen",
					description:
						"Werden Sie benachrichtigt, wenn Dienste nach einem Vorfall wieder verfügbar sind",
				},
				apiAccess: {
					title: "API-Zugang",
					description: "Vollständige REST-API mit Schlüsselverwaltung für Automatisierung",
				},
				alertCooldowns: {
					title: "Benachrichtigungs-Cooldowns",
					description:
						"Verhindern Sie Benachrichtigungsmüdigkeit mit konfigurierbaren Cooldown-Perioden",
				},
				customHeaders: {
					title: "Benutzerdefinierte Header",
					description:
						"Fügen Sie Authentifizierungs-Header und benutzerdefinierte Anfrageparameter hinzu",
				},
				cronMonitoring: {
					title: "Cron-Job-Überwachung",
					description: "Überwachen Sie geplante Jobs und Hintergrundaufgaben mit Heartbeat-Checks",
				},
			},
		},

		useCases: {
			badge: "Anwendungsfälle",
			title: "Für jeden Überwachungsbedarf entwickelt",
			description:
				"Von einfachen Gesundheitsprüfungen bis hin zu komplexen verteilten Systemen – wir haben Sie abgedeckt.",
			learnMore: "Mehr erfahren",
			tailoredFor: "Maßgeschneiderte Lösungen für:",

			list: {
				websiteMonitoring: {
					title: "Website-Überwachung",
					description:
						"Verfolgen Sie Uptime und Leistung für Landingpages, Blogs und Webanwendungen.",
				},
				apiMonitoring: {
					title: "API-Überwachung",
					description:
						"Überwachen Sie REST-APIs, GraphQL-Endpunkte und Webhooks auf Verfügbarkeit.",
				},
				saas: {
					title: "SaaS-Anwendungen",
					description:
						"Halten Sie Ihr SaaS-Produkt zuverlässig mit proaktiver Überwachung und sofortigen Benachrichtigungen.",
				},
				microservices: {
					title: "Microservices",
					description:
						"Überwachen Sie verteilte Systeme und erkennen Sie Fehler, bevor sie sich ausbreiten.",
				},
				healthChecks: {
					title: "Gesundheitsprüfungen",
					description:
						"Überprüfen Sie die Dienstverfügbarkeit und Datenbankverbindungen mit geplanten Pings.",
				},
				ecommerce: {
					title: "E-Commerce",
					description:
						"Überwachen Sie Checkout-Abläufe, Zahlungs-APIs und Produktseiten zum Schutz Ihrer Einnahmen.",
				},
			},

			audiences: {
				indieHackers: "Indie Hacker",
				soloDevelopers: "Solo-Entwickler",
				startups: "Startups",
				agencies: "Agenturen",
				enterprises: "Unternehmen",
				devops: "DevOps",
			},
		},

		pricing: {
			badge: "Preise",
			title: "Einfache, transparente Preise",
			description:
				"Ein Abonnement, keine Stufen. Zahlen Sie nur für das, was Sie nutzen, mit unserem unkomplizierten Preismodell",

			howItWorks: {
				title: "So funktioniert die Preisgestaltung",

				list: {
					first: {
						title: "Basis-Abonnement",
						description: "{{price}}/Monat beinhaltet Ihre ersten {{included}} Pings",
					},

					second: {
						title: "Zusätzliche Pings",
						description:
							"{{blockPrice}} pro weitere {{blockSize}} Pings, in ganzen Blöcken abgerechnet",
					},

					third: {
						title: "Keine versteckten Gebühren",
						description:
							"Keine zusätzlichen Kosten für Funktionen oder Integrationen. Zahlen Sie für die Pings, die Sie nutzen.",
					},
				},
			},

			calculator: {
				title: "Preisrechner",
				description:
					"Berechnen Sie Ihre monatlichen Kosten basierend auf Ihren Überwachungsanforderungen",

				add: "Monitor hinzufügen",

				monitor: {
					label: "Monitor-Frequenz",
					delete: "Entfernen",
					frequency: {
						lower: "1m",
						upper: "60m",
					},
				},

				stats: {
					pingsPerMonth: "Pings pro Monat:",
					baseSubscription: "Basis-Abonnement",
					includes: "Beinhaltet die ersten {{amount}} Pings",
					additionalPings: "Zusätzliche Pings:",
					additionalPingsCost:
						"{{blocks}} × {{blockPrice}} pro {{blockSize}} Pings ({{pings}} darüber)",
					totalCost: "Monatliche Gesamtkosten:",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "Häufig gestellte Fragen",
			description: "Finden Sie Antworten auf häufige Fragen zu Uptime",

			list: {
				first: {
					q: "Wie überwacht Uptime meine Dienste?",
					a: "Uptime sendet regelmäßige HTTP- oder HTTPS-Anfragen an Ihre Endpunkte. Wir prüfen Antwortcodes und Antwortzeiten, um festzustellen, ob Ihr Dienst verfügbar und reaktionsfähig ist.",
				},

				second: {
					q: "Was passiert, wenn ein Ausfall erkannt wird?",
					a: "Wenn Uptime einen Ausfall erkennt, sendet es sofort eine Benachrichtigung über Ihre konfigurierten Kanäle.",
				},

				third: {
					q: "Kann ich interne Dienste überwachen?",
					a: "Ja, solange Ihre internen Dienste über das Internet erreichbar sind. Sie können auch benutzerdefinierte Header konfigurieren, um Anfragen zu authentifizieren.",
				},

				fourth: {
					q: "Wie fange ich an?",
					a: "Melden Sie sich einfach an, erstellen Sie Ihren ersten Monitor und konfigurieren Sie Ihre Benachrichtigungseinstellungen. Sie sind in weniger als einer Minute einsatzbereit.",
				},

				fifth: {
					q: "Gibt es eine kostenlose Stufe?",
					a: "Ja! Sie können unbegrenzt Monitore erstellen und Pings manuell kostenlos auslösen, für immer. Geplante automatische Überwachung erfordert ein Abonnement.",
				},

				sixth: {
					q: "Wie lange werden Ping-Daten gespeichert?",
					a: "Wir speichern Ihre Ping-Ergebnisse 365 Tage lang. Danach werden sie automatisch gelöscht.",
				},

				seventh: {
					q: "Kann ich Dienste überwachen, die Authentifizierung erfordern?",
					a: "Ja. Sie können benutzerdefinierte Header mit Tokens oder Anmeldedaten festlegen, um Ihre Anfragen zu authentifizieren.",
				},

				eighth: {
					q: "Kann ich mehrere URLs überwachen?",
					a: "Ja. Erstellen Sie einfach einen separaten Monitor für jede URL. Jeder Monitor kann seine eigene Prüffrequenz, HTTP-Methode, erwarteten Statuscode und mehr haben.",
				},

				ninth: {
					q: "Kann ich APIs überwachen?",
					a: "Absolut. Uptime ist so konzipiert, dass es sowohl Websites als auch APIs überwacht. Sie können den Endpunkt, die Methode, Header und erwartete Antworten festlegen, um Ihre API effektiv zu überwachen.",
				},

				tenth: {
					q: "Kann ich ein Timeout für jeden Ping festlegen?",
					a: "Ja. Sie können ein Timeout für jeden Monitor konfigurieren. Wenn die Antwort länger als erwartet dauert, wird sie als Fehler gewertet. Dies hilft, langsame Dienste zu erkennen.",
				},

				eleventh: {
					q: "Kann ich einen Monitor vorübergehend pausieren oder deaktivieren?",
					a: "Ja. Sie können jeden Monitor jederzeit einzeln pausieren.",
				},

				twelfth: {
					q: "Kann ich einen Monitor sofort nach der Erstellung testen?",
					a: "Ja. Ein Ping wird automatisch ausgelöst, direkt nachdem Sie einen Monitor erstellt haben.",
				},

				thirteenth: {
					q: "Unterstützen Sie Statusseiten?",
					a: "Ja! Erstellen Sie anpassbare öffentliche Statusseiten, um den Zustand Ihrer Dienste mit Benutzern zu teilen. Fügen Sie beliebige Monitore hinzu und ergänzen Sie Ihr Branding.",
				},

				fourteenth: {
					q: "Kann ich historische Leistungstrends einsehen?",
					a: "Wir speichern alle vergangenen Ergebnisse, sodass Sie eine vollständige Historie erhalten. Leistungstrend-Diagramme sind für eine zukünftige Version geplant.",
				},

				fifteenth: {
					q: "Welche Benachrichtigungskanäle werden unterstützt?",
					a: "E-Mail, Slack, Discord und Webhooks. Native Integrationen machen es einfach, Benachrichtigungen dort zu erhalten, wo Ihr Team bereits arbeitet. Webhooks ermöglichen die Verbindung zu jedem anderen Dienst.",
				},

				sixteenth: {
					q: "Unterstützen Sie Teams oder geteilte Monitore?",
					a: "Ja! Jeder Benutzer beginnt mit einem Team. Laden Sie Teammitglieder mit verschiedenen Rollen ein (Eigentümer, Admin, Mitglied). Die automatische Domain-Bereitstellung fügt automatisch Benutzer mit verifizierten Unternehmens-E-Mail-Domains hinzu.",
				},

				seventeenth: {
					q: "Was passiert, wenn ich die Limits meines Plans überschreite?",
					a: "Nutzung über die {{included}} in Ihrem Abonnement enthaltenen Pings hinaus wird in ganzen Blöcken von {{blockSize}} zu je {{blockPrice}} abgerechnet — ein einzelner Ping darüber beginnt einen neuen Block.",
				},

				eighteenth: {
					q: "Speichern Sie Anfrage- oder Antwortkörper?",
					a: "Nein. Wir speichern niemals Body-Daten. Für zusätzliche Privatsphäre und Effizienz empfehlen wir die Verwendung der `HEAD`-Methode.",
				},

				nineteenth: {
					q: "Aus welchen Regionen kann ich meine Dienste überwachen?",
					a: "Uptime unterstützt die Überwachung aus mehreren Regionen: Afrika, Asien-Pazifik, Ost- und Westeuropa, Ost- und West-Nordamerika, Naher Osten, Ozeanien und Südamerika.\n\nSie können eine Region pro Monitor wählen. Die Region wird als Hinweis behandelt, der tatsächliche Ping stammt von einem Server in oder nahe dieser Region.",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "Einfache, zuverlässige Überwachung für Ihre Websites und APIs.",
			copyright: "© {{year}} Uptime von Sergio Xalambrí. Alle Rechte vorbehalten.",
			sections: {
				product: {
					title: "Produkt",
					features: "Funktionen",
					pricing: "Preise",
					faq: "FAQ",
				},
				features: {
					title: "Funktionen",
					monitors: "Monitore",
					alerts: "Benachrichtigungen",
					statusPages: "Statusseiten",
					ssl: "SSL-Überwachung",
					dns: "DNS-Überwachung",
					cronJobs: "Cron-Job-Überwachung",
					contentMonitoring: "Inhaltsüberwachung",
					maintenance: "Wartungsfenster",
					integrations: "Integrationen",
					teams: "Teams",
					analytics: "Analytik",
					api: "API-Zugang",
				},
				useCases: {
					title: "Anwendungsfälle",
					websiteMonitoring: "Website-Überwachung",
					apiMonitoring: "API-Überwachung",
					saas: "SaaS-Anwendungen",
					ecommerce: "E-Commerce",
					cronJobs: "Cron-Job-Überwachung",
					microservices: "Microservices",
					healthChecks: "Health Checks",
				},
				solutions: {
					title: "Lösungen",
					indieHackers: "Für Indie Hacker",
					soloDevs: "Für Solo-Entwickler",
					startups: "Für Startups",
					agencies: "Für Agenturen",
					enterprises: "Für Unternehmen",
					devops: "Für DevOps",
				},
				compare: {
					title: "Vergleichen",
					uptimerobot: "vs UptimeRobot",
					pingdom: "vs Pingdom",
					betterUptime: "vs Better Uptime",
					healthchecks: "vs Healthchecks.io",
					cronitor: "vs Cronitor",
					checkly: "vs Checkly",
					statuscake: "vs StatusCake",
					datadog: "vs Datadog",
					site24x7: "vs Site24x7",
					ohdear: "vs Oh Dear",
				},
				docs: {
					title: "Dokumentation",
					overview: "Überblick",
					quickstart: "Schnellstart",
					apiReference: "API-Referenz",
				},
				legal: {
					title: "Rechtliches",
					terms: "Nutzungsbedingungen",
					privacy: "Datenschutzerklärung",
				},
			},
		},

		comparison: {
			tableLabel: "Uptime vs. {{competitor}}",
			tableCategoryHeader: "Kategorie",
			tableProductHeader: "Uptime",
			whyTeamsSwitchTitle: "Warum Teams zu Uptime wechseln",
			gettingStartedTitle: "Erste Schritte",
			finalCtaTitle: "Zu Uptime wechseln",

			honestTake: {
				badge: "Ehrliche Einschätzung",
				title: "Wann {{competitor}} die bessere Wahl sein kann",
				description:
					"Wir setzen auf Transparenz. In diesen Fällen kann {{competitor}} die richtige Wahl sein.",
			},

			pricing: {
				badge: "Preise",
				title: "Echter Kostenvergleich",
				description: "Sehen Sie, wie viel Sie bei einem typischen Monitoring-Setup sparen können.",
				tableLabel: "Kostenvergleich: Uptime vs. {{competitor}}",
				scenarioHeader: "Anwendungsfall",
				savingsHeader: "Ersparnis",
				savingsPerYear: "~{{amount}}/Jahr",
				footnote:
					"Schätzungen auf Basis typischer Nutzungsmuster. Die Preise von {{competitor}} können sich ändern, und Ihre tatsächlichen Kosten hängen von Ihrem Setup ab.",
			},
		},

		finalCta: {
			body: "Erstellen Sie Ihren ersten Monitor in weniger als 2 Minuten. Keine Kreditkarte erforderlich.",
		},

		marketingPage: {
			everythingBadge: "Im Detail",
			everythingTitle: "Alles, was Sie brauchen",
			everythingDescription:
				"Ein genauer Blick darauf, was Sie erhalten – von der ersten Prüfung bis zur Benachrichtigung, die Sie erreicht.",
			howItWorksBadge: "Erste Schritte",
			howItWorksTitle: "So funktioniert es",
			howItWorksDescription:
				"Drei Schritte von einem leeren Dashboard zu Prüfungen, die von selbst laufen.",
			faqBadge: "FAQ",
			faqTitle: "Häufig gestellte Fragen",
			faqDescription: "Die häufigsten Fragen, bevor Sie mit der Überwachung beginnen.",
			finalCtaTitle: "Überwachen Sie jetzt Ihre Dienste",
		},
	},

	/**
	 * `/trust` — wie die Überwachung funktioniert und wer sie betreibt.
	 */
	trust: {
		meta: {
			title: "Vertrauen | Uptime",
			description:
				"Wie Uptime funktioniert: wer es betreibt, von wo die Prüfungen laufen, wie ein Vorfall bestätigt wird und was genau gespeichert wird und was nicht.",
		},
		footerLink: "Vertrauen",
		heading: "Vertrauen",
		intro:
			"Ein Monitor ist nur so viel wert, wie Sie ihm glauben. Diese Seite beschreibt, wie der Dienst tatsächlich funktioniert — wer ihn betreibt, woher Ihre Prüfungen kommen, wie aus einem Fehler eine Benachrichtigung wird und was wir behalten — ausführlich genug, dass Sie entscheiden können, ob Sie sich darauf verlassen wollen. Alles hier beschreibt das System, wie es heute gebaut ist, nicht wie es geplant ist.",
		regions: {
			afr: "Afrika",
			apac: "Asien-Pazifik",
			eeur: "Osteuropa",
			enam: "Östliches Nordamerika",
			me: "Naher Osten",
			oc: "Ozeanien",
			sam: "Südamerika",
			weur: "Westeuropa",
			wnam: "Westliches Nordamerika",
		},
		sections: {
			whoRuns: {
				title: "Wer es betreibt",
				bodyPrefix: "Uptime wird gebaut und betrieben von ",
				founderName: "Sergio Xalambrí",
				bodySuffix:
					", eigenständig. Hinter diesem Namen steht kein Support-Schichtplan und kein Bereitschaftsteam: eine Person schreibt den Code, veröffentlicht ihn und antwortet auf die E-Mails.",
				second:
					"Das ist in beide Richtungen wissenswert. Eine Frage zum Verhalten einer Prüfung erreicht die Person, die sie geschrieben hat. Ein Problem, das beginnt, während diese Person schläft, wartet, bis sie aufwacht.",
			},

			/**
			 * Code-available, not open source: the repository carries its own license with
			 * conditions, so the claim is only that a reader can check the code.
			 */
			source: {
				title: "Sie können den Code lesen",
				bodyPrefix:
					"Der Code, der diesen Dienst betreibt, ist öffentlich — die Aussagen auf dieser Seite lassen sich also überprüfen, statt auf Vertrauen hin geglaubt zu werden: wie eine Prüfung eingeordnet wird, was ein gespeichertes Ergebnis enthält, wann eine Benachrichtigung rausgeht: ",
				linkText: "apps/uptime auf GitHub",
				bodySuffix: ".",
				caveat:
					"Das zeigt Ihnen den Code, nicht die gerade laufende Bereitstellung. Es ist eine weitere Sache, die Sie selbst überprüfen können, für sich allein aber keine Garantie.",
			},
			ownStatus: {
				title: "Unsere eigene Statusseite",
				bodyPrefix:
					"Der Dienst veröffentlicht eine Statusseite über sich selbst, gebaut mit derselben Cron-Job-Überwachung, die das Produkt anbietet: ",
				linkText: "uptime.sergiodxa.com/status/uptime",
				bodySuffix: ".",
				scope:
					"Was diese Seite abdeckt, ist enger, als es klingen mag, deshalb hier die genaue Aussage. Jeder der internen geplanten Jobs des Dienstes — die Monitor-Durchläufe, die nächtliche Zusammenfassung der Tagesstatistiken, die Aufräumarbeiten zur Datenspeicherung — meldet sich, wenn er fertig ist, sodass die Seite zeigt, ob diese geplante Arbeit rechtzeitig läuft. Sie ist keine unabhängige Prüfung des gesamten Dienstes, und sie läuft auf derselben Plattform wie die App selbst; eine Störung, die groß genug ist, um die App zu stoppen, kann also auch die Meldungen dieser Seite stoppen.",
			},
			whereChecksRun: {
				title: "Von wo die Prüfungen laufen",
				intro:
					"Jeder Monitor wird aus einer Region geprüft, die Sie wählen. Neun stehen zur Verfügung:",
				hint: "Eine Region ist ein Hinweis, kein Versprechen. Die Prüfung läuft auf Infrastruktur in der Nähe der gewählten Region, und die Plattform kann sie anderswo platzieren, wenn sie muss. Die zwei europäischen Regionen sind die Ausnahme: sie sind an die EU gebunden, und das ist eine harte Vorgabe und keine Vorliebe.",
				timing:
					"Die für eine Prüfung erfasste Antwortzeit misst nur die Anfrage an Ihren Endpunkt, nicht unsere eigene Arbeit darum herum, damit der Wert vergleichbar bleibt mit dem, was jemand in dieser Region erleben würde.",
			},
			incidents: {
				title: "Wie ein Vorfall bestätigt wird",
				classification:
					"Jede Prüfung endet in einem von drei Ergebnissen. Ausgefallen bedeutet, der Endpunkt war überhaupt nicht erreichbar, hat mit einem anderen Status als dem erwarteten geantwortet oder eine von Ihnen konfigurierte Inhaltsprüfung nicht bestanden. Beeinträchtigt bedeutet, er hat korrekt geantwortet, aber langsamer als der von Ihnen gesetzte Schwellenwert. Erreichbar bedeutet, alles hat gepasst.",
				noConfirmation:
					"Vor der ersten Benachrichtigung gibt es keine zweite bestätigende Prüfung: eine fehlgeschlagene Prüfung genügt, um einen Monitor als ausgefallen zu markieren und die Benachrichtigung zu senden. Das ist eine bewusste Abwägung — ein Bestätigungsdurchlauf würde jede echte Benachrichtigung um ein ganzes Intervall verzögern — aber es bedeutet auch, dass ein einzelner unglücklicher Netzwerkmoment Ihr Postfach erreichen kann.",
				falsePositivesIntro: "Was den Lärm stattdessen klein hält:",
				infraFault: {
					label: "Unsere Fehler sind nicht Ihre.",
					body: "Wenn unsere eigene Prüfinfrastruktur ausfällt, wird die Prüfung wiederholt statt erfasst. Ein Fehler auf unserer Seite wird niemals zu einem Ausfall in Ihrem Verlauf oder zu einer Benachrichtigung in Ihrem Postfach.",
				},
				yourThresholds: {
					label: "Ihr Timeout, Ihre Schwellenwerte.",
					body: "Das Timeout, der erwartete Status und der Schwellenwert für Beeinträchtigung werden alle von Ihnen gesetzt, eine Prüfung ist also nur nach Ihrer eigenen Definition langsam oder fehlgeschlagen.",
				},
				cooldown: {
					label: "Wiederholungen haben Abstand, und eine Wiederherstellung kommt immer.",
					body: "Die erste Benachrichtigung eines Vorfalls geht sofort raus. Solange ein Monitor ausgefallen bleibt, liegen Wiederholungen um die Abkühlzeit dieser Benachrichtigung auseinander — standardmäßig eine Stunde — sodass ein anhaltender Ausfall Sie weiter erinnert statt zu verstummen. Bei der Wiederherstellung erhalten Sie eine weitere Nachricht.",
				},
				recovery: {
					label: "Wiederherstellungsmeldungen nur nach einem echten Fehler.",
					body: "Eine Wiederherstellungsmeldung wird nur gesendet, wenn der Monitor zuvor in einem Fehlerzustand war. Die allererste Prüfung eines Monitors meldet sich nie als wiederhergestellt.",
				},
				maintenance: {
					label: "Wartungsfenster unterdrücken Benachrichtigungen.",
					body: "Solange ein Wartungsfenster einen Monitor abdeckt, werden seine Benachrichtigungen vollständig übersprungen, damit geplante Arbeiten niemanden wecken.",
				},
				accounting: {
					label: "Zurückgehaltene Benachrichtigungen werden ausgewiesen.",
					body: "Wenn ein Vorfall endet, berichtet die Wiederherstellungsmeldung, wie viele Benachrichtigungen hinausgingen und wie viele zurückgehalten wurden, sodass ein stiller Vorfall von verlorenen Benachrichtigungen unterschieden werden kann.",
				},
			},
			storage: {
				title: "Was gespeichert wird und was nicht",
				noBodies:
					"Antwortinhalte werden nie gespeichert. Nicht gekürzt, nicht gehasht, nicht als Stichprobe — es gibt nirgends in der Datenbank eine Spalte dafür.",
				contentChecks:
					"Ein Antwortinhalt wird überhaupt nur heruntergeladen, wenn Sie für diesen Monitor eine Inhaltsprüfung konfigurieren. Wenn Sie das tun, wird er während der Prüfung im Speicher gegen Ihre Regeln abgeglichen und dann mit dem Rest der Anfrage verworfen. Ein Monitor ohne Inhaltsprüfungen liest nie einen Antwortinhalt.",
				storedIntro: "Was behalten wird, und wie lange:",
				httpResults: {
					label: "Einzelne HTTP-Prüfdatensätze:",
					body: "der zurückgegebene Statuscode, wie lange die Anfrage gedauert hat und wann sie abgeschlossen war. Eine Woche lang aufbewahrt, was alles ist, was die aktuellen Ansichten und die Nutzungszählung lesen.",
				},
				dailyStats: {
					label: "Tagesstatistiken:",
					body: "jede Nacht werden die Prüfungen des Vortags zu einer Zeile pro Monitor zusammengefasst. Diese Zusammenfassung ist der Langzeitverlauf hinter jeder Uptime-Grafik in der App und wird 365 Tage lang aufbewahrt.",
				},
				otherResults: {
					label: "DNS- und TCP-Prüfdatensätze:",
					body: "90 Tage lang aufbewahrt, denn das ist der Verlauf, den die Detailseite eines Monitors und eine Nachbetrachtung direkt lesen.",
				},
				alertHistory: {
					label: "Benachrichtigungsverlauf:",
					body: "jede Benachrichtigung, die wir gesendet haben, nicht senden konnten oder absichtlich zurückgehalten haben, 90 Tage lang aufbewahrt, damit Sie nachvollziehen können, was Ihnen mitgeteilt wurde und was nicht.",
				},
				cronPings: {
					label: "Cron-Job-Rückmeldungen:",
					body: "365 Tage lang aufbewahrt. Die anfragende Adresse und der User-Agent, die dazu erfasst werden, werden nach 30 Tagen gelöscht; die Rückmeldung selbst bleibt.",
				},
			},
			customerData: {
				title: "Ihre Kontodaten",
				bodyPrefix: "Kontodaten, Zahlungsabwicklung, Cookies und Ihre Rechte daran werden von der ",
				privacyLinkText: "Datenschutzerklärung",
				bodySuffix:
					" abgedeckt, die das maßgebliche Dokument ist und keine zweimal geschriebene Zusammenfassung. Die Kurzfassung: Ihre Daten werden nicht verkauft, und Ihre Überwachungsdaten gehören Ihrem Team.",
			},
			ourIncidents: {
				title: "Wenn Uptime selbst einen Vorfall hat",
				retries:
					"Prüfungen werden in eine Warteschlange gestellt und nicht direkt ausgeführt, und eine Prüfung, die wegen eines Fehlers auf unserer Seite nicht abgeschlossen werden konnte, wird wiederholt statt erfasst. Keine unserer eigenen Störungen wird als Fehler Ihres Dienstes in den Verlauf Ihres Monitors geschrieben.",
				gaps: "Hält die Störung an, werden Prüfungen verzögert oder übersprungen. Eine übersprungene Prüfung schreibt nichts, deshalb erscheint der Zeitraum in Ihrem Verlauf als Lücke ohne Daten und nicht als Ausfall, den Sie nie hatten, und Ihre Werte werden aus den Prüfungen berechnet, die tatsächlich gelaufen sind.",
				missedAlerts:
					"Der Fehlerfall, den man verstehen sollte, ist der, der daraus folgt: fällt Ihr Endpunkt während unserer Störung aus, kann Ihre Benachrichtigung zu spät oder überhaupt nicht ankommen. Ein Überwachungsdienst kann Sie nicht benachrichtigen, während er selbst ausgefallen ist, und dieser ist keine Ausnahme.",
				noSlaPrefix:
					"Wir bieten keine Dienstgütevereinbarung an, und wir veröffentlichen keinen Verfügbarkeitswert, an dem wir uns messen lassen. Die ",
				termsLinkText: "Nutzungsbedingungen",
				noSlaSuffix:
					" sagen das auch, und diese Seite wird nicht stillschweigend etwas anderes behaupten. Was es stattdessen gibt: die Statusseite oben und eine Person, die auf E-Mails antwortet.",
			},
		},
	},

	legal: {
		terms: {
			meta: {
				title: "Nutzungsbedingungen | Uptime",
				description:
					"Nutzungsbedingungen für Uptime, den Uptime-Monitoring-Dienst von Sergio Xalambrí.",
			},

			lastUpdated: "Zuletzt aktualisiert: 11. Februar 2026",
			title: "Nutzungsbedingungen",

			sections: {
				introduction: {
					title: "1. Einleitung",
					body: "Willkommen bei Uptime. Diese Nutzungsbedingungen regeln Ihre Nutzung unseres Uptime-Monitoring-Dienstes, betrieben von Sergio Xalambrí. Mit dem Zugriff auf Uptime oder der Nutzung von Uptime erklären Sie sich mit diesen Bedingungen einverstanden.",
				},
				serviceDescription: {
					title: "2. Leistungsbeschreibung",
					body: "Uptime überwacht die Verfügbarkeit Ihrer Dienste und Ihrer geplanten Aufgaben: HTTP-Endpunkte, DNS, TCP-Ports, SSL-Zertifikate und Cronjobs. So behalten Sie den Zustand Ihrer Dienste und geplanten Aufgaben im Blick. Wir prüfen Ihre Endpunkte aus mehreren Regionen weltweit und benachrichtigen Sie, sobald Probleme erkannt werden.",
				},
				accountTerms: {
					title: "3. Kontobedingungen",
					first:
						"Sie müssen bei der Erstellung eines Kontos zutreffende und vollständige Angaben machen.",
					second:
						"Sie sind für die Sicherheit Ihrer Zugangsdaten und für alle Aktivitäten verantwortlich, die über Ihr Konto stattfinden.",
					third:
						"Sie müssen mindestens 18 Jahre alt oder befugt sein, diese Vereinbarung im Namen einer Organisation rechtsverbindlich abzuschließen.",
					fourth: "Sie müssen uns unverzüglich informieren, wenn Ihr Konto unbefugt genutzt wird.",
				},
				acceptableUse: {
					title: "4. Zulässige Nutzung",
					intro: "Bei der Nutzung von Uptime verpflichten Sie sich, Folgendes zu unterlassen:",
					first:
						"Unseren Dienst missbrauchen, überlasten oder stören oder versuchen, Nutzungsgrenzen zu umgehen.",
					second:
						"URLs oder Endpunkte überwachen, die Ihnen nicht gehören oder für die Sie keine Berechtigung haben.",
					third:
						"Cronjobs oder geplante Aufgaben überwachen, die Ihnen nicht gehören oder für die Sie keine Berechtigung haben.",
					fourth:
						"Cronjob-Ping-Endpunkte für andere Zwecke als die legitime Überwachung geplanter Aufgaben verwenden.",
					fifth: "Den Dienst für rechtswidrige oder unbefugte Zwecke nutzen.",
					sixth:
						"Versuchen, unbefugt auf unsere Systeme oder die Konten anderer Nutzer zuzugreifen.",
					seventh:
						"Den Dienst ohne unsere schriftliche Zustimmung weiterverkaufen oder weitergeben.",
				},
				paymentTerms: {
					title: "5. Zahlungsbedingungen",
					first:
						"Uptime rechnet nutzungsabhängig ab. Sie zahlen entsprechend der Anzahl Ihrer Monitore und der von Ihnen eingestellten Prüfhäufigkeit.",
					second: "Abonnements werden über Polar verwaltet und abgewickelt.",
					third:
						"Wenn Sie kündigen, erstatten wir den nicht genutzten Teil Ihres Abonnements anteilig.",
					fourth:
						"Wir behalten uns vor, die Preise mit einer Frist von 30 Tagen zu ändern. Die weitere Nutzung nach einer Preisänderung gilt als Zustimmung.",
				},
				dataAndPrivacy: {
					title: "6. Daten und Datenschutz",
					firstPrefix: "Für Ihre Nutzung von Uptime gilt außerdem unsere ",
					firstLinkText: "Datenschutzerklärung",
					firstSuffix: ", die beschreibt, wie wir Ihre Daten erheben, verwenden und schützen.",
					second:
						"Monitoring-Daten werden 365 Tage lang aufbewahrt. Danach werden historische Daten automatisch gelöscht.",
					third:
						"Sie können jederzeit die Löschung Ihrer Daten verlangen, indem Sie uns kontaktieren. Nach der Schließung Ihres Kontos werden Ihre Daten innerhalb von 30 Tagen gelöscht.",
				},
				serviceAvailability: {
					title: "7. Verfügbarkeit des Dienstes",
					first:
						"Wir streben eine Verfügbarkeit von 99,9 % an, aber das ist ein Ziel und keine Garantie. Wir bieten keine Service-Level-Agreements (SLAs) mit finanziellen Entschädigungen.",
					second:
						"Wartungsarbeiten kündigen wir nach Möglichkeit rechtzeitig im Voraus an. Notfallwartungen können ohne Ankündigung erfolgen.",
					third:
						"Wir haften nicht für Ausfallzeiten, Datenverluste oder Schäden, die durch geplante oder ungeplante Unterbrechungen des Dienstes entstehen.",
				},
				limitationOfLiability: {
					title: "8. Haftungsbeschränkung",
					first:
						"Uptime wird „wie besehen“ und „wie verfügbar“ bereitgestellt, ohne ausdrückliche oder stillschweigende Gewährleistungen jeglicher Art.",
					second:
						"Wir garantieren nicht, dass unser Dienst jeden Ausfall Ihrer überwachten Endpunkte erkennt. Die Überwachung hängt von Netzwerkbedingungen und anderen Faktoren ab, die außerhalb unserer Kontrolle liegen.",
					third:
						"Unsere Gesamthaftung Ihnen gegenüber für Ansprüche aus der Nutzung des Dienstes ist auf den Betrag begrenzt, den Sie uns in den 12 Monaten vor dem Anspruch gezahlt haben.",
					fourth: "Wir haften nicht für indirekte, zufällige, besondere, Folge- oder Strafschäden.",
				},
				termination: {
					title: "9. Beendigung",
					first:
						"Sie können Ihr Konto jederzeit über Ihre Kontoeinstellungen oder durch eine Nachricht an uns schließen.",
					second:
						"Wir können Ihr Konto sperren oder schließen, wenn Sie gegen diese Bedingungen verstoßen, oder aus anderen Gründen mit angemessener Vorankündigung.",
					third:
						"Mit der Beendigung endet Ihr Zugang zum Dienst und Ihre Daten werden innerhalb von 30 Tagen gelöscht.",
				},
				changesToTerms: {
					title: "10. Änderungen dieser Bedingungen",
					body: "Wir können diese Nutzungsbedingungen von Zeit zu Zeit aktualisieren. Über wesentliche Änderungen informieren wir Sie per E-Mail oder über den Dienst. Wenn Sie Uptime nach Inkrafttreten der Änderungen weiter nutzen, gilt das als Zustimmung zu den überarbeiteten Bedingungen.",
				},
				contact: {
					title: "11. Kontakt",
					prefix:
						"Wenn Sie Fragen zu diesen Nutzungsbedingungen haben, schreiben Sie uns bitte an ",
					email: "hello@sergiodxa.com",
				},
			},
		},
		privacy: {
			meta: {
				title: "Datenschutzerklärung | Uptime",
				description:
					"Datenschutzerklärung für Uptime. Erfahren Sie, wie wir Ihre Daten erheben, verwenden und schützen, wenn Sie unseren Uptime-Monitoring-Dienst nutzen.",
			},

			lastUpdated: "Zuletzt aktualisiert: 2. August 2026",
			title: "Datenschutzerklärung",

			sections: {
				introduction: {
					title: "1. Einleitung",
					first:
						"Diese Datenschutzerklärung beschreibt, wie Uptime, betrieben von Sergio Xalambrí („wir“, „uns“ oder „unser“), Ihre personenbezogenen Daten erhebt, verwendet und schützt, wenn Sie unseren Uptime-Monitoring-Dienst nutzen.",
					second:
						"Diese Erklärung gilt für alle Nutzer unseres Dienstes und umfasst die Daten, die über unsere Website und unsere Monitoring-Plattform erhoben werden.",
				},
				dataCollected: {
					title: "2. Daten, die wir erheben",
					accountData: {
						title: "Kontodaten",
						body: "Wenn Sie sich über die GitHub-Anmeldung registrieren, erheben wir Ihre E-Mail-Adresse und Ihren Anzeigenamen aus Ihrem GitHub-Profil.",
					},
					monitoringData: {
						title: "Monitoring-Daten",
						body: "Wir erheben Daten zu den Monitoren, die Sie anlegen, darunter die URLs, die Sie überwachen möchten, Antwortzeiten, HTTP-Statuscodes sowie Verfügbarkeits- und Ausfallereignisse.",
					},
					cronJobData: {
						title: "Daten zur Cronjob-Überwachung",
						intro: "Für die Überwachung von Cronjobs (geplanten Aufgaben) erheben wir:",
						first: "Ping-Zeitstempel (wann Ihre geplanten Aufgaben ihren Abschluss melden)",
						second: "Quell-IP-Adressen der Ping-Anfragen",
						third: "User-Agent-Angaben aus den Ping-Anfragen",
						fourth: "Zeitplan-Konfiguration (Cron-Ausdrücke, Zeitzonen, Karenzzeiten)",
						outro:
							"Diese Daten helfen Ihnen zu verfolgen, ob Ihre geplanten Aufgaben pünktlich laufen, und ermöglichen es uns, Sie zu benachrichtigen, wenn erwartete Pings ausbleiben.",
					},
					usageData: {
						title: "Nutzungsdaten",
						body: "Wir erheben Analyse- und Protokolldaten darüber, wie Sie unseren Dienst nutzen, darunter Seitenaufrufe, die Nutzung von Funktionen und Fehlerprotokolle.",
					},
					paymentData: {
						title: "Zahlungsdaten",
						body: "Die Zahlungsabwicklung übernimmt Polar. Wir speichern Ihre Kreditkartendaten nicht. Von Polar erhalten wir lediglich eine Bestätigung Ihres Abonnementstatus und Ihrer Rechnungshistorie.",
					},
				},
				dataUsage: {
					title: "3. Wie wir Ihre Daten verwenden",
					first: {
						label: "Um den Monitoring-Dienst bereitzustellen:",
						body: "Wir nutzen Ihre Daten, um die von Ihnen angegebenen URLs zu überwachen und deren Verfügbarkeit zu verfolgen.",
					},
					second: {
						label: "Um Warnungen und Benachrichtigungen zu senden:",
						body: "Wir nutzen Ihre E-Mail-Adresse, um Ihnen Ausfallwarnungen und Statusmeldungen zu schicken.",
					},
					third: {
						label: "Um den Dienst zu verbessern:",
						body: "Wir analysieren Nutzungsmuster, um Funktionen zu verbessern und Fehler zu beheben.",
					},
					fourth: {
						label: "Um mit Ihnen zu kommunizieren:",
						body: "Wir senden Ihnen unter Umständen Produktneuigkeiten, Sicherheitshinweise und Support-Nachrichten.",
					},
				},
				dataSharing: {
					title: "4. Weitergabe von Daten",
					noSell: "Wir verkaufen Ihre personenbezogenen Daten nicht.",
					intro:
						"Wir geben Daten an die folgenden Drittanbieter weiter, die uns beim Betrieb von Uptime unterstützen:",
					first: {
						label: "Cloudflare:",
						body: "Infrastruktur, Hosting und Auslieferung von Inhalten",
					},
					second: { label: "Polar:", body: "Zahlungsabwicklung und Abonnementverwaltung" },
					third: { label: "GitHub:", body: "Authentifizierung" },
					outro:
						"Wir können Ihre Daten außerdem offenlegen, wenn wir gesetzlich dazu verpflichtet sind oder um unsere Rechte und die Sicherheit unserer Nutzer zu schützen.",
				},
				dataRetention: {
					title: "5. Speicherdauer",
					first: { label: "Monitoring-Daten:", body: "365 Tage ab der Erhebung" },
					second: { label: "Kontodaten:", body: "Bis Sie Ihr Konto löschen" },
					third: { label: "Protokolle:", body: "30 Tage" },
				},
				rights: {
					title: "6. Ihre Rechte (DSGVO)",
					intro: "Nach der Datenschutz-Grundverordnung (DSGVO) haben Sie das Recht:",
					first: {
						label: "Auf Auskunft:",
						body: "Eine Kopie der personenbezogenen Daten anzufordern, die wir über Sie gespeichert haben",
					},
					second: {
						label: "Auf Berichtigung:",
						body: "Die Korrektur unrichtiger personenbezogener Daten zu verlangen",
					},
					third: {
						label: "Auf Löschung:",
						body: "Die Löschung Ihrer personenbezogenen Daten zu verlangen",
					},
					fourth: {
						label: "Auf Datenübertragbarkeit:",
						body: "Ihre Daten in einem übertragbaren Format zu erhalten",
					},
					fifth: {
						label: "Auf Widerspruch:",
						body: "Bestimmten Arten der Datenverarbeitung zu widersprechen",
					},
					outro:
						"Um eines dieser Rechte auszuüben, kontaktieren Sie uns bitte unter der unten angegebenen E-Mail-Adresse.",
				},
				security: {
					title: "7. Sicherheit",
					intro: "Wir setzen angemessene Sicherheitsmaßnahmen ein, um Ihre Daten zu schützen:",
					first: {
						label: "Verschlüsselung bei der Übertragung:",
						body: "Alle Daten werden über HTTPS/TLS übertragen",
					},
					second: {
						label: "Verschlüsselung im Ruhezustand:",
						body: "Gespeicherte Daten sind verschlüsselt",
					},
					third: {
						label: "Zugriffskontrollen:",
						body: "Strenge Zugriffskontrollen begrenzen, wer auf Ihre Daten zugreifen kann",
					},
					fourth: {
						label: "Regelmäßige Sicherheitsprüfungen:",
						body: "Wir überprüfen unsere Sicherheitspraktiken regelmäßig",
					},
				},
				cookies: {
					title: "8. Cookies",
					intro: "Wir verwenden nur die Cookies, die für den Betrieb des Dienstes nötig sind:",
					first: {
						label: "Sitzungs-Cookies:",
						body: "Für die Anmeldung und damit Sie angemeldet bleiben",
					},
					outro:
						"Wir verwenden keine Tracking-Cookies, keine Werbe-Cookies von Dritten und keine Cookies zu Marketingzwecken.",
				},
				turnstile: {
					title: "9. Bot-Schutz",
					first:
						"Die öffentliche Seite, auf der jeder ohne Konto eine URL prüfen kann, ist durch Cloudflare Turnstile geschützt. Es dient dazu, einen Menschen von einem Bot zu unterscheiden, damit die kostenlose Prüfung nicht durch automatisierten Traffic aufgebraucht wird.",
					second:
						"Dazu erhält Cloudflare Ihre IP-Adresse und Informationen über Ihren Browser und speichert möglicherweise ein Token in Ihrem Browser, um sich zu merken, dass die Prüfung bestanden wurde.",
					third:
						"Turnstile läuft ausschließlich auf dieser öffentlichen Seite. In der angemeldeten Anwendung wird es nirgendwo eingesetzt.",
					referencePrefix: "Was Cloudflare mit diesen Daten macht, steht im ",
					referenceLinkText: "Turnstile-Datenschutzzusatz",
					referenceSuffix: " von Cloudflare.",
				},
				childrensPrivacy: {
					title: "10. Datenschutz für Kinder",
					body: "Uptime ist nicht für Personen unter 18 Jahren bestimmt. Wir erheben wissentlich keine personenbezogenen Daten von Kindern unter 18 Jahren.",
				},
				internationalTransfers: {
					title: "11. Internationale Datenübermittlung",
					first:
						"Ihre Daten werden möglicherweise über das globale Netzwerk von Cloudflare verarbeitet. Wenn Sie sich in der Europäischen Union befinden, können Ihre Daten in die Vereinigten Staaten übermittelt und dort verarbeitet werden.",
					second:
						"Wir stützen uns auf die Standardvertragsklauseln von Cloudflare und weitere geeignete Garantien, damit Ihre Daten im Einklang mit den Anforderungen der DSGVO geschützt sind.",
				},
				changesToPolicy: {
					title: "12. Änderungen dieser Erklärung",
					first:
						"Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren. Über wesentliche Änderungen informieren wir Sie, indem wir die neue Fassung auf dieser Seite veröffentlichen und das Datum unter „Zuletzt aktualisiert“ anpassen.",
					second:
						"Bei erheblichen Änderungen schicken wir Ihnen zusätzlich eine E-Mail-Benachrichtigung, wenn Sie ein Konto bei uns haben.",
				},
				contact: {
					title: "13. Kontakt",
					body: "Wenn Sie Fragen zu dieser Datenschutzerklärung haben oder Ihre Datenrechte ausüben möchten, erreichen Sie uns unter:",
					email: "hello+privacy@sergiodxa.com",
				},
			},
		},
	},

	notFound: {
		title: "Seite nicht gefunden",
		description: "Die gesuchte Seite existiert nicht oder wurde möglicherweise verschoben.",
		goBackHome: "Zurück zur Startseite",
	},

	errors: {
		backHome: "Zur Startseite",
	},

	app: {
		meta: {
			title: "Uptime von Sergio Xalambrí",
			description: "Einfache und zuverlässige Uptime-Überwachung für Entwickler",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "Team auswählen" },
				userMenu: { label: "Benutzermenü" },
				toggle: "Navigation ein- oder ausblenden",

				navigation: {
					items: {
						dashboard: "Dashboard",
						alerts: "Benachrichtigungen",
						maintenance: "Wartung",
						monitors: "Monitore",
						httpMonitors: "HTTP-Monitore",
						statusPages: "Statusseiten",
						tcpMonitors: "TCP-Monitore",
						dnsMonitors: "DNS-Monitore",
						flowMonitors: "Flow-Monitore",
						cronJobs: "Cron Jobs",
						settings: "Einstellungen",
						billing: "Abrechnung",
						domains: "Domains",
						members: "Mitglieder",
						team: "Team",
						docs: "Dokumentation",
						apiKeys: "API-Schlüssel",
					},
				},

				account: {
					title: "Konto",
					overview: "Übersicht",
					teams: "Ihre Teams",
					signOut: "Abmelden",
				},
			},
			breadcrumbs: { label: "Navigationspfad" },
			toasts: {
				region: "Benachrichtigungen",
				dismiss: "Schließen",
			},
		},

		errors: {
			notFound: {
				title: "404 Nicht gefunden",
				description: "Das Team, das Sie suchen, existiert nicht.",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "Statistiken",
			uptime: "Uptime",
			totalChecks: "Gesamtprüfungen",
			lastCheck: "Letzte Prüfung",
			neverRan: "N/V",
		},

		actions: {
			refresh: "Aktualisieren",
			delete: {
				confirm: "Sind Sie sicher, dass Sie diesen Monitor löschen möchten?",
				cta: "Monitor löschen",
			},
		},
	},

	monitorList: {
		header: {
			title: "Uptime-Monitore",
			cta: "Monitor erstellen",
			subscribe: "Ihre Monitore sind pausiert. Abonnieren Sie, um die Überwachung fortzusetzen",
		},
	},

	statusPage: {
		banner: {
			operational: "Alle Systeme funktionieren",
			degraded: "Teilweiser Systemausfall",
			down: "Größerer Systemausfall",
		},
		status: {
			operational: "Betriebsbereit",
			degraded: "Beeinträchtigt",
			down: "Ausgefallen",
			unknown: "Unbekannt",
		},
		uptimeBar: {
			daysAgo: "Vor 90 Tagen",
			today: "Heute",
			legend: {
				full: "100%",
				partial: "Teilweise",
				down: "Ausgefallen",
				noData: "Keine Daten",
			},
			tooltip: {
				uptime: "{{percentage}}% Uptime",
				noData: "Keine Daten",
			},
		},
		cronJobs: {
			title: "Geplante Jobs",
			lastPing: "Letzter Ping",
			never: "Nie",
			schedule: "Zeitplan",
		},
		empty: {
			description: "Für diese Statusseite sind keine Dienste konfiguriert.",
		},
		footer: {
			lastUpdated: "Zuletzt aktualisiert {{date}}",
			poweredBy: "Bereitgestellt von Uptime",
		},
		error: {
			title: "Statusseite nicht gefunden",
			description: "Die gesuchte Statusseite existiert nicht oder ist nicht öffentlich.",
			goHome: "Zur Startseite",
		},
		dns: {
			coverage: "Alle erfassten DNS-Einträge dieser Domain",
		},
	},

	contentMonitoring: {
		title: "Inhaltsüberwachung",
		description:
			"Überprüfen Sie Antwortinhalte auf bestimmte Schlüsselwörter oder Muster. Der Monitor schlägt fehl, wenn eine Prüfung nicht besteht.",
		empty:
			"Keine Inhaltsprüfungen konfiguriert. Fügen Sie eine Prüfung hinzu, um bestimmte Schlüsselwörter oder Muster in der Antwort zu überwachen.",
		addButton: "Inhaltsprüfung hinzufügen",

		form: {
			title: "Prüfung hinzufügen",
			description: "Jede Prüfung wird bei jedem Ping auf den Antworttext angewendet.",
			checkType: {
				label: "Prüfungstyp",
				description: "Wählen Sie, wie der Antwortinhalt abgeglichen werden soll",
				options: {
					contains: "Enthält",
					notContains: "Enthält nicht",
					regex: "Regex-Muster",
				},
			},
			value: {
				label: "Wert",
				placeholder: "Schlüsselwort oder Muster eingeben",
				description: "Der Text oder das Regex-Muster, nach dem gesucht werden soll",
			},
			caseSensitive: "Groß-/Kleinschreibung beachten",
			cancel: "Abbrechen",
			add: "Prüfung hinzufügen",
		},

		item: {
			type: "Typ",
			status: "Status",
			caseSensitive: "Groß-/Kleinschreibung beachten",
			enabled: "Aktiviert",
			disabled: "Deaktiviert",
			yes: "Ja",
			no: "Nein",
			delete: "Löschen",
			deleteConfirmTitle: "Diese Inhaltsprüfung löschen?",
		},

		types: {
			contains: "Enthält",
			notContains: "Enthält nicht",
			regex: "Regex",
		},
	},

	auth: {
		error: {
			title: "Authentifizierungsfehler",
			errorCode: "Fehlercode: {{code}}",
			description: "Beschreibung: {{description}}",
			uri: "URI:",
			tryAgain:
				"Bitte versuchen Sie es erneut oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.",

			signInFailedTitle: "Anmeldung fehlgeschlagen",
			signInFailedGeneric:
				"Der Anmeldeversuch konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
			missingIdToken: "Der Identitätsanbieter hat kein ID-Token zurückgegeben.",
		},
	},

	dashboard: {
		header: {
			title: "Uptime-Monitore",
			cta: "Monitor erstellen",
			subscribe: "Ihre Monitore sind pausiert. Abonnieren Sie, um die Überwachung fortzusetzen",
		},

		monitor: {
			stats: {
				title: "Statistiken",
				uptime: "Uptime",
				totalChecks: "Gesamtprüfungen",
				lastCheck: "Letzte Prüfung",
				neverRan: "N/V",
			},

			actions: {
				refresh: "Aktualisieren",
				delete: {
					confirm: "Sind Sie sicher, dass Sie diesen Monitor löschen möchten?",
					cta: "Monitor löschen",
				},
			},
		},
	},

	createMonitor: {
		title: "Neuen Monitor erstellen",
		fields: {
			name: {
				label: "Monitor-Name",
				placeholder: "Startseite",
				description: "Ein beschreibender Name für Ihren Monitor.",
			},
			url: {
				label: "Zu überwachende URL",
				placeholder: "https://example.com/healthcheck",
				description: "Die URL des Dienstes, den Sie überwachen möchten.",
			},
			method: {
				label: "Anfragemethode",
				placeholder: "HEAD",
				description: "Die HTTP-Methode für die Anfrage.",
			},
			status: {
				label: "Erwarteter Statuscode",
				placeholder: "200",
				description: "Der HTTP-Statuscode, den Sie erwarten.",
			},
			interval: {
				label: "Prüfintervall",
				placeholder: "60",
				description: "Intervall in Sekunden. Minimum ist 60 Sekunden.",
			},
			visibility: {
				label: "Sichtbarkeit",
				description: "Öffentliche Monitore können mit jedem geteilt werden.",
				options: { public: "Öffentlich", private: "Privat" },
			},
			region: {
				label: "Region",
				description: "Die Region, von der aus der Ping ausgeführt wird.",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} Afrika",
					apac: "{{emoji}} Asien-Pazifik",
					eeur: "{{emoji}} Osteuropa",
					enam: "{{emoji}} Ost-Nordamerika",
					me: "{{emoji}} Naher Osten",
					oc: "{{emoji}} Ozeanien",
					sam: "{{emoji}} Südamerika",
					weur: "{{emoji}} Westeuropa",
					wnam: "{{emoji}} West-Nordamerika",
				},
			},
		},
		cta: "Monitor erstellen",
	},

	emails: {
		accountDeleted: {
			subject: "Ihr Uptime-Konto wurde gelöscht",
			preview: "Ihr Konto und die dazugehörigen Daten wurden gelöscht.",
			heading: "Ihr Konto wurde gelöscht",
			body: "Sie haben uns gebeten, Ihr Uptime-Konto zu löschen, und das haben wir getan. Ihre Teams, Monitore, Benachrichtigungen, Statusseiten und Einstellungen sind weg, jedes Team, das Ihnen gehörte, wurde mit ihnen gelöscht, und Ihr Abonnement wurde gekündigt.",
			retained: {
				intro: "Einiges konnten wir nicht löschen, damit Sie genau wissen, wie es um Sie steht:",
				billing:
					"Rechnungen und Zahlungsbelege, die unser Abrechnungsdienstleister aufbewahrt. Das Steuerrecht verlangt, dass wir sie behalten, und das Datenschutzrecht erlaubt es aus diesem Grund.",
				analytics:
					"Ergebnisse der Monitor-Prüfungen in unserem Analysespeicher. Dieser kann nur angehängt werden — es gibt keine Möglichkeit, einen Datensatz daraus zu löschen, sondern nur, ihn nach seinem Aufbewahrungsplan verfallen zu lassen.",
				logs: "Server-Anfrageprotokolle, aus dem gleichen Grund: Sie verfallen nach einem Aufbewahrungsplan und lassen sich nicht vorzeitig löschen.",
				identity:
					"Ihre Anmelde-Identität selbst, die beim Identitätsanbieter liegt, mit dem Sie sich angemeldet haben, und nicht bei uns.",
			},
			address:
				"Diese E-Mail-Adresse wurde nur gespeichert, damit wir Ihnen diese Nachricht senden konnten. Sie ist jetzt ebenfalls gelöscht.",
			footer:
				"Sie erhalten diese E-Mail, weil Sie uns gebeten haben, Ihr Uptime-Konto zu löschen. An diese Adresse wird keine weitere E-Mail gesendet.",
		},

		teamDeleted: {
			subject: "{{team}} wurde auf Uptime gelöscht",
			preview: "{{team}} und alles, was es überwacht hat, existieren nicht mehr.",
			heading: "{{team}} wurde gelöscht",
			body: "Die Person, der {{team}} gehörte, hat ihr Uptime-Konto gelöscht, und das Team wurde damit ebenfalls gelöscht. Sie haben keinen Zugriff mehr darauf.",
			lost: "Alles, was zu dem Team gehörte, ist weg: Seine Monitore, Benachrichtigungen und Statusseiten existieren nicht mehr, und nichts davon lässt sich wiederherstellen.",
			next: "Wenn Sie diese Überwachung weiterhin brauchen, können Sie auf Uptime ein eigenes Team erstellen und sie neu einrichten.",
			footer:
				"Sie erhalten diese E-Mail, weil Sie Mitglied von {{team}} auf Uptime waren. Sie müssen nichts weiter tun.",
		},

		teamInvite: {
			subject: "Sie wurden eingeladen, {{team}} auf Uptime beizutreten",
			preview: "{{team}} auf Uptime beitreten",
			heading: "Sie wurden eingeladen, {{team}} beizutreten",
			body: "{{team}} nutzt Uptime, um seine Dienste im Blick zu behalten. Nehmen Sie die Einladung an, um dem Team beizutreten.",
			action: "Einladung annehmen",
			footer:
				"Sie erhalten diese E-Mail, weil Sie jemand in sein Team auf Uptime eingeladen hat. Falls Sie damit nicht gerechnet haben, können Sie diese Nachricht ignorieren.",
		},

		alert: {
			subject: "[Uptime-Alarm] {{monitor}} ist {{status}}",
			preview: "{{monitor}} ist {{status}}",
			heading: "{{monitor}} ist {{status}}",
			action: "Dashboard öffnen",
			incidentCooldown:
				"Benachrichtigungen für diesen Vorfall: {{sent}} gesendet, {{suppressed}} durch die Abkühlzeit der Benachrichtigung zurückgehalten.",
			footer:
				"Sie erhalten diese E-Mail, weil eine der Benachrichtigungen Ihres Teams zu diesem Ereignis passt.",

			status: {
				up: "WIEDERHERGESTELLT",
				down: "AUSGEFALLEN",
				degraded: "BEEINTRÄCHTIGT",
			},

			fields: {
				monitor: "Monitor",
				status: "Status",
				time: "Zeit",
				url: "URL",
				responseStatus: "Antwortstatus",
				responseTime: "Antwortzeit",
				domain: "Domain",
				endpoint: "Endpunkt",
				schedule: "Zeitplan",
				lastPing: "Letzter Ping",
				nextExpected: "Nächster erwarteter Ping",
				hostname: "Hostname",
				expiresAt: "Läuft ab am",
				records: "Einträge",
				findings: "Was sich geändert hat",
			},

			values: {
				none: "—",
				never: "nie",
				monitor: "{{name}} ({{type}})",
				responseStatus: "{{actual}} (erwartet {{expected}})",
				milliseconds: "{{value}}ms",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}} ({{timezone}})",
				dnsRecordCounts: "{{missing}} fehlen, {{changed}} geändert, {{new}} neu gesehen",

				/** One finding, written out per outcome so each reads as its own sentence. */
				dnsFinding: {
					missing: "Löst nicht mehr auf: {{name}} {{type}} {{value}}",
					changed: "Löst jetzt auf zu: {{name}} {{type}} {{value}}",
					new: "Neu gesehen: {{name}} {{type}} {{value}}",
				},

				dnsMoreFindings: "… und {{count}} weitere",
			},

			/** Said only where it applies: what a DNS diff means, not what it found. */
			dns: {
				recordSetEditNote:
					"Ein Eintragssatz mit mehreren Werten hat in DNS keine Identität je Eintrag. Ein darin geänderter Wert wird deshalb als ein Eintrag, der nicht mehr auflöst, plus ein neuer Eintrag gemeldet.",
				newRecordsNote:
					"Neu gesehene Einträge werden noch nicht überwacht. Öffnen Sie den Monitor, um die erwarteten anzunehmen, oder korrigieren Sie Ihr DNS.",
			},
		},

		teamDigest: {
			action: "Dashboard öffnen",
			footer: "Sie erhalten diese E-Mail, weil Sie Mitglied von {{team}} auf Uptime sind.",
			manageAction: "Wählen, welche E-Mails Sie erhalten",

			status: {
				up: "Erreichbar",
				degraded: "Beeinträchtigt",
				down: "Ausgefallen",
				noData: "Nicht geprüft",
			},

			types: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cron: "Cron-Job",
			},

			columns: {
				monitor: "Monitor",
				status: "Status",
				uptime: "Verfügbarkeit",
			},

			values: {
				none: "—",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% Verfügbarkeit",
				legend: {
					up: "Erreichbar",
					degraded: "Beeinträchtigt",
					down: "Ausgefallen",
					noData: "Keine Daten",
				},
			},

			daily: {
				subject_one: "{{team}}: der Monitor braucht einen Blick",
				subject_other: "{{team}}: {{up}} von {{count}} Monitoren gestern erreichbar",
				subjectAll_one: "{{team}}: der Monitor war gestern erreichbar",
				subjectAll_other: "{{team}}: alle {{count}} Monitore gestern erreichbar",
				preview: "Der letzte vollständige Tag an Prüfungen bei {{team}}",
				heading: "Gestern bei {{team}}",
				summaryAll_one: "Der Monitor des Teams war am {{date}} erreichbar.",
				summaryAll_other: "Alle {{count}} Monitore waren am {{date}} erreichbar.",
				summary_one: "Der Monitor des Teams war am {{date}} nicht erreichbar.",
				summary_other: "{{up}} von {{count}} Monitoren waren am {{date}} erreichbar.",
			},

			weekly: {
				subject_one: "{{team}}: der Monitor hatte diese Woche einen schlechten Tag",
				subject_other: "{{team}}: {{up}} von {{count}} Monitoren die ganze Woche erreichbar",
				subjectAll_one: "{{team}}: der Monitor war die ganze Woche erreichbar",
				subjectAll_other: "{{team}}: alle {{count}} Monitore die ganze Woche erreichbar",
				preview: "Die letzten sieben Tage an Prüfungen bei {{team}}",
				heading: "Die letzten sieben Tage bei {{team}}",
				summaryAll_one: "Der Monitor des Teams war an jedem Tag erreichbar.",
				summaryAll_other: "Alle {{count}} Monitore waren an jedem Tag erreichbar.",
				summary_one: "Der Monitor des Teams war nicht an jedem Tag erreichbar.",
				summary_other: "{{up}} von {{count}} Monitoren waren an jedem Tag erreichbar.",
			},
		},

		trial: {
			stopAction: "Diese E-Mails beenden",

			/**
			 * The report page every per-target trial report links, shared because the wrap-up and the
			 * repeat-submission answer point at the same page with the same sentence.
			 */
			reportLink: {
				body: "Diesen Bericht gibt es auch unter einem Link, den Sie erneut öffnen oder teilen können:",
				action: "Online ansehen",
			},
			stop: "Ein Klick beendet alle URLs, um deren Beobachtung Sie uns gebeten haben, und löscht Ihre Adresse samt Daten. Sie können jederzeit über unsere Website neu beginnen.",

			status: {
				up: "ERREICHBAR",
				degraded: "BEEINTRÄCHTIGT",
				down: "AUSGEFALLEN",
			},

			fields: {
				url: "URL",
				status: "Status",
				previousStatus: "Vorheriger Status",
				responseStatus: "Antwortstatus",
				responseTime: "Antwortzeit",
				checkedAt: "Geprüft am",
				changedAt: "Geändert am",
				checks: "Durchgeführte Prüfungen",
				uptime: "Verfügbarkeit",
				slowest: "Langsamste Antwort",
			},

			values: {
				none: "—",
				milliseconds: "{{value}}ms",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% Verfügbarkeit",
				legend: {
					up: "Erreichbar",
					degraded: "Beeinträchtigt",
					down: "Ausgefallen",
					noData: "Keine Daten",
				},
			},

			confirmation: {
				subject: "Wir prüfen {{url}} jetzt stündlich",
				preview: "Die stündlichen Prüfungen von {{url}} haben begonnen",
				heading: "Wir prüfen {{url}} jetzt stündlich",
				body: "Das ist die Prüfung, die Sie gerade ausgeführt haben. Wir wiederholen sie stündlich bis zum {{until}} und schreiben Ihnen, sobald sich das Ergebnis ändert. Einmal täglich erhalten Sie außerdem eine Zusammenfassung.",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns auf unserer Website gebeten haben, diese URL zu prüfen.",
			},

			change: {
				subject: "{{url}} ist {{status}}",
				preview: "{{url}} ist {{status}}",
				heading: "{{url}} ist {{status}}",
				body: "Die stündliche Prüfung um {{time}} hat ein anderes Ergebnis geliefert als die vorherige.",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns gebeten haben, diese URL eine Woche lang zu beobachten.",
			},

			daily: {
				subject: "Täglicher Bericht: {{url}}",
				subjectMany: "Täglicher Bericht: {{total}} URLs",
				preview: "Die letzten 24 Stunden an Prüfungen von {{url}}",
				previewMany: "Die letzten 24 Stunden an Prüfungen von {{total}} URLs",
				heading: "{{url}} in den letzten 24 Stunden",
				headingMany: "Ihre {{total}} URLs in den letzten 24 Stunden",
				summaryAll: "Alle {{total}} waren bei der letzten Prüfung erreichbar.",
				summary: "{{up}} von {{total}} waren bei der letzten Prüfung erreichbar.",
				target: "{{url}} — {{status}}",
				rangeStart: "Vor 24 Stunden",
				rangeEnd: "Jetzt",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns auf unserer Website um diese Prüfungen gebeten haben.",
			},

			weekly: {
				subject: "Bericht über sieben Tage: {{url}}",
				preview: "Die vollständige Woche an Prüfungen von {{url}}",
				heading: "{{url}} in den letzten sieben Tagen",
				rangeStart: "Vor 7 Tagen",
				rangeEnd: "Heute",
				closing: "Das war der siebte Tag, damit enden die kostenlosen Prüfungen von {{url}} hier.",
				action: "Diese URL weiter prüfen",
				footer:
					"Sie erhalten diese E-Mail, weil Sie uns gebeten haben, diese URL eine Woche lang zu beobachten. Es ist die letzte.",
			},

			repeat: {
				subject: "Was wir bisher zu {{url}} gefunden haben",
				preview: "Die Prüfungen, die es zu {{url}} bereits gibt",
				heading: "{{url}} wird bereits geprüft",
				intro:
					"Sie haben uns am {{since}} gebeten, {{url}} zu beobachten. Das haben diese Prüfungen ergeben.",
				rangeStart: "Tag 1",
				rangeEnd: "Tag 7",
				closing:
					"Jede URL bekommt alle 30 Tage eine kostenlose Woche, diese Anfrage hat also keine zweite gestartet. Um {{url}} weiter zu prüfen — so oft Sie möchten und mit einer Warnung, sobald sich etwas ändert — nutzen Sie Uptime.",
				action: "Diese URL weiter prüfen",
				footer:
					"Sie erhalten diese E-Mail, weil Sie diese URL auf unserer Website eingereicht haben und uns bereits ein Bericht dazu vorlag.",
			},
		},
	},

	components: {
		copyButton: {
			label: "Kopieren",
			copied: "Kopiert!",
		},

		selectAll: {
			select: "Alle auswählen",
			clear: "Auswahl aufheben",
		},

		/**
		 * The scope picker, shared by the alert and maintenance-window forms. A monitor type
		 * is named the same wherever it is offered, so the option copy lives here once; the
		 * sentence describing what narrowing does to a given form stays on that form's page.
		 */
		monitorScope: {
			label: "Umfang",
			teamWide: "Teamweit (alle Monitore)",
			unknownMonitor: "Ein Monitor, den es nicht mehr gibt",
			types: {
				http: "HTTP-Monitore",
				dns: "DNS-Monitore",
				tcp: "TCP-Monitore",
				cron: "Cron-Jobs",
			},
			allOfType: {
				http: "Jeder HTTP-Monitor",
				dns: "Jeder DNS-Monitor",
				tcp: "Jeder TCP-Monitor",
				cron: "Jeder Cron-Job",
			},
		},
	},

	cron: {
		error: {
			empty: "Geben Sie einen Cron-Ausdruck ein.",
			"field-count":
				"Ein Cron-Ausdruck braucht genau fünf Felder: Minute, Stunde, Tag des Monats, Monat und Wochentag.",
			"seconds-not-supported":
				"Sekunden werden nicht unterstützt. Verwenden Sie das Format mit fünf Feldern, beginnend mit der Minute.",
			"unknown-macro":
				"Diese Kurzform wird nicht unterstützt. Verwenden Sie @hourly, @daily, @weekly, @monthly oder @yearly.",
			syntax: "Eines der Felder ist weder ein Wert noch ein Bereich, eine Liste oder ein Schritt.",
			"unknown-name":
				"Einer der Monats- oder Wochentagsnamen ist unbekannt. Verwenden Sie dreibuchstabige Abkürzungen wie JAN oder MON.",
			"out-of-range": "Einer der Werte liegt außerhalb des für sein Feld erlaubten Bereichs.",
			"reversed-range": "Einer der Bereiche beginnt nach seinem Ende.",
			"invalid-step": "Ein Schritt muss eine ganze Zahl größer als null sein.",
			"impossible-date": "Dieser Tag des Monats kommt im angegebenen Monat nie vor.",
		},
	},

	schedule: {
		interval: {
			minute_one: "Jede Minute",
			minute_other: "Alle {{count}} Minuten",
			hour_one: "Jede Stunde",
			hour_other: "Alle {{count}} Stunden",
		},
		hourly: {
			onTheHour: "Jede Stunde",
			atMinutes: "Jede Stunde zur Minute {{minutes}}",
		},
		daily: "Täglich um {{times}}",
		weekly: "Jeden {{days}} um {{times}}",
		monthly: "Monatlich am {{days}}. um {{times}}",
		yearly: "Jährlich am {{days}}. {{months}} um {{times}}",
		expression: "Individueller Zeitplan ({{expression}})",
	},

	actions: {
		checks: {
			queued: "Prüfung für „{{name}}“ eingereiht.",
			subscriptionRequired: "Für eine Prüfung ist ein aktives Abonnement erforderlich.",
		},

		addDomain: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Domains zu diesem Team hinzuzufügen.",
				alreadyExists: "{{hostname}} wurde am {{verifiedAt}} hinzugefügt.",
			},

			success: {
				accepted: "{{hostname}} wartet noch auf Verifizierung.",
				created: "{{hostname}} wurde zu {{team}} hinzugefügt. Verifizierung steht aus.",
			},
		},

		changeRole: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Rollen in diesem Team zu ändern.",
				cannotChangeOwner: "Sie können die Rolle des Team-Eigentümers nicht ändern.",
			},

			success: "Die Rolle von {{name}} wurde in {{team}} zu {{role}} geändert.",
		},

		createAlert: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Benachrichtigungen in diesem Team zu erstellen.",
				limitExceeded:
					"Sie haben das Limit von {{limit}} Benachrichtigungen in diesem Team erreicht.",
			},
			success: { created: "Benachrichtigung {{name}} wurde erstellt." },
		},

		createInvite: {
			email: {
				subject: "Sie wurden eingeladen, {{team}} auf Uptime beizutreten",
			},

			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Mitglieder zu diesem Team einzuladen.",
				alreadyAccepted: "Es gibt bereits ein Mitglied von {{team}} mit dieser E-Mail.",
			},

			success: "{{email}} wurde eingeladen, {{team}} beizutreten.",
		},

		createMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
			},

			success: "Monitor {{name}} wurde erstellt.",
		},

		/**
		 * Ein Massenimport meldet zwei Zahlen, und `partial` ist die entscheidende: eine Eingabe,
		 * bei der einige Zeilen durchgekommen sind, ist ein Erfolg mit einer To-do-Liste und kein
		 * Fehlschlag, deshalb nennt sie zuerst die Zahl der angelegten Monitore und dann die Zahl
		 * der Zeilen, die korrigiert werden müssen.
		 */
		importMonitors: {
			errors: {
				generic:
					"Hoppla! Etwas ist schiefgelaufen. Bitte prüfen Sie die Liste und versuchen Sie es erneut.",
				none: "Aus dieser Liste konnte nichts importiert werden. Prüfen Sie die Gründe unten und versuchen Sie es erneut.",
			},

			success_one: "1 Monitor wurde erstellt.",
			success_other: "{{count}} Monitore wurden erstellt.",
			partial_one: "1 Monitor wurde erstellt. {{rejected}} weitere konnten es nicht — siehe unten.",
			partial_other:
				"{{count}} Monitore wurden erstellt. {{rejected}} weitere konnten es nicht — siehe unten.",
		},

		updateMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Monitor existiert nicht.",
			},

			success: "Monitor {{name}} wurde aktualisiert.",
		},

		updateSsl: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Monitor existiert nicht.",
			},

			success: "SSL-Einstellungen für {{name}} wurden aktualisiert.",
		},

		deleteMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Monitore in diesem Team zu löschen.",
				notFound: "Dieser Monitor existiert nicht.",
			},
			success: "Monitor {{name}} wurde gelöscht.",
		},

		removeAlert: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				forbidden: "Sie sind nicht berechtigt, Benachrichtigungen in diesem Team zu entfernen.",
				notFound: "{{name}} existiert nicht.",
			},
			success: "Benachrichtigung {{name}} wurde entfernt.",
		},

		removeDomain: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Domains aus diesem Team zu entfernen.",
				notFound: "{{hostname}} existiert nicht.",
			},

			success: "{{hostname}} wurde aus {{team}} entfernt.",
		},

		removeMember: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Mitglieder aus diesem Team zu entfernen.",
				cannotRemoveOwner: "Sie können den Team-Eigentümer nicht entfernen.",
			},

			success: "{{name}} wurde aus {{team}} entfernt.",
		},

		retryDomainVerification: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed:
					"Sie sind nicht berechtigt, die Domain-Verifizierung in diesem Team zu wiederholen.",
				notFound: "{{hostname}} existiert nicht.",
				workflowFailed:
					"Der Verifizierungsprozess für {{hostname}} konnte nicht gestartet werden. Versuchen Sie es später erneut.",
			},

			success: {
				alreadyVerified: "{{hostname}} ist bereits verifiziert.",
				requested: "Wiederholung der Verifizierung für {{hostname}} wurde angefordert.",
			},
		},

		revokeInvite: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, Einladungen in diesem Team zu widerrufen.",
				notFound: "Diese Einladung existiert nicht.",
				alreadyAccepted: "Diese Einladung wurde bereits vom Eingeladenen angenommen.",
			},

			success: "Die Einladung von {{email}} wurde aus {{team}} widerrufen.",
		},

		updateTeam: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				forbidden: "Sie sind nicht berechtigt, Team-Einstellungen zu aktualisieren.",
			},

			success: {
				updated: "Team-Einstellungen wurden erfolgreich aktualisiert.",
			},
		},

		deleteTeam: {
			errors: {
				generic: "Hoppla! Beim Löschen des Teams ist etwas schiefgelaufen.",
				forbidden: "Nur der Team-Eigentümer kann das Team löschen.",
				confirmationRequired: "Bitte geben Sie DELETE zur Bestätigung ein.",
			},

			success: "{{team}} wurde gelöscht.",
		},

		leaveTeam: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notMember: "Sie sind kein Mitglied dieses Teams.",
				ownerCannotLeave:
					"Team-Eigentümer können ihr Team nicht verlassen. Übertragen Sie zuerst das Eigentum.",
				adminCannotLeave:
					"Admins können das Team nicht verlassen. Bitten Sie den Eigentümer, Sie zuerst herabzustufen.",
			},

			success: "Sie haben {{team}} verlassen.",
		},

		createStatusPage: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				slugTaken: "Dieser Slug wird bereits verwendet.",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Diese Statusseite existiert nicht.",
				slugTaken: "Dieser Slug wird bereits verwendet.",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Diese Statusseite existiert nicht.",
			},

			success: "Statusseite wurde gelöscht.",
		},

		createMaintenance: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				invalidDates: "Die Endzeit muss nach der Startzeit liegen.",
			},

			success: {
				created: "Wartungsfenster '{{name}}' wurde erstellt.",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieses Wartungsfenster existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, dieses Wartungsfenster zu löschen.",
			},

			success: "Wartungsfenster '{{name}}' wurde gelöscht.",
		},

		endMaintenance: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieses Wartungsfenster existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, dieses Wartungsfenster zu beenden.",
			},

			success: "Wartungsfenster '{{name}}' wurde vorzeitig beendet.",
		},

		createTeam: {
			errors: {
				generic: "Hoppla! Beim Erstellen des Teams ist etwas schiefgelaufen.",
			},

			success: {
				created: "Team {{name}} wurde erfolgreich erstellt.",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				limitExceeded: "Sie haben das Limit von {{limit}} DNS-Monitoren in diesem Team erreicht.",
			},

			success: {
				created: "DNS-Monitor {{name}} wurde erstellt.",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser DNS-Monitor existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, diesen DNS-Monitor zu aktualisieren.",
			},

			success: "DNS-Monitor {{name}} wurde aktualisiert.",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser DNS-Monitor existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, diesen DNS-Monitor zu löschen.",
			},

			success: "DNS-Monitor {{name}} wurde gelöscht.",
		},

		checkDnsMonitor: {
			success: { checked: "„{{name}}“ wurde geprüft." },
		},

		reviewDnsMonitor: {
			errors: {
				generic:
					"Wir konnten nicht speichern, welche Einträge überwacht werden sollen. Bitte versuchen Sie es erneut.",
			},
			success: {
				saved_one: "{{count}} Eintrag wird überwacht.",
				saved_other: "{{count}} Einträge werden überwacht.",
			},
		},

		toggleDnsMonitorRecord: {
			errors: {
				generic: "Wir konnten diesen Eintrag nicht ändern. Bitte versuchen Sie es erneut.",
			},
			success: {
				enabled: "{{name}} wird jetzt überwacht.",
				disabled: "{{name}} wird nicht mehr überwacht.",
			},
		},

		importDnsMonitorZoneFile: {
			errors: {
				generic: "Wir konnten diese Zonendatei nicht lesen. Bitte versuchen Sie es erneut.",
				tooLarge: "Eine Zonendatei darf höchstens {{limit}} groß sein.",
				tooManyNames:
					"Diese Zone hat mehr als {{limit}} Namen – mehr, als ein einzelner Monitor abdecken kann.",
			},
			success: {
				imported_one: "{{count}} Name aus Ihrer Zonendatei importiert.",
				imported_other: "{{count}} Namen aus Ihrer Zonendatei importiert.",
			},
		},

		createTcpMonitor: {
			errors: {
				generic: "Hoppla! Beim Erstellen des TCP-Monitors ist etwas schiefgelaufen.",
			},
			success: "TCP-Monitor {{name}} wurde erstellt.",
		},

		updateTcpMonitor: {
			errors: {
				generic: "Hoppla! Beim Aktualisieren des TCP-Monitors ist etwas schiefgelaufen.",
				notFound: "Dieser TCP-Monitor existiert nicht.",
			},
			success: "TCP-Monitor {{name}} wurde aktualisiert.",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "Hoppla! Beim Löschen des TCP-Monitors ist etwas schiefgelaufen.",
				notAllowed: "Sie sind nicht berechtigt, TCP-Monitore in diesem Team zu löschen.",
				notFound: "Dieser TCP-Monitor existiert nicht.",
			},
			success: "TCP-Monitor {{name}} wurde gelöscht.",
		},

		createApiKey: {
			errors: {
				generic: "Hoppla! Beim Erstellen des API-Schlüssels ist etwas schiefgelaufen.",
				limitExceeded: "Sie haben das Limit von {{limit}} API-Schlüsseln in diesem Team erreicht.",
			},
			success: {
				created: "API-Schlüssel '{{name}}' wurde erstellt.",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "Hoppla! Beim Löschen des API-Schlüssels ist etwas schiefgelaufen.",
				notFound: "Dieser API-Schlüssel existiert nicht.",
			},
			success: "API-Schlüssel '{{name}}' wurde gelöscht.",
		},

		updateLanguage: {
			errors: {
				generic: "Hoppla! Beim Aktualisieren Ihrer Spracheinstellung ist etwas schiefgelaufen.",
			},
			success: "Spracheinstellung erfolgreich aktualisiert.",
		},

		createCronJob: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				limitExceeded: "Sie haben das Limit von {{limit}} Cron Jobs in diesem Team erreicht.",
			},
			success: "Cron Job '{{name}}' wurde erstellt.",
		},

		updateCronJob: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Cron Job existiert nicht.",
			},
			success: "Cron Job '{{name}}' wurde aktualisiert.",
		},

		deleteCronJob: {
			errors: {
				generic: "Hoppla! Etwas ist schiefgelaufen.",
				notFound: "Dieser Cron Job existiert nicht.",
				forbidden: "Sie sind nicht berechtigt, diesen Cron Job zu löschen.",
			},
			success: "Cron Job '{{name}}' wurde gelöscht.",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "Dashboard",
			},

			quickPing: {
				title: "Schnellprüfung",
				description:
					"Prüfen Sie eine URL einmalig. Nichts gespeichert, keine Benachrichtigungen, ein Ping.",
				field: {
					label: "Zu prüfende URL",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "Einmal prüfen",
					/** Names the icon button that opens the bar as a sheet, below the width it is a row at. */
					open: "Schnellprüfung öffnen",
				},
				result: {
					/** Names the toast region a finished check is reported in. */
					label: "Prüfergebnis",
					noResponse: "Keine Antwort",
					status: {
						up: "Aktiv",
						degraded: "Beeinträchtigt",
						down: "Ausgefallen",
					},
				},
				error: {
					invalidUrl: "Geben Sie eine vollständige http:// oder https:// URL ein.",
					subscriptionRequired: "Für eine Prüfung ist ein aktives Abonnement erforderlich.",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Noch keine Monitore",
				description: "Erstellen Sie Ihren ersten Monitor, um Ihre Dienste zu verfolgen.",
				cta: "Monitor erstellen",
			},

			tabs: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cronJobs: "Cron-Jobs",
			},

			stats: {
				monitors: {
					label: "Monatliche Ping-Nutzung",
					value: "{{consumed}}<small> verwendet</small>",
					description: "Von {{estimated}} geschätzt",
					unavailable: "Schätzung nicht verfügbar",
				},

				uptime: {
					label: "Uptime-Prozentsatz",
					description: "Gesamte System-Uptime",
				},

				httpMonitors: {
					label: "HTTP-Monitore",
					create: "Neuer HTTP-Monitor",
					breakdown: {
						up: "{{up}} aktiv",
						down: "{{down}} ausgefallen",
					},
				},
				dnsMonitors: {
					label: "DNS-Monitore",
					create: "Neuer DNS-Monitor",
					/** One monitor is one domain, so this count is smaller than the work behind it. */
					hint: "Ein Monitor deckt eine gesamte Domain und alle darauf erfassten Einträge ab.",
					breakdown: {
						ok: "{{ok}} ok",
						changed: "{{changed}} geändert",
						error: "{{error}} Fehler",
					},
				},
				flowMonitors: {
					label: "Flow-Monitore",
					create: "Neuer Flow-Monitor",
					breakdown: {
						up: "{{up}} erfolgreich",
						down: "{{down}} fehlgeschlagen",
						error: "{{error}} nicht ausführbar",
					},
				},

				tcpMonitors: {
					label: "TCP-Monitore",
					create: "Neuer TCP-Monitor",
					breakdown: {
						up: "{{up}} aktiv",
						down: "{{down}} ausgefallen",
					},
				},
				cronJobs: {
					label: "Cron-Jobs",
					create: "Neuer Cron-Job",
					breakdown: {
						healthy: "{{healthy}} gesund",
						late: "{{late}} verspätet",
						missed: "{{missed}} verpasst",
					},
				},

				slowestEndpoint: {
					label: {
						default: 'Langsamster Endpunkt "<em>{{name}}</em>"',
						noData: "Langsamster Endpunkt",
					},
					value: { noData: "N/V" },
					description: "In den letzten 24 Stunden",
				},
			},

			loading: "Wird geladen…",

			panel: {
				tabsLabel: "Monitortyp",
				tabPanelLabel: "{{tab}}-Monitore",
				refresh: "Aktualisieren",
			},

			error: {
				card: {
					label: "Fehler",
					value: "-",
					description: "Daten konnten nicht geladen werden",
				},
				table: {
					message: "Monitore konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
				},
				analytics: {
					message:
						"Analysedaten sind vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
				},
			},

			table: {
				label: "Monitore",

				columns: {
					name: "Name",
					latencyChart: "Latenztrend",
					status: "Status",
					lastIncident: "Letzter Vorfall",
					responseTime: "Durchschn. Latenz",
					actions: "Aktionen",
				},

				status: {
					up: "Aktiv & Läuft",
					down: "Ausgefallen",
					degraded: "Beeinträchtigt",
					unknown: "Keine Daten",
				},

				lastIncident: { never: "-" },
				responseTime: "~{{value}}",

				actions: {
					menu: "Aktionsmenü",
					edit: "Monitor bearbeiten",
					delete: "Monitor löschen",
					play: "Monitor ausführen",
				},

				confirmation: {
					deleteMonitor:
						"Sind Sie sicher, dass Sie den Monitor {{name}} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
				},
			},
		},

		monitors: {
			header: {
				title: "Uptime-Monitore",
				cta: "Monitor erstellen",
				subscribe: "Ihre Monitore sind pausiert. Abonnieren Sie, um die Überwachung fortzusetzen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},
		},

		createMonitor: {
			header: {
				title: "Monitor erstellen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Startseite",
						description: "Ein beschreibender Name für Ihren Monitor.",
					},
					url: {
						label: "Zu überwachende URL",
						placeholder: "https://example.com/healthcheck",
						description: "Die URL des Dienstes, den Sie überwachen möchten.",
					},
					method: {
						label: "Anfragemethode",
						placeholder: "HEAD",
						description: "Die HTTP-Methode für die Anfrage.",
					},
					status: {
						label: "Erwarteter Statuscode",
						placeholder: "200",
						description: "Der HTTP-Statuscode, den Sie erwarten.",
					},
					interval: {
						label: "Prüfintervall",
						placeholder: "60",
						description: "Intervall in Sekunden. Minimum ist 60 Sekunden.",
					},
					visibility: {
						label: "Sichtbarkeit",
						description: "Öffentliche Monitore können mit jedem geteilt werden.",
						options: { public: "Öffentlich", private: "Privat" },
					},
					region: {
						label: "Region",
						description: "Die Region, von der aus der Ping ausgeführt wird.",
						placeholder: "Region auswählen",
						options: {
							afr: "{{emoji}} Afrika",
							apac: "{{emoji}} Asien-Pazifik",
							eeur: "{{emoji}} Osteuropa",
							enam: "{{emoji}} Ost-Nordamerika",
							me: "{{emoji}} Naher Osten",
							oc: "{{emoji}} Ozeanien",
							sam: "{{emoji}} Südamerika",
							weur: "{{emoji}} Westeuropa",
							wnam: "{{emoji}} West-Nordamerika",
						},
					},
				},

				sections: {
					basics: {
						title: "Grundlagen",
						description: "Was dieser Monitor überwacht.",
					},
					checks: {
						title: "Prüfeinstellungen",
						description:
							"Wie oft der Monitor läuft, welche Antwort er erwartet und von wo aus er läuft.",
					},
				},

				cta: "Monitor erstellen",
			},
		},

		editMonitor: {
			header: {
				title: "Monitor bearbeiten",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Startseite",
						description: "Ein beschreibender Name für Ihren Monitor.",
					},
					url: {
						label: "Zu überwachende URL",
						placeholder: "https://example.com/healthcheck",
						description: "Die URL des Dienstes, den Sie überwachen möchten.",
					},
					method: {
						label: "Anfragemethode",
						placeholder: "HEAD",
						description: "Die HTTP-Methode für die Anfrage.",
					},
					status: {
						label: "Erwarteter Statuscode",
						placeholder: "200",
						description: "Der HTTP-Statuscode, den Sie erwarten.",
					},
					interval: {
						label: "Prüfintervall",
						placeholder: "60",
						description: "Intervall in Sekunden. Minimum ist 60 Sekunden.",
					},
					visibility: {
						label: "Sichtbarkeit",
						description: "Öffentliche Monitore können mit jedem geteilt werden.",
						options: { public: "Öffentlich", private: "Privat" },
					},
					region: {
						label: "Region",
						description: "Die Region, von der aus der Ping ausgeführt wird.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} Afrika",
							apac: "{{emoji}} Asien-Pazifik",
							eeur: "{{emoji}} Osteuropa",
							enam: "{{emoji}} Ost-Nordamerika",
							me: "{{emoji}} Naher Osten",
							oc: "{{emoji}} Ozeanien",
							sam: "{{emoji}} Südamerika",
							weur: "{{emoji}} Westeuropa",
							wnam: "{{emoji}} West-Nordamerika",
						},
					},
					ssl: {
						enabled: {
							label: "SSL-Überwachung aktivieren",
							description:
								"Überwachen Sie den Ablauf des SSL-Zertifikats und erhalten Sie Benachrichtigungen, bevor es abläuft.",
						},
						expiresAt: {
							label: "Zertifikats-Ablaufdatum",
							placeholder: "Ablaufdatum auswählen",
							description:
								"Geben Sie das Ablaufdatum Ihres SSL-Zertifikats ein. Sie finden dies im Dashboard Ihres Hosting-Anbieters oder indem Sie die Zertifikatsdetails in Ihrem Browser überprüfen.",
						},
						issuer: {
							label: "Zertifikatsaussteller",
							placeholder: "Let's Encrypt, DigiCert, etc.",
							description:
								"Die Zertifizierungsstelle, die Ihr SSL-Zertifikat ausgestellt hat (optional).",
						},
						warningDays: {
							label: "Warnung vor Ablauf",
							description:
								"Erhalten Sie Benachrichtigungen diese Anzahl von Tagen vor Ablauf des Zertifikats.",
						},
					},
				},

				sections: {
					basics: {
						title: "Grundlagen",
						description: "Was dieser Monitor überwacht.",
					},
					checks: {
						title: "Prüfeinstellungen",
						description:
							"Wie oft der Monitor läuft, welche Antwort er erwartet und von wo aus er läuft.",
					},
				},

				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			ssl: {
				title: "SSL-Zertifikatsüberwachung",
				description:
					"Behalten Sie den Ablauf Ihres Zertifikats im Blick, damit Sie ihn vor Ihren Besuchern bemerken.",
				cta: "SSL-Einstellungen speichern",
			},

			dangerZone: {
				title: "Gefahrenzone",
				description: "Aktionen in diesem Bereich können nicht rückgängig gemacht werden.",
				warning:
					"Beim Löschen dieses Monitors gehen seine Prüfungen, sein Verlauf und seine Benachrichtigungen endgültig verloren.",
				delete: "Monitor löschen",
			},
		},

		monitor: {
			header: {
				title: 'Monitor "{{name}}"',

				action: {
					play: "Monitor ausführen",
					running: "Wird ausgeführt…",
					edit: "Monitor bearbeiten",
					refresh: "Aktualisieren",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			stats: {
				monitors: {
					label: "Monatliche Ping-Nutzung",
					value: "{{consumed}}<small> verwendet</small>",
					description: "Von {{estimated}} geschätzt",
					estimateUnavailable: "Schätzung nicht verfügbar",
				},

				uptime: {
					label: "Uptime-Prozentsatz",
					description: "Letzte 90 Tage",
				},

				slowestResult: {
					label: "Langsamstes Ergebnis",
					description: "In den letzten 24 Stunden",
				},

				p99ResponseTime: {
					label: "P99 Antwortzeit",
					value: "{{value}} ms",
					description: "p99, letzte 24 Std.",
				},
			},

			ssl: {
				title: "SSL-Zertifikat",
				status: {
					valid: "Gültig",
					expiring: "Läuft bald ab",
					expired: "Abgelaufen",
					error: "Fehler",
					unknown: "Nicht konfiguriert",
				},
				expiresAt: "Läuft ab",
				expiresIn: "{{days}} Tage",
				issuer: "Aussteller",
				lastChecked: "Zuletzt geprüft",
				notConfigured: "SSL-Überwachung ist für diesen Monitor nicht aktiviert.",
				configure: "SSL-Überwachung konfigurieren",
			},
			run: {
				toast: {
					up: "{{name}} ist aktiv",
					down: "{{name}} ist ausgefallen",
					degraded: "{{name}} ist beeinträchtigt",
					changed: "Die soeben ausgeführte Prüfung hat den Status dieses Monitors geändert.",
					notQueued: {
						title: "Prüfung nicht ausgeführt",
						description: "Zum Ausführen einer Prüfung ist ein aktives Abonnement erforderlich.",
					},
				},
			},
		},

		billing: {
			header: {
				title: "Abrechnung",
			},
			ownerOnly: "Nur der Teambesitzer kann die Abrechnung für dieses Team einsehen und verwalten.",
		},

		members: {
			header: {
				title: "Team-Mitglieder",

				action: {
					invite: "Mitglied einladen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			sections: {
				members: {
					title: "Mitglieder",
					description: "Verwalten Sie Ihre Team-Mitglieder und deren Rollen.",
				},
			},

			membersTable: {
				label: "Aktuelle Mitglieder",
				description: "Personen, die Zugang zu diesem Team haben.",

				columns: {
					name: "Name",
					role: "Team-Rolle",
					actions: "Aktionen",
				},

				role: {
					member: "Mitglied",
					admin: "Admin",
					owner: "Eigentümer",
				},

				actions: {
					menu: "Aktionsmenü",
					remove: "Aus Team entfernen",
					transfer: "Eigentum übertragen",
					changeRole: {
						member: "Zu Admin konvertieren",
						admin: "Zu Mitglied konvertieren",
						owner: "Eigentümer kann nicht geändert werden",
					},
				},

				confirmation: {
					removeMember: "Sind Sie sicher, dass Sie {{name}} aus dem Team entfernen möchten?",
				},
			},

			invitedMembersTable: {
				label: "Ausstehende Einladungen",
				description: "Personen, die eingeladen wurden, aber noch nicht beigetreten sind.",

				columns: {
					email: "E-Mail",
					actions: "Aktionen",
				},

				actions: {
					menu: "Aktionsmenü",
					copy: "Einladungslink kopieren",
					revoke: "Einladung widerrufen",
				},

				confirmation: {
					revokeInvite: "Sind Sie sicher, dass Sie die Einladung von {{email}} widerrufen möchten?",
				},
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		invite: {
			header: {
				title: "Team-Mitglied einladen",
				description: "Senden Sie eine Einladung, Ihrem Team beizutreten.",
			},

			dialog: {
				close: "Dialog schließen",
			},

			form: {
				fields: {
					email: {
						label: "E-Mail-Adresse",
						placeholder: "max.mustermann@beispiel.de",
						description: "Die E-Mail-Adresse der Person, die Sie zu {{team}} einladen möchten.",
					},
				},

				cancel: "Abbrechen",
				cta: "Mitglied einladen",
			},
		},

		acceptInvite: {
			errors: {
				notFound: "Diese Einladung existiert nicht.",
				gone: "Diese Einladung wurde bereits angenommen.",
				forbidden: "Diese Einladung war nicht für Sie bestimmt.",
				pageTitle: "Einladung nicht verfügbar",
				badRequest:
					"Sie haben anscheinend keine E-Mail-Adresse. Versuchen Sie, sich erneut anzumelden.",
				wrongEmail:
					"Diese Einladung wurde an {{email}} gesendet. Melde dich mit dieser E-Mail-Adresse an, um sie anzunehmen.",
			},
		},

		domains: {
			header: {
				title: "Team-Domains",
				action: { addDomain: "Domain hinzufügen" },
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			sections: {
				domains: {
					title: "Domains",
					description: "Verwalten Sie verifizierte Domains für Ihr Team.",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "Domain",
						placeholder: "beispiel.de",
						description: "Die Domain, die Sie zu {{team}} hinzufügen möchten.",
					},
				},

				cta: "Domain hinzufügen",
			},

			table: {
				label: "Verifizierte Domains",
				description:
					"Domains, die für die automatische Bereitstellung von Team-Mitgliedern verwendet werden können.",

				columns: {
					hostname: "Hostname",
					id: "Verifizierungs-ID",
					verifiedAt: "Verifiziert am",
					actions: "Aktionen",
				},

				verifiedAt: {
					pending: "Wartet auf Verifizierung",
				},

				actions: {
					menu: "Aktionsmenü",
					copy: "Verifizierungs-ID kopieren",
					remove: "Domain entfernen",
					retryVerification: "Verifizierung wiederholen",
				},

				confirmation: {
					removeDomain: "Sind Sie sicher, dass Sie {{hostname}} aus dem Team entfernen möchten?",
				},
			},

			instructions: {
				title: "So verifizieren Sie Ihre Domain",

				description:
					"Um Ihre Domain zu verifizieren, fügen Sie den folgenden `TXT`-Eintrag zu Ihren DNS-Einstellungen hinzu:",

				record: {
					name: {
						label: "Name",
						value: "_ping-verification",
					},
					content: {
						label: "Inhalt",
						value: "VERIFICATION_ID",
					},
				},

				note: "Stellen Sie sicher, dass Sie <code>VERIFICATION_ID</code> durch die oben angezeigte tatsächliche Verifizierungs-ID ersetzen.",

				disclaimer:
					"DNS-Änderungen können einige Zeit zur Propagierung benötigen, daher kann sich die Verifizierung verzögern.",
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		alerts: {
			header: {
				title: "Benachrichtigungen",

				action: {
					create: "Benachrichtigung erstellen",
					history: "Verlauf anzeigen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Keine Benachrichtigungen konfiguriert",
				description:
					"Erstellen Sie eine Benachrichtigung, um informiert zu werden, wenn Ihre Monitore ausfallen.",
				cta: "Benachrichtigung erstellen",
			},

			limitReached: "Dieses Team hat das Limit von {{limit}} Benachrichtigungen erreicht.",

			form: {
				fields: {
					name: {
						label: "Name",
						placeholder: "CTO-Benachrichtigung",
						description: "Ein Name zur Identifizierung der Benachrichtigung.",
					},

					// The picker's own copy is shared with the maintenance-window form; only this
					// sentence, which is about alerts, stays here. See `components.monitorScope`.
					scope: {
						description:
							"Was diese Benachrichtigung überwacht. Lassen Sie sie teamweit, beschränken Sie sie auf eine Monitor-Art oder richten Sie sie auf einen einzelnen Monitor.",
					},

					channel: {
						label: "Kanal",
						description: "Der Kanal für die Benachrichtigung.",
						options: {
							webhook: "Webhook",
							email: "E-Mail",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL",
								placeholder: "https://beispiel.de/webhook",
								description: "Die URL, an die die Benachrichtigungs-Payload gesendet wird.",
							},
							secret: {
								label: "Signatur-Geheimschlüssel (optional)",
								placeholder: "optionaler-geheimschlüssel",
								description:
									"Ein optionaler Geheimschlüssel für die Request-Header. Ein `Webhook-Signature`-Header wird mit einer HMAC SHA256-Signatur der Payload unter Verwendung dieses Geheimnisses hinzugefügt.",
							},
							signatureNote:
								"Wenn festgelegt, tragen Anfragen einen <code>Webhook-Signature: sha256=<hex></code>-Header — eine HMAC-SHA256-Signatur des rohen JSON-Bodys mit diesem Geheimnis.",
						},
						email: {
							to: {
								label: "Empfänger",
								placeholder: "cto@beispiel.de",
								description: "Die E-Mail-Adresse, an die die Benachrichtigung gesendet wird.",
							},

							subjectPrefix: {
								label: "Betreff-Präfix (optional)",
								placeholder: "[Uptime-Benachrichtigung]",
								description:
									"Ein optionales Präfix für den E-Mail-Betreff. Nützlich zum Filtern von Benachrichtigungen in Ihrem Posteingang.",
							},
						},
						slack: {
							webhookUrl: {
								label: "Webhook-URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Die Slack Incoming Webhook-URL. Erstellen Sie eine unter api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Kanal-Override (optional)",
								placeholder: "#alerts",
								description:
									"Optionaler Kanal anstelle des Webhook-Standards. Fügen Sie das #-Präfix hinzu.",
							},
						},
						discord: {
							webhookUrl: {
								label: "Webhook-URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"Die Discord Webhook-URL. Erstellen Sie eine unter Servereinstellungen > Integrationen > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Bei Wiederherstellung benachrichtigen",
						description:
							"Senden Sie eine Benachrichtigung, wenn der Monitor sich von einem Ausfall erholt. Enthält Wiederherstellungszeit und Ausfalldauer.",
					},

					cooldown: {
						label: "Benachrichtigungs-Cooldown",
						description:
							"Mindestzeit zwischen Benachrichtigungen desselben Typs. Verhindert Benachrichtigungsmüdigkeit bei andauernden Ausfällen.",
						options: {
							none: "Kein Cooldown",
							"5min": "5 Minuten",
							"15min": "15 Minuten",
							"30min": "30 Minuten",
							"1hour": "1 Stunde",
							"2hours": "2 Stunden",
							custom: "Benutzerdefiniert",
						},
						custom: {
							label: "Benutzerdefinierter Cooldown (Minuten)",
							placeholder: "Minuten eingeben",
							description: "Geben Sie die Anzahl der Minuten zwischen Benachrichtigungen ein.",
						},
					},

					cooldownMinutes: {
						label: "Abkühlzeit (Minuten)",
						description:
							"Wie lange gewartet wird, bevor eine Benachrichtigung wiederholt wird, solange ein Monitor noch ausgefallen ist. Die erste Benachrichtigung eines Vorfalls geht immer sofort raus, und eine Wiederherstellung wird immer gesendet. Wiederholungen liegen niemals weniger als {{floor}} Minuten auseinander, was Sie hier auch eintragen.",
					},

					legends: {
						email: "E-Mail-Einstellungen",
						webhook: "Webhook-Einstellungen",
						slack: "Slack-Einstellungen",
						discord: "Discord-Einstellungen",
					},
				},

				cta: "Benachrichtigung erstellen",
			},

			table: {
				label: "Benachrichtigungen",

				columns: {
					name: "Name",
					scope: "Umfang",
					strategy: "Typ",
					notifyOnRecovery: "Wiederherstellung",
					cooldown: "Cooldown",
					actions: "Aktionen",
				},

				scope: {
					unknownMonitor: "Unbekannter Monitor",
					teamWide: "Teamweit",
					allOfType: {
						http: "Alle HTTP-Monitore",
						dns: "Alle DNS-Monitore",
						tcp: "Alle TCP-Monitore",
						cron: "Alle Cron-Jobs",
					},
				},

				cooldown: {
					none: "Schnellstmöglich",
					minutes: "{{count}} Min.",
					hours: "{{count}} Std.",
				},

				actions: {
					menu: "Aktionsmenü",
					edit: "Benachrichtigung bearbeiten",
					remove: "Benachrichtigung entfernen",
				},

				types: {
					webhook: "Webhook",
					email: "E-Mail",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "Ja",
					disabled: "Nein",
				},

				confirmation: {
					deleteAlert: "Sind Sie sicher, dass Sie die Benachrichtigung {{name}} löschen möchten?",
				},
			},
		},

		statusPages: {
			header: {
				title: "Statusseiten",

				action: {
					create: "Statusseite erstellen",
				},
			},

			empty: {
				title: "Noch keine Statusseiten",
				description:
					"Erstellen Sie eine Statusseite, um Ihren Systemstatus mit Ihren Benutzern zu teilen.",
				cta: "Statusseite erstellen",
			},

			table: {
				label: "Statusseiten",

				columns: {
					name: "Name",
					slug: "URL",
					services: "Dienste",
					monitors: "Monitore",
					visibility: "Sichtbarkeit",
					actions: "Aktionen",
				},

				visibility: {
					public: "Öffentlich",
					private: "Privat",
				},

				actions: {
					menu: "Aktionsmenü",
					view: "Seite anzeigen",
					edit: "Seite bearbeiten",
					delete: "Seite löschen",
				},

				confirmation: {
					delete: "Sind Sie sicher, dass Sie die Statusseite {{name}} löschen möchten?",
				},
			},

			form: {
				fields: {
					name: {
						label: "Interner Name",
						placeholder: "Produktionsstatus",
						description: "Ein Name zur internen Identifizierung der Statusseite.",
					},
					slug: {
						label: "URL-Slug",
						placeholder: "produktion",
						description: "Der URL-Pfad für die öffentliche Statusseite (z.B. /status/produktion).",
					},
					title: {
						label: "Öffentlicher Titel",
						placeholder: "Firma GmbH Status",
						description: "Der Titel, der auf der öffentlichen Statusseite angezeigt wird.",
					},
					description: {
						label: "Beschreibung",
						placeholder: "Aktueller Status der Firma GmbH Dienste",
						description: "Eine optionale Beschreibung für die Statusseite.",
					},
					logoUrl: {
						label: "Logo-URL",
						placeholder: "https://beispiel.de/logo.png",
						description: "Ein optionales Logo für die Statusseite.",
					},
					isPublic: {
						label: "Öffentlich",
						description: "Machen Sie diese Statusseite für jeden mit dem Link zugänglich.",
					},
					showOverallStatus: {
						label: "Gesamtstatus anzeigen",
						description: "Zeigen Sie ein Gesamtstatus-Banner oben auf der Seite an.",
					},
					monitors: {
						label: "Einzuschließende Monitore",
						description:
							"Wählen Sie, welche Monitore auf dieser Statusseite angezeigt werden sollen.",
					},
					cronJobs: {
						label: "Einzuschließende Cron Jobs",
						description:
							"Wählen Sie, welche Cron Jobs auf dieser Statusseite angezeigt werden sollen.",
					},
				},

				cta: "Statusseite erstellen",
				ctaUpdate: "Änderungen speichern",
			},
		},

		createStatusPage: {
			header: {
				title: "Statusseite erstellen",
			},
			form: {
				sections: {
					branding: {
						title: "Branding",
						description: "Wie sich die Seite ausweist – intern und gegenüber den Besuchern.",
					},
					visibility: {
						title: "Sichtbarkeit",
						description: "Wer diese Seite erreichen kann und wie viel sie auf einen Blick verrät.",
					},
					services: {
						title: "Dienste",
						description: "Wählen Sie die Monitore und Cron Jobs, über die diese Seite berichtet.",
						empty:
							"Sie haben noch keine Monitore oder Cron Jobs. Legen Sie einen an, dann können Sie ihn später zu dieser Seite hinzufügen.",
					},
				},
			},
		},

		editStatusPage: {
			header: {
				title: "Statusseite bearbeiten",
			},
			form: {
				sections: {
					branding: {
						title: "Branding",
						description: "Wie sich die Seite ausweist – Ihnen und Ihren Besuchern gegenüber.",
					},
					visibility: {
						title: "Sichtbarkeit",
						description: "Wer diese Seite erreichen kann und was oben angezeigt wird.",
					},
					services: {
						title: "Dienste",
						description: "Wählen Sie die Monitore und Cron Jobs, über die diese Seite berichtet.",
						empty: "Sie haben noch keine Monitore oder Cron Jobs zum Hinzufügen.",
					},
				},
			},
			dangerZone: {
				title: "Gefahrenzone",
				description: "Aktionen in diesem Bereich können nicht rückgängig gemacht werden.",
				warning: "Wenn Sie diese Statusseite löschen, ist ihre öffentliche URL endgültig offline.",
				deleteDescription: "Dies kann nicht rückgängig gemacht werden.",
			},
		},

		monitorsImport: {
			meta: { title: "Monitore importieren" },
			header: { title: "Monitore importieren" },

			form: {
				sections: {
					urls: {
						title: "Was importiert wird",
						description:
							"Fügen Sie die Adressen ein, die überwacht werden sollen — eine pro Zeile.",
					},
					schedule: {
						title: "Wie oft geprüft wird",
						description:
							"Gilt für jeden Monitor, den dieser Import erstellt. Sie können jeden davon später ändern.",
					},
				},

				fields: {
					urls: {
						label: "Zu überwachende URLs",
						description:
							"Eine URL pro Zeile, bis zu {{limit}}. Ein reiner Host wie beispiel.de wird zu https://beispiel.de. Leere Zeilen und Wiederholungen derselben Adresse werden übersprungen.",
						placeholder: "beispiel.de\nhttps://www.beispiel.org/health\nstatus.beispiel.net",
					},
					interval: {
						label: "Prüfintervall",
						description:
							"Gilt für jeden Monitor in dieser Liste. Sie können jeden davon später ändern.",
					},
				},
				cta: "Monitore importieren",
			},

			/**
			 * Die abgelehnten Zeilen, angezeigt über dem Feld, in das sie neu eingefügt werden.
			 * Es beginnt mit dem, was *erstellt* wurde, damit ein teilweiser Import nicht wie ein
			 * fehlgeschlagener klingt.
			 */
			report: {
				section: { title: "Letzter Import" },
				title_one: "1 Monitor wurde erstellt. Diese Zeilen nicht:",
				title_other: "{{count}} Monitore wurden erstellt. Diese Zeilen nicht:",
				overflow_one:
					"1 weitere Zeile wurde ausgelassen: ein Import nimmt {{limit}} Zeilen auf einmal. Fügen Sie den Rest ein, um ihn zu importieren.",
				overflow_other:
					"{{count}} weitere Zeilen wurden ausgelassen: ein Import nimmt {{limit}} Zeilen auf einmal. Fügen Sie den Rest ein, um ihn zu importieren.",
				table: {
					label: "Zeilen, die nicht importiert wurden",
					columns: { line: "Zeile", input: "Was Sie eingefügt haben", reason: "Warum" },
				},
				reasons: {
					invalidUrl: "Keine URL, die wir prüfen können.",
					duplicate: "Dieselbe Adresse wie in einer früheren Zeile.",
					tooLong: "Zu lang für eine URL.",
				},
			},
		},

		httpMonitors: {
			header: {
				title: "HTTP-Monitore",
				action: {
					create: "Monitor erstellen",
					import: "Importieren",
				},
			},
			empty: {
				title: "Noch keine HTTP-Monitore",
				description: "Erstellen Sie einen HTTP-Monitor, um Ihre Endpunkte zu überwachen.",
				cta: "Monitor erstellen",
			},
			table: {
				label: "HTTP-Monitore",
				columns: {
					name: "Name",
					url: "URL",
					status: "Status",
					responseTime: "Antwortzeit",
					lastChecked: "Zuletzt geprüft",
					actions: "Aktionen",
				},
				neverChecked: "Nie",
				disabled: "Deaktiviert",
				actions: {
					menu: "Aktionsmenü",
					view: "Ansehen",
					edit: "Bearbeiten",
					delete: "Löschen",
				},
				status: {
					up: "Aktiv",
					down: "Ausgefallen",
					degraded: "Beeinträchtigt",
					unknown: "Unbekannt",
				},
				confirmation: {
					delete: "Sind Sie sicher, dass Sie den Monitor {{name}} löschen möchten?",
					deleteDescription:
						"Dadurch werden auch die Inhaltsprüfungen und der Prüfergebnisverlauf gelöscht. Dies kann nicht rückgängig gemacht werden.",
				},
			},
		},

		dnsMonitors: {
			header: {
				title: "DNS-Monitore",

				action: {
					create: "DNS-Monitor erstellen",
				},
			},

			empty: {
				title: "Noch keine DNS-Monitore",
				description: "Erstellen Sie einen DNS-Monitor, um DNS-Eintragsänderungen zu verfolgen.",
				cta: "DNS-Monitor erstellen",
			},

			table: {
				label: "DNS-Monitore",

				columns: {
					name: "Name",
					domain: "Domain",
					records: "Einträge",
					status: "Status",
					lastChecked: "Zuletzt geprüft",
					actions: "Aktionen",
				},

				records: "{{enabled}} von {{total}} überwacht",
				noRecords: "Noch keine",
				disabled: "Deaktiviert",
				neverChecked: "Nie",
				notChecked: "Nicht geprüft",

				actions: {
					menu: "Aktionsmenü",
					check: "Jetzt prüfen",
					edit: "Bearbeiten",
					delete: "Löschen",
				},

				confirmation: {
					delete: "Sind Sie sicher, dass Sie den DNS-Monitor {{name}} löschen möchten?",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "DNS-Monitor erstellen",
			},

			form: {
				sections: {
					basics: {
						title: "Grundlagen",
						description: "Was dieser Monitor überwacht.",
					},
					checks: {
						title: "Prüfeinstellungen",
						description: "Wie oft jeder erfasste Name aufgelöst wird.",
					},
					zoneFile: {
						title: "Zonendatei",
						description:
							"Fügen Sie Ihre Zone ein, um Subdomains zu überwachen. Ohne sie sehen wir nur den Apex Ihrer Domain.",
					},
				},

				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Produktions-DNS",
						description: "Ein beschreibender Name für diesen DNS-Monitor.",
					},

					domain: {
						label: "Domain",
						placeholder: "beispiel.de",
						description: "Die Domain, deren DNS-Einträge überwacht werden sollen.",
					},

					zoneFile: {
						label: "Zonendatei",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"Optional. Fügen Sie eine BIND-Zonendatei aus Ihrem DNS-Anbieter ein. Sie wird einmal gelesen und nie gespeichert, und sie ist der einzige Weg, auf dem wir die Namen in Ihrer Zone erfahren können.",
						limits: "Bis zu {{size}} Text und {{limit}} Namen pro Monitor.",
					},

					interval: {
						label: "Prüfintervall",
						description: "Wie oft jeder erfasste Name aufgelöst wird.",
						options: {
							"5m": "5 Minuten",
							"15m": "15 Minuten",
							"30m": "30 Minuten",
							"1h": "1 Stunde",
							"6h": "6 Stunden",
							"12h": "12 Stunden",
							"24h": "24 Stunden",
						},
					},

					isEnabled: {
						label: "Überwachung aktivieren",
						description: "Starten Sie die Überwachung dieser Domain sofort.",
					},
				},

				/** ADR-026 §14: said on the setup screen, not only in the docs. */
				apexOnlyNotice:
					"DNS erlaubt es niemandem, die Einträge einer Zone aufzulisten. Ohne Zonendatei können wir nur den Apex Ihrer Domain überwachen – niemals eine Subdomain.",

				cta: "DNS-Monitor erstellen",
			},
		},

		editDnsMonitor: {
			header: {
				title: "DNS-Monitor bearbeiten",
			},

			form: {
				sections: {
					basics: {
						title: "Grundlagen",
						description: "Was dieser Monitor überwacht und wie oft er prüft.",
					},
				},

				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Produktions-DNS",
						description: "Ein beschreibender Name für diesen DNS-Monitor.",
					},

					domain: {
						label: "Domain",
						placeholder: "beispiel.de",
						description: "Die Domain, deren DNS-Einträge überwacht werden sollen.",
					},

					zoneFile: {
						label: "Zonendatei",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"Optional. Fügen Sie eine BIND-Zonendatei aus Ihrem DNS-Anbieter ein. Sie wird einmal gelesen und nie gespeichert, und sie ist der einzige Weg, auf dem wir die Namen in Ihrer Zone erfahren können.",
					},

					interval: {
						label: "Prüfintervall",
						description: "Wie oft jeder erfasste Name aufgelöst wird.",
						options: {
							"5m": "5 Minuten",
							"15m": "15 Minuten",
							"30m": "30 Minuten",
							"1h": "1 Stunde",
							"6h": "6 Stunden",
							"12h": "12 Stunden",
							"24h": "24 Stunden",
						},
					},

					isEnabled: {
						label: "Überwachung aktivieren",
						description: "Ob diese Domain aktiv überwacht werden soll.",
					},
				},

				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			zoneFileImport: {
				title: "Zonendatei",
				description:
					"Fügen Sie Ihre Zone erneut ein, um seit dem letzten Import hinzugekommene Namen zu erfassen. Der Text wird einmal gelesen und nie gespeichert – deshalb müssen wir für eine Aktualisierung erneut nach der Datei fragen.",
				lastImported: "Zuletzt importiert am {{date}}.",
				neverImported:
					"Es wurde noch keine Zonendatei importiert. Dieser Monitor deckt nur den Apex ab.",
				cta: "Zonendatei importieren",
			},

			dangerZone: {
				title: "Gefahrenzone",
				deleteMonitor: "Monitor löschen",
				deleteDescription:
					"Dies löscht auch seine Einträge und seinen Prüfverlauf. Dies kann nicht rückgängig gemacht werden.",
				description: "Aktionen in diesem Bereich können nicht rückgängig gemacht werden.",
				warning:
					"Wenn Sie diesen Monitor löschen, werden seine DNS-Prüfungen, sein Verlauf und seine Benachrichtigungen endgültig entfernt.",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: 'DNS-Monitor "{{name}}"',

				action: {
					check: "Jetzt prüfen",
					refresh: "Aktualisieren",
					edit: "Bearbeiten",
				},
			},

			uptimeHistory: "Verlauf der Verfügbarkeit",
			notChecked: "Nicht geprüft",

			info: {
				domain: "Domain",
				status: "Status",
				recordsWatched: "Überwachte Einträge",
				recordsWatchedValue: "{{enabled}} von {{total}}",
				zoneFileImported: "Zonendatei importiert",
				zoneFileNeverImported: "Nie – nur Apex",
			},

			stats: {
				totalChecks: {
					label: "Gesamtprüfungen",
					description: "Anzahl der durchgeführten DNS-Prüfungen",
				},

				successRate: {
					label: "Erfolgsrate",
					description: "Prozentsatz erfolgreicher Prüfungen",
				},
			},

			results: {
				title: "Prüfverlauf",
				empty: "Es wurden noch keine Prüfungen durchgeführt.",

				table: {
					columns: {
						checkedAt: "Geprüft am",
						status: "Status",
						findings: "Befunde",
						responseTime: "Langsamste Abfrage",
					},
				},

				findings: "{{changed}} geändert · {{missing}} fehlen · {{new}} neu",
				noFindings: "Keine Änderungen",
				/** A failed query is never diffed, so a partial sweep must read as partial. */
				queriesFailed_one: "{{count}} Abfrage blieb ohne Antwort",
				queriesFailed_other: "{{count}} Abfragen blieben ohne Antwort",
			},

			records: {
				title: "Erfasste Einträge",
				description:
					"Alle Einträge, die wir jemals für diese Domain gesehen haben. Nicht überwachte Einträge bleiben erhalten, damit sie nie erneut als neu entdeckt werden.",
				empty: "Es werden noch keine Einträge erfasst.",

				table: {
					columns: {
						name: "Name",
						type: "Typ",
						value: "Wert",
						source: "Quelle",
						state: "Zustand",
						watched: "Überwacht",
					},
				},

				source: {
					resolver: "Aufgelöst",
					zone_file: "Zonendatei",
				},

				state: {
					ok: "OK",
					changed: "Geändert",
					missing: "Fehlt",
					new: "Neu",
					error: "Fehler",
				},

				actions: {
					enable: "Überwachen",
					disable: "Nicht mehr überwachen",
				},
			},
		},

		/**
		 * The review step between creating a domain monitor and monitoring anything with it.
		 * Its own page, so a reload lands back on the decision rather than on a detail page
		 * that implies it was already made.
		 */
		dnsMonitorReview: {
			header: {
				title: "Einträge für „{{name}}“ prüfen",
				description:
					"Alle gefundenen Einträge werden standardmäßig überwacht. Entfernen Sie den Haken bei allem, worüber Sie nicht benachrichtigt werden möchten – der Eintrag bleibt so oder so erhalten, damit nichts, was Sie ablehnen, später erneut als neuer Eintrag auftaucht.",
			},

			/** A line the parser could not use is reported, never silently dropped. */
			unparsed: {
				title_one: "{{count}} Zeile wurde nicht importiert",
				title_other: "{{count}} Zeilen wurden nicht importiert",
				description:
					"Diese Zeilen gehören nicht zu dem Teil, den wir lesen. Was darin deklariert wird, wird nicht überwacht.",
				line: "Zeile {{line}}: {{reason}}",

				/** One sentence per parser outcome, so each names the fix it points at. */
				reasons: {
					originDirective:
						"Ändert, zu welcher Zone die nachfolgenden Namen gehören, deshalb können wir sie nicht sicher lesen",
					ttlDirective: "Wir verfolgen keine TTLs",
					includeDirective: "Nennt eine Datei, die wir nicht haben und nicht abrufen",
					generateDirective: "Erzeugt auf einmal viele Namen",
					unsupportedDirective: "Keine Direktive, die wir lesen",
					multiLineRecord: "Über mehrere Zeilen mit Klammern verteilt",
					blankOwnerContinuation:
						"Beginnt mit einem Leerzeichen und übernimmt den Namen der vorherigen Zeile",
					nonInternetClass: "Kein Eintrag der Klasse Internet",
					unsupportedType: "Keiner der sechs Eintragstypen, die wir überwachen",
					outOfZone: "Gehört zu einer anderen Domain",
					malformed: "Wir konnten dies nicht als Eintrag lesen",
				},
			},

			groups: {
				resolving: {
					title: "Löst derzeit auf",
					description:
						"Gefunden, indem jeder unterstützte Eintragstyp für jeden bekannten Namen aufgelöst wurde.",
				},
				discovered: {
					title: "Neu entdeckt",
					description:
						"Lösen jetzt auf, waren bei der letzten Prüfung aber nicht dabei. Sie bleiben unüberwacht, bis Sie sie annehmen – so wird ein Eintrag, der ohne Ihr Zutun aufgetaucht ist, nie in Ihrem Namen zur Erwartung.",
				},
				declared: {
					title: "Deklariert, löst aber nicht auf",
					description:
						"In Ihrer Zonendatei enthalten, aber heute antwortet nichts darauf. Bleibt unüberwacht, sofern Sie nichts anderes bestimmen – eine eingefügte Zone ist eine Momentaufnahme, und sie wird nur älter.",
					proxiedNote:
						"Ein Eintrag hinter einem Proxy erscheint nicht im Export seiner eigenen Zone und antwortet stattdessen mit der Adresse des Proxys. In einer Zone mit Proxy ist das normal und zu erwarten – es ist kein Zeichen dafür, dass etwas kaputt ist.",
				},
			},

			/**
			 * A line repeating a record an earlier line declared. Reported apart from the
			 * rejections: nothing was lost, so calling it "not imported" would describe a
			 * complete import as a partial one.
			 */
			duplicates: {
				title_one:
					"{{count}} Zeile deklarierte einen Eintrag, den eine andere Zeile bereits deklariert hat",
				title_other:
					"{{count}} Zeilen deklarierten Einträge, die andere Zeilen bereits deklariert haben",
				description:
					"Es ging nichts verloren. DNS beantwortet einen wiederholten Eintrag nur einmal, deshalb wurde er aus der ersten Zeile übernommen, die ihn deklariert hat.",
				line: "Zeile {{line}}: {{name}} {{type}} wurde bereits in Zeile {{firstLine}} deklariert.",
			},

			/** Said at review, where the cap is enforced, rather than at check time. */
			namesCap: {
				title: "Mehr Namen, als ein Monitor überwachen kann",
				description:
					"Dieser Monitor umfasst jetzt {{count}} Namen, eine Prüfung schafft {{limit}}. Verteilen Sie die Zone auf mehrere Monitore, damit jeder Name weiterhin geprüft wird.",
			},

			/** Column headings match the monitor's own record list, so both screens read alike. */
			table: {
				columns: {
					watched: "Überwacht",
					name: "Name",
					type: "Typ",
					value: "Wert",
				},

				/** Each box names the record it decides, since the column heading is not read per row. */
				watchRecord: "{{name}} {{type}} überwachen",
			},

			empty: "Für diese Domain wurde nichts gefunden.",
			cancel: "Abbrechen",
			cta: "Einträge speichern",
		},

		maintenance: {
			header: {
				title: "Wartungsfenster",

				action: {
					create: "Wartung planen",
				},
			},

			empty: {
				title: "Keine Wartungsfenster",
				description:
					"Planen Sie Wartungsfenster, um Benachrichtigungen während geplanter Ausfallzeiten zu unterdrücken.",
				cta: "Wartung planen",
			},

			tabs: {
				label: "Wartungsstatus",
				active: "Aktiv",
				upcoming: "Geplant",
				past: "Vergangen",
			},

			noActive: "Keine aktiven Wartungsfenster",
			noUpcoming: "Keine geplanten Wartungsfenster",
			noPast: "Keine vergangenen Wartungsfenster",

			table: {
				columns: {
					name: "Name",
					schedule: "Zeitplan",
					monitor: "Monitor",
					status: "Status",
					actions: "Aktionen",
					scope: "Bereich",
					starts: "Beginn",
					ends: "Ende",
				},

				allMonitors: "Alle Monitore",
				recurring: "Wiederkehrend",
				unknownMonitor: "Unbekannter Monitor",
				endedEarly: "Vorzeitig beendet",
				edit: "Bearbeiten",

				status: {
					active: "Aktiv",
					upcoming: "Geplant",
					past: "Abgeschlossen",
				},

				actions: {
					menu: "Aktionsmenü",
					end: "Jetzt beenden",
					delete: "Löschen",
				},

				confirmation: {
					endMaintenance:
						"Sind Sie sicher, dass Sie die Wartung '{{name}}' vorzeitig beenden möchten?",
					deleteMaintenance: "Sind Sie sicher, dass Sie '{{name}}' löschen möchten?",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "Wartung planen",
			},

			form: {
				sections: {
					coverage: {
						title: "Geltungsbereich",
						description: "Benennen Sie dieses Fenster und wählen Sie, für welche Monitore es gilt.",
					},
					schedule: {
						title: "Zeitplan",
						description: "Wann das Wartungsfenster beginnt und endet.",
					},
					behavior: {
						title: "Verhalten",
						description: "Was geschieht, während das Fenster aktiv ist, und ob es sich wiederholt.",
					},
				},

				fields: {
					name: {
						label: "Name",
						placeholder: "Datenbank-Upgrade",
						description: "Eine Beschreibung der Wartungsarbeiten.",
					},

					monitor: {
						label: "Monitor",
						description:
							"Wählen Sie einen bestimmten Monitor oder lassen Sie das Feld leer für alle Monitore.",
						all: "Alle Monitore",
					},

					startsAt: {
						label: "Startzeit",
						description: "Wann das Wartungsfenster beginnt.",
					},

					duration: {
						label: "Dauer",
						description: "Wie lange das Wartungsfenster dauert.",
						options: {
							"15m": "15 Minuten",
							"30m": "30 Minuten",
							"1h": "1 Stunde",
							"2h": "2 Stunden",
							"4h": "4 Stunden",
							"8h": "8 Stunden",
						},
					},

					suppressAlerts: {
						label: "Benachrichtigungen unterdrücken",
						description: "Keine Benachrichtigungen während dieses Wartungsfensters senden.",
					},

					showOnStatusPage: {
						label: "Auf Statusseite anzeigen",
						description: "Einen Wartungshinweis auf öffentlichen Statusseiten anzeigen.",
					},

					isRecurring: {
						label: "Wiederkehrend",
						description: "Dieses Wartungsfenster nach einem Zeitplan wiederholen.",
					},

					recurringPattern: {
						label: "Wiederholungsmuster",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"Musterformat: 'daily:HH:MM-HH:MM', 'weekly:wochentag:HH:MM-HH:MM', oder 'monthly:tagDesMonats:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Wartungsfenster",
				},

				cta: "Wartung planen",
			},
		},

		editMaintenance: {
			header: {
				title: "{{name}} bearbeiten",
			},

			form: {
				cta: "Änderungen speichern",
				cancel: "Abbrechen",
				sections: {
					coverage: {
						title: "Was es abdeckt",
						description: "Benennen Sie dieses Fenster und wählen Sie, für welche Monitore es gilt.",
					},
					schedule: {
						title: "Zeitplan",
						description: "Wann das Wartungsfenster beginnt und endet.",
					},
					behavior: {
						title: "Während der Wartung",
						description:
							"Wie sich Benachrichtigungen und Ihre Statusseite verhalten, während das Fenster läuft.",
					},
					recurrence: {
						title: "Wiederholung",
						description:
							"Wiederholen Sie dieses Fenster nach einem Zeitplan, statt es einmalig laufen zu lassen.",
					},
				},
			},

			endNow: {
				cta: "Wartung jetzt beenden",
				title: "Dieses Fenster beenden",
				description: "Dieses Fenster läuft gerade.",
				warning:
					"Wenn Sie es jetzt beenden, werden Benachrichtigungen wieder zugestellt und der Wartungshinweis verschwindet von Ihrer Statusseite. Das Fenster selbst bleibt erhalten.",
			},

			danger: {
				title: "Gefahrenzone",

				description: "Unwiderrufliche Aktionen für dieses Wartungsfenster.",
				warning: "Das Löschen dieses Wartungsfensters kann nicht rückgängig gemacht werden.",
				delete: {
					trigger: "Wartungsfenster löschen",
					confirmTitle: "Dieses Wartungsfenster löschen?",
					confirmDescription: "Dies kann nicht rückgängig gemacht werden.",
					confirm: "Löschen",
				},
			},
		},

		maintenanceWindows: {
			form: {
				fields: {
					name: {
						label: "Name",
					},

					scope: {
						description:
							"Was dieses Fenster abdeckt. Lassen Sie es teamweit, beschränken Sie es auf eine Monitor-Art oder richten Sie es auf einen einzelnen Monitor.",
					},

					startsAt: {
						label: "Beginn",
					},

					endsAt: {
						label: "Ende",
					},

					suppressAlerts: {
						label: "Benachrichtigungen während dieses Fensters unterdrücken",
					},

					showOnStatusPage: {
						label: "Auf Statusseite anzeigen",
					},

					recurring: {
						label: "Wiederkehrend",
					},

					recurringPattern: {
						label: "Wiederholungsmuster (falls wiederkehrend)",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"daily:HH:MM-HH:MM, weekly:<Wochentag>:HH:MM-HH:MM, oder monthly:<Tag-des-Monats>:HH:MM-HH:MM, in UTC.",
					},
				},
			},
		},

		alertHistory: {
			header: {
				title: "Benachrichtigungsverlauf",
			},

			breadcrumbs: {
				alerts: "Benachrichtigungen",
			},

			empty: {
				title: "Noch keine Benachrichtigungsereignisse",
				description:
					"Benachrichtigungsereignisse erscheinen hier, wenn Monitore Benachrichtigungen auslösen. Konfigurieren Sie Benachrichtigungen, um zu beginnen.",
				cta: "Benachrichtigungen anzeigen",
			},

			table: {
				label: "Benachrichtigungsereignisse",

				columns: {
					alert: "Benachrichtigung",
					monitor: "Monitor",
					eventType: "Ereignis",
					status: "Status",
					sentAt: "Zeit",
				},

				unknownAlert: "Unbekannte Benachrichtigung",
				unknownMonitor: "Unbekannter Monitor",

				eventType: {
					down: "Ausgefallen",
					up: "Wiederhergestellt",
					degraded: "Beeinträchtigt",
				},

				status: {
					sent: "Gesendet",
					skipped_cooldown: "Übersprungen (Cooldown)",
					skipped_cap: "Übersprungen (Wiederholungslimit)",
					skipped: "Übersprungen",
					failed: "Fehlgeschlagen",
				},
			},
		},

		createAlert: {
			header: {
				title: "Benachrichtigung erstellen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Grundlagen",
						description: "Wie diese Benachrichtigung heißt und welche Monitore sie überwacht.",
					},
					channel: {
						title: "Benachrichtigungskanal",
						description:
							"Wohin die Meldung gesendet wird. Nur die Felder des gewählten Kanals sind erforderlich.",
					},
					delivery: {
						title: "Zustellregeln",
						description:
							"Ob Wiederherstellungen gemeldet werden und wie oft eine Wiederholung gesendet wird, solange ein Monitor noch ausgefallen ist.",
					},
				},

				fields: {
					name: {
						label: "Name",
						placeholder: "CTO-Benachrichtigung",
						description: "Ein Name zur Identifizierung der Benachrichtigung.",
					},

					strategy: {
						label: "Strategie",
						description: "Die Strategie für die Benachrichtigung.",
						options: {
							webhook: "Webhook",
							email: "E-Mail",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "Webhook-URL",
								placeholder: "https://beispiel.de/webhook",
								description: "Die URL, an die die Benachrichtigungs-Payload gesendet wird.",
							},
							secret: {
								label: "Geheimschlüssel",
								placeholder: "optionaler-geheimschlüssel",
								description:
									"Ein optionaler Geheimschlüssel für die Request-Header. Ein `Webhook-Signature`-Header wird mit einer HMAC SHA256-Signatur der Payload unter Verwendung dieses Geheimnisses hinzugefügt.",
							},
						},
						email: {
							to: {
								label: "E-Mail-Adresse",
								placeholder: "cto@beispiel.de",
								description: "Die E-Mail-Adresse, an die die Benachrichtigung gesendet wird.",
							},

							subjectPrefix: {
								label: "Betreff-Präfix",
								placeholder: "[Uptime-Benachrichtigung]",
								description:
									"Ein optionales Präfix für den E-Mail-Betreff. Nützlich zum Filtern von Benachrichtigungen in Ihrem Posteingang.",
							},
						},
						slack: {
							webhookUrl: {
								label: "Slack Webhook-URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Die Slack Incoming Webhook-URL. Erstellen Sie eine unter api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Kanal-Override",
								placeholder: "#alerts",
								description:
									"Optionaler Kanal anstelle des Webhook-Standards. Fügen Sie das #-Präfix hinzu.",
							},
						},
						discord: {
							webhookUrl: {
								label: "Discord Webhook-URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"Die Discord Webhook-URL. Erstellen Sie eine unter Servereinstellungen > Integrationen > Webhooks.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Bei Wiederherstellung benachrichtigen",
						description:
							"Senden Sie eine Benachrichtigung, wenn der Monitor sich von einem Ausfall erholt. Enthält Wiederherstellungszeit und Ausfalldauer.",
					},

					cooldown: {
						label: "Benachrichtigungs-Cooldown",
						description:
							"Mindestzeit zwischen Benachrichtigungen desselben Typs. Verhindert Benachrichtigungsmüdigkeit bei andauernden Ausfällen.",
						options: {
							none: "Kein Cooldown",
							"5min": "5 Minuten",
							"15min": "15 Minuten",
							"30min": "30 Minuten",
							"1hour": "1 Stunde",
							"2hours": "2 Stunden",
							custom: "Benutzerdefiniert",
						},
						custom: {
							label: "Benutzerdefinierter Cooldown (Minuten)",
							placeholder: "Minuten eingeben",
							description: "Geben Sie die Anzahl der Minuten zwischen Benachrichtigungen ein.",
						},
					},
				},

				cta: "Benachrichtigung erstellen",
			},
		},

		editAlert: {
			header: {
				title: "Benachrichtigung bearbeiten",
			},

			form: {
				cta: "Änderungen speichern",
				cancel: "Abbrechen",
				sections: {
					basics: {
						title: "Was überwacht wird",
						description:
							"Benennen Sie diese Benachrichtigung und wählen Sie, ob sie alle Monitore oder nur einen abdeckt.",
					},
					channel: {
						title: "Wie benachrichtigt wird",
						description:
							"Wählen Sie einen Kanal und tragen Sie das Ziel ein, an das gesendet werden soll.",
					},
					delivery: {
						title: "Zustellregeln",
						description:
							"Steuern Sie Wiederherstellungsmeldungen und wie oft eine Benachrichtigung während eines Ausfalls wiederholt werden darf.",
					},
				},
			},

			danger: {
				title: "Gefahrenzone",

				description: "Unwiderrufliche Aktionen für diese Benachrichtigung.",
				warning:
					"Wenn Sie diese Benachrichtigung löschen, werden alle Meldungen gestoppt, die sie sendet. Dies kann nicht rückgängig gemacht werden.",
				delete: {
					trigger: "Benachrichtigung löschen",
					confirmTitle: "Diese Benachrichtigung löschen?",
					confirmDescription: "Dies kann nicht rückgängig gemacht werden.",
					confirm: "Löschen",
				},
			},
		},

		logout: {
			title: "Sind Sie sicher, dass Sie sich abmelden möchten?",
			cta: "Abmelden",
		},

		trial: {
			/**
			 * Der Bericht als eigene Seite, erreichbar über das Token der Beobachtung. Jeder Wert
			 * wird aus gespeicherten Prüfungen berechnet, deshalb hat jeder eine Formulierung für
			 * „noch nichts zu berichten“ daneben: eine Beobachtung ohne abgeschlossene Prüfung
			 * zeigt einen Gedankenstrich und sagt warum, und behauptet nie „keine Vorfälle“, weil
			 * noch niemand nachgesehen hat.
			 */
			report: {
				meta: {
					title: "Ihr Gesundheitsbericht über {{days}} Tage — Uptime",
					description:
						"Die Uptime, Prüfungen und Vorfälle, die wir für Ihre Website in ihrer kostenlosen Überwachungswoche erfasst haben.",
				},
				eyebrow: "Gesundheitsbericht über {{days}} Tage",
				period: "Überwacht von {{start}} bis {{end}} ({{zone}})",
				bar: {
					caption: "Ein Block pro Tag über {{days}} Tage, ältester zuerst.",
					status: {
						up: "Den ganzen Tag erreichbar",
						degraded: "Mindestens einmal langsam",
						down: "Mindestens einmal ausgefallen",
						noData: "Keine Prüfungen an diesem Tag",
					},
				},
				summary: {
					title: "Was wir erfasst haben",
					uptime: "Uptime",
					checks: "Abgeschlossene Prüfungen",
					healthy: "Vollständig fehlerfreie Prüfungen",
					noChecks:
						"Es ist noch keine Prüfung abgeschlossen, deshalb gibt es zu dieser URL nichts zu berichten. Die erste stündliche Prüfung läuft eine Stunde nach dem Start der Beobachtung.",
				},
				incidents: {
					title: "Vorfälle",
					unknown:
						"Es ist noch keine Prüfung abgeschlossen, deshalb können wir nicht sagen, ob diese URL einen Vorfall hatte.",
					none_one: "Kein Vorfall: die eine abgeschlossene Prüfung hat wie erwartet geantwortet.",
					none_other:
						"Keine Vorfälle: alle {{count}} abgeschlossenen Prüfungen haben wie erwartet geantwortet.",
					summary_one: "Ein Vorfall.",
					summary_other: "{{count}} Vorfälle.",
					entry_one: "Erster Fehler gesehen {{started}} — eine Prüfung ist fehlgeschlagen.",
					entry_other:
						"Erster Fehler gesehen {{started}} — {{count}} Prüfungen in Folge sind fehlgeschlagen.",
				},
				timing: {
					title: "Antwortzeiten",
					fastest: "Schnellste",
					average: "Durchschnitt",
					slowest: "Langsamste",
					basis_one: "Gemessen über die eine Prüfung, die geantwortet hat.",
					basis_other: "Gemessen über die {{count}} Prüfungen, die geantwortet haben.",
				},
				cta: {
					title: "Diese Website weiter überwachen für {{price}}/Monat",
					action: "Überwachung starten",
					convertible: {
						body: "Melden Sie sich an und wir machen aus dieser URL einen echten Monitor, mit dem Verlauf von oben übernommen.",
					},
					expired: {
						body: "Diese kostenlose Woche liegt außerhalb ihres Übernahmezeitraums, deshalb bleibt der Verlauf von oben hier — aber Sie können diese URL jederzeit richtig überwachen lassen.",
					},
					converted: {
						title: "Diese URL wird bereits überwacht",
						body: "Sie haben aus diesem Ziel einen Monitor gemacht, es wird also jetzt in Ihrem eigenen Intervall geprüft.",
						action: "Dashboard öffnen",
					},
				},
			},

			meta: {
				title: "Kostenloser Website-Gesundheitsbericht über {{days}} Tage — Uptime",
				description:
					"Wir prüfen Ihre Website jetzt, dann {{days}} Tage lang jede Stunde, und senden Ihnen per E-Mail, was wir gefunden haben. Kein Konto, keine Karte.",
			},

			heading: "Ein kostenloser Gesundheitsbericht über {{days}} Tage für Ihre Website",
			intro:
				"Geben Sie uns eine URL und wir prüfen sie jetzt aus unserem Netz — dieselbe Prüfung, die ein bezahlter Monitor ausführt. Hinterlassen Sie danach eine E-Mail-Adresse und wir prüfen {{days}} Tage lang jede Stunde weiter und senden Ihnen dann den Bericht.",

			form: {
				url: {
					label: "Zu prüfende URL",
					description: "Eine http:// oder https:// Adresse im öffentlichen Internet.",
					placeholder: "https://beispiel.de",
				},
				submit: "Erste Prüfung ausführen",
			},

			refusal: {
				title: "Die Prüfung wurde nicht ausgeführt",
				blockedTarget:
					"Diese Adresse prüfen wir nicht für dich. Es muss eine öffentliche http:// oder https:// URL auf Port 80 oder 443 sein, ohne Benutzername und Passwort, und sie muss auf eine Adresse im offenen Internet auflösen.",
				challengeIncomplete:
					"Schließen Sie die Verifizierung ab, dann können wir die Prüfung ausführen.",
				failedChallenge:
					"Wir konnten nicht bestätigen, dass die Anfrage aus einem Browser kam. Lade die Seite neu und versuche es erneut.",
				rateLimited: "Sie können in einer Minute eine weitere Prüfung starten.",
				rateLimitedFor: "Sie können in {{seconds}} Sekunden eine weitere Prüfung starten.",
				budgetExhausted:
					"Wir haben heute schon alle kostenlosen Prüfungen ausgeführt, die wir an einem Tag ausführen. Das liegt an uns und nicht an deiner URL — komm morgen wieder, oder starte die Überwachung und wir prüfen sie jede Minute.",
				unavailable:
					"Etwas auf unserer Seite hat die Prüfung verhindert, bevor sie laufen konnte, deshalb haben wir nichts über Ihre URL erfahren. Das liegt an uns und nicht an Ihnen. Versuchen Sie es gleich noch einmal.",
			},

			result: {
				checkAnother: "Weitere URL prüfen",
				noResponse: "Keine Antwort",
				httpStatus: "HTTP {{status}}",
				milliseconds: "{{value}} ms",
				checkedAt: "Geprüft am {{time}}",

				redirect: {
					badge: "Leitet weiter",
					title: "Diese URL leitet woanders hin",
					description:
						"Sie hat geantwortet, und zwar mit einem Verweis auf eine andere Adresse. Dorthin sind wir nicht gegangen: wir prüfen nur die URL, die du uns gegeben hast, und genau das verhindert, dass dieses Feld benutzt wird, um irgendwo hinzukommen, wo es nichts zu suchen hat. Prüfe stattdessen das Ziel, dann bekommst du dafür ein echtes Ergebnis.",
					destination: "Sie verweist auf {{url}}",
					action: "Stattdessen die prüfen",
					unknownDestination:
						"Wir haben nicht gelesen, wohin sie verweist. Öffne die URL im Browser, sieh nach, wo du landest, und prüfe diese Adresse hier.",
				},

				status: {
					up: "Erreichbar",
					degraded: "Langsam",
					down: "Ausgefallen",
				},
			},

			lead: {
				title: "Den kostenlosen Bericht über {{days}} Tage erhalten",
				description:
					"Die Prüfung, die Sie gerade gesehen haben, war die erste. Hinterlassen Sie eine E-Mail-Adresse und wir machen weiter und sagen Ihnen dann, was {{days}} Tage Prüfen ergeben haben.",
				consent: "Schreibt mir gelegentlich auch über Uptime selbst.",
				consentNote: "Die Prüfungen bekommen Sie so oder so.",
				promise:
					"Jede E-Mail enthält einen Link, der sie mit einem Klick beendet und Ihre Adresse löscht.",
				submit: "Kostenlosen Bericht über {{days}} Tage starten",

				/**
				 * Worauf sich ein Besucher einlässt, neben dem Feld statt darunter genannt. Jede
				 * Zeile ist etwas, das das System tatsächlich tut — die Adresse ist die, die wir
				 * geprüft haben, und keine, die neu eingetippt werden kann, Takt und Dauer sind die
				 * der Beobachtung selbst, und die drei genannten E-Mails sind die drei, die es gibt.
				 */
				expectations: {
					target:
						"Wir prüfen {{url}} weiter — genau die Adresse, die wir gerade geprüft haben, und keine andere.",
					cadence: "Einmal pro Stunde, jede Stunde, {{days}} Tage lang.",
					emails:
						"Eine Zusammenfassung pro Tag, eine Nachricht bei jedem Statuswechsel und am Ende der vollständige Bericht.",
					noAccount: "Keine Karte, kein Passwort, kein Konto anzulegen.",
				},

				email: {
					label: "E-Mail",
					placeholder: "du@beispiel.de",
					error: "Das sieht nicht nach einer E-Mail-Adresse aus.",
				},
			},

			monitor: {
				title: "Diese URL weiter überwachen",
				description:
					"Machen Sie aus dieser einen Prüfung einen Monitor: dieselbe Prüfung in Ihrem Intervall, mit einer Benachrichtigung, sobald sich etwas ändert.",
				subscribeDescription:
					"Machen Sie aus dieser einen Prüfung einen Monitor: dieselbe Prüfung in Ihrem Intervall, mit einer Benachrichtigung, sobald sich etwas ändert. Er läuft, sobald Ihr Abonnement aktiv ist.",
				create: "Monitor für diese URL anlegen",
				subscribe: "Abonnement starten",
			},

			watching: {
				title: "Wir kümmern uns darum",
				description:
					"Die erste stündliche Prüfung von {{url}} läuft in einer Stunde, und wir prüfen {{days}} Tage lang weiter. Eine Kopie der gerade ausgeführten Prüfung liegt schon in Ihrem Postfach.",
			},

			repeated: {
				title: "Diese haben wir schon geprüft",
				description:
					"{{url}} hatte ihren kostenlosen Bericht bereits durch eine frühere Anfrage — jede URL bekommt alle 30 Tage einen. Wir haben Ihnen per E-Mail geschickt, was diese Prüfungen ergeben haben; neu gestartet wurde nichts.",
			},

			benefits: {
				title: "Was der Bericht abdeckt",
				description:
					"Alles, was Ihnen ein bezahlter Monitor über diese URL sagen würde — kostenlos, {{days}} Tage lang.",

				list: {
					hourly: {
						title: "Jede Stunde eine Prüfung",
						description:
							"{{days}} Tage lang, aus demselben Netz, in dem ein bezahlter Monitor läuft.",
					},
					changes: {
						title: "Eine E-Mail, wenn sich etwas ändert",
						description:
							"Fällt sie aus oder kommt zurück, Sie erfahren es. Höchstens eine pro Tag, damit eine flatternde Seite Sie nicht überschwemmt.",
					},
					digest: {
						title: "Eine Zusammenfassung pro Tag",
						description:
							"Wie sich Ihre URL gehalten hat, auf einen Blick — und am Ende die ganzen {{days}} Tage in einem Bericht.",
					},
					noAccount: {
						title: "Kein Konto, keine Karte",
						description: "Nichts anzumelden, und ein Klick beendet es endgültig.",
					},
				},
			},

			more: {
				title: "Nicht nur Websites",
				description:
					"Der kostenlose Bericht deckt HTTP ab. Mit einem bezahlten Konto behalten wir drei weitere Dinge für Sie im Auge.",

				list: {
					tcp: {
						title: "TCP",
						description:
							"Wissen, dass ein Port noch antwortet — für alles, was keine Website ist: Datenbanken, Mailserver, Gameserver.",
					},
					dns: {
						title: "DNS",
						description:
							"Wissen, dass ein Eintrag noch dorthin zeigt, wo er soll, damit eine Übernahme oder eine verpatzte Änderung nicht untergeht.",
					},
					cron: {
						title: "Cron-Jobs",
						description:
							"Wissen, dass Ihr nächtliches Backup fertig geworden ist — und es erfahren in der Nacht, in der es das nicht ist.",
					},
				},
			},

			cta: {
				badge: "Wenn der Bericht endet",
				title: "Diese Website weiter überwachen für {{price}} im Monat",
				description:
					"Mit der Anmeldung wird aus dieser URL ein echter Monitor, und ihr Prüfverlauf wird übernommen, sodass nichts von vorn beginnt. Eine Prüfung jede Minute statt jede Stunde, so viele URLs Sie möchten, Benachrichtigungen dort, wo Sie ohnehin arbeiten, Statusseiten und ein Jahr Verlauf.",
				action: "Diese Website weiter überwachen",
				pricing: "Preise ansehen",
			},
		},

		unsubscribe: {
			confirm: {
				title: "Diese E-Mails beenden?",
				body: "Das beendet jede Prüfung, die diese Adresse angefordert hat, und löscht die Adresse samt allem, was dazu festgehalten wurde. Nichts bleibt übrig, also gibt es nichts rückgängig zu machen — aber du kannst jederzeit wieder auf unserer Website anfangen.",
				cta: "Ja, beenden und löschen",
			},

			done: {
				title: "Du bist abgemeldet",
				body: "Diese Adresse steht nicht mehr auf unserer Liste und die Prüfungen, die sie angefordert hatte, sind beendet. Es wird nichts mehr dorthin geschickt. Du kannst jederzeit wieder auf unserer Website anfangen.",
				cta: "Zurück zur Website",
			},
		},
		splat: {
			notFound: {
				title: "Nicht gefunden",
				description: "Die gesuchte Seite existiert nicht.",
			},
		},

		account: {
			meta: {
				title: "Konto - Uptime",
				description: "Verwalten Sie Ihre Kontoeinstellungen und Teams.",
			},

			header: {
				title: "Konto",
			},

			form: {
				actions: {
					cancel: "Abbrechen",
				},
			},

			profile: {
				title: "Profil",
				description: "Ihre persönlichen Informationen.",

				card: {
					title: "Profildetails",
					description: "Ihr Name, Ihre E-Mail-Adresse und Ihr Avatar.",
				},
			},

			language: {
				title: "Spracheinstellung",
				description: "Wählen Sie Ihre bevorzugte Sprache für die Oberfläche.",

				card: {
					title: "Sprache",
					description: "Gilt für das Dashboard und E-Mail-Benachrichtigungen.",
				},

				form: {
					fields: {
						language: {
							label: "Bevorzugte Sprache",
							description:
								"Wählen Sie Ihre bevorzugte Sprache. Automatische Erkennung verwendet Ihre Browser-Einstellungen.",
							options: {
								auto: "Automatisch erkennen",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "Japanisch",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "Sprache speichern",
				},
			},

			emails: {
				title: "E-Mails",
				description: "Wählen Sie, welche E-Mails wir Ihnen senden.",

				card: {
					title: "E-Mail-Benachrichtigungen",
					description:
						"Gilt für alle Teams, bei denen Sie Mitglied sind. Benachrichtigungen und Einladungen sind davon nicht betroffen.",
				},

				list: {
					teamDailyDigest: {
						name: "Täglicher Monitor-Bericht",
						description:
							"Jeden Morgen eine E-Mail pro Team mit dem Zustand jedes seiner Monitore am Vortag.",
					},
					teamWeeklyDigest: {
						name: "Wöchentlicher Monitor-Bericht",
						description:
							"Montags derselbe Bericht über die letzten sieben Tage, mit der Verfügbarkeit der Woche Tag für Tag.",
					},
				},

				form: {
					cta: "E-Mails speichern",
				},
			},

			teams: {
				title: "Ihre Teams",
				description: "Teams, in denen Sie Mitglied sind.",

				actions: {
					createTeam: "Team erstellen",
				},

				empty: {
					title: "Noch keine Teams",
					description: "Erstellen Sie ein Team, um Ihre Dienste zu überwachen.",
					cta: "Team erstellen",
				},

				table: {
					label: "Teams",
					description: "Alle Teams, denen Sie angehören.",

					columns: {
						team: "Team",
						role: "Rolle",
						actions: "Aktionen",
					},

					role: {
						member: "Mitglied",
						admin: "Admin",
						owner: "Eigentümer",
					},

					actions: {
						menu: "Aktionsmenü",
						leave: "Team verlassen",
					},

					confirmation: {
						leaveTeam: "Möchten Sie {{name}} wirklich verlassen?",
					},
				},
			},

			dataExport: {
				title: "Ihre Daten",
				description: "Laden Sie alles herunter, was diese App über Sie gespeichert hat.",

				card: {
					title: "Ihre Daten exportieren",
					description:
						"Eine JSON-Datei, erzeugt in dem Moment, in dem Sie sie anfordern. Es wird nichts gespeichert.",
					includes:
						"Enthält Ihr Profil und Ihre Einstellungen, jedes Team, dem Sie angehören, samt Ihrer Rolle darin und — für Teams, die Ihnen gehören — deren Monitore, Benachrichtigungen, Wartungsfenster, Statusseiten und verifizierte Domains.",
					excludes:
						"Enthält nicht, was nicht Ihnen zusteht: Angaben anderer Mitglieder, Adressen von Eingeladenen, Hashes von API-Schlüsseln, Webhook-Geheimnisse sowie Slack- oder Discord-Webhook-URLs. Auch der Prüfverlauf bleibt außen vor — er entsteht aus der obigen Konfiguration, und die Datei sagt das auch.",
				},

				form: {
					cta: "JSON herunterladen",
				},
			},

			deleteAccount: {
				title: "Konto löschen",
				description: "Schließen Sie Ihr Konto und löschen Sie die Daten dahinter.",

				queued: {
					title: "Löschung angefordert",
					description:
						"Ihr Konto ist zur Löschung vorgemerkt, und es wurde noch nichts gelöscht. Sie wird innerhalb eines Tages ausgeführt, und wir schreiben Ihnen eine E-Mail, sobald das erledigt ist. Sie können sie noch stoppen — brechen Sie sie unten jederzeit ab, bevor sie ausgeführt wird.",
					requestedAt: "Angefordert am {{date}}.",
					cta: "Löschung abbrechen",
				},

				card: {
					title: "Ihr Konto löschen",
					description:
						"Merkt Ihr Konto zur Löschung vor. Beim Absenden dieses Formulars wird nichts gelöscht.",

					whatHappens:
						"Ihre Anfrage wird vorgemerkt und Sie werden abgemeldet. Innerhalb eines Tages kündigen wir Ihr Abonnement, löschen Ihre Daten und bestätigen Ihnen per E-Mail, dass es erledigt ist. Bis dahin ist nichts verschwunden, und wenn Sie sich wieder anmelden, können Sie abbrechen.",

					noOwnedTeams:
						"Ihnen gehören keine Teams, daher werden nur Ihre eigenen Mitgliedschaften und Einstellungen entfernt. Die Teams, denen Sie angehören, bestehen ohne Sie weiter.",

					ownedTeamsIntro:
						"In dieser App gibt es keine Möglichkeit, ein Team an jemand anderen zu übergeben; deshalb wird jedes Team, das Ihnen gehört, mit Ihrem Konto gelöscht — samt seiner Monitore, Benachrichtigungen, Statusseiten, API-Schlüssel und Mitglieder:",
					ownedTeam_one: "{{name}} — 1 weiteres Mitglied verliert den Zugriff.",
					ownedTeam_other: "{{name}} — {{count}} weitere Mitglieder verlieren den Zugriff.",
					ownedTeamAlone: "{{name}} — keine weiteren Mitglieder.",

					othersWarning_one:
						"1 weitere Person verliert bei der Ausführung den Zugriff auf ein Team. Sie wird nicht gefragt und nicht gewarnt.",
					othersWarning_other:
						"{{count}} weitere Personen verlieren bei der Ausführung den Zugriff auf ihre Teams. Sie werden nicht gefragt und nicht gewarnt.",

					retained: {
						intro: "Manches lässt sich nicht löschen, und wir sagen es lieber offen:",
						billing:
							"Rechnungen und Zahlungsbelege, die unser Abrechnungsdienstleister aufbewahrt — das Steuerrecht verlangt, sie zu behalten.",
						analytics:
							"Ergebnisse der Monitor-Prüfungen in unserem Analysespeicher, der nur angehängt werden kann: Datensätze verfallen nach einem Aufbewahrungsplan und lassen sich nicht vorzeitig löschen.",
						logs: "Server-Anfrageprotokolle, die nach einem ebensolchen Plan verfallen.",
						identity:
							"Ihre Anmelde-Identität, die dem Identitätsanbieter gehört, mit dem Sie sich anmelden, und nicht uns.",
					},

					confirmation: {
						label: 'Geben Sie zur Bestätigung "DELETE" ein',
						placeholder: "DELETE",
					},

					cta: "Kontolöschung vormerken",
				},
			},
		},

		createTeam: {
			header: {
				title: "Team erstellen",
				description: "Erstellen Sie ein neues Team zur Überwachung Ihrer Dienste.",
			},

			dialog: {
				close: "Dialog schließen",
			},

			form: {
				fields: {
					name: {
						label: "Team-Name",
						placeholder: "Mein großartiges Team",
						description: "Wählen Sie einen Namen für Ihr neues Team.",
					},
				},

				cancel: "Abbrechen",
				cta: "Team erstellen",
			},
		},

		settings: {
			header: {
				title: "Team-Einstellungen",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			sections: {
				general: {
					title: "Allgemein",
					description: "Verwalten Sie die grundlegenden Informationen Ihres Teams.",
				},
			},

			form: {
				card: {
					title: "Team-Profil",
					description: "Aktualisieren Sie den Namen und das Logo Ihres Teams.",
				},

				fields: {
					logo: {
						label: "Logo-URL",
						placeholder: "https://beispiel.de/logo.png",
						description: "Eine URL zum Logo-Bild Ihres Teams.",
					},
					name: {
						label: "Team-Name",
						placeholder: "Mein Team",
						description: "Der Name Ihres Teams.",
					},
				},

				actions: {
					cancel: "Abbrechen",
					save: "Änderungen speichern",
				},
			},

			members: {
				title: "Mitglieder",
				description: "Verwalten Sie Ihre Team-Mitglieder und deren Rollen.",

				actions: {
					invite: "Mitglied einladen",
				},

				table: {
					label: "Aktuelle Mitglieder",
					description: "Personen, die Zugang zu diesem Team haben.",

					columns: {
						name: "Name",
						role: "Rolle",
						actions: "Aktionen",
					},

					role: {
						member: "Mitglied",
						admin: "Admin",
						owner: "Eigentümer",
					},

					actions: {
						menu: "Aktionsmenü",
						remove: "Aus Team entfernen",
						transfer: "Eigentum übertragen",
						changeRole: {
							member: "Zu Admin konvertieren",
							admin: "Zu Mitglied konvertieren",
							owner: "Eigentümer kann nicht geändert werden",
						},
					},

					confirmation: {
						removeMember: "Sind Sie sicher, dass Sie {{name}} aus dem Team entfernen möchten?",
					},
				},

				invitedTable: {
					label: "Ausstehende Einladungen",
					description: "Personen, die eingeladen wurden, aber noch nicht beigetreten sind.",

					columns: {
						email: "E-Mail",
						expires: "Läuft ab",
						actions: "Aktionen",
					},

					expires: {
						expired: "Abgelaufen",
					},

					actions: {
						menu: "Aktionsmenü",
						copy: "Einladungslink kopieren",
						revoke: "Einladung widerrufen",
					},

					confirmation: {
						revokeInvite:
							"Sind Sie sicher, dass Sie die Einladung von {{email}} widerrufen möchten?",
					},

					empty: {
						description: "Keine ausstehenden Einladungen.",
					},
				},
			},

			domains: {
				title: "Domains",
				description: "Verwalten Sie verifizierte Domains für Ihr Team.",

				actions: {
					addDomain: "Domain hinzufügen",
				},

				table: {
					label: "Verifizierte Domains",
					description:
						"Domains, die für die automatische Bereitstellung von Team-Mitgliedern verwendet werden können.",

					columns: {
						hostname: "Hostname",
						id: "Verifizierungs-ID",
						verifiedAt: "Verifiziert am",
						actions: "Aktionen",
					},

					verifiedAt: {
						pending: "Wartet auf Verifizierung",
					},

					actions: {
						menu: "Aktionsmenü",
						copy: "Verifizierungs-ID kopieren",
						remove: "Domain entfernen",
						retryVerification: "Verifizierung wiederholen",
					},

					confirmation: {
						removeDomain: "Sind Sie sicher, dass Sie {{hostname}} aus dem Team entfernen möchten?",
					},

					empty: {
						description: "Noch keine verifizierten Domains.",
					},
				},

				form: {
					title: "Domain hinzufügen",

					fields: {
						hostname: {
							label: "Domain",
							placeholder: "beispiel.de",
							description: "Die Domain, die Sie zu {{team}} hinzufügen möchten.",
						},
					},

					cta: "Domain hinzufügen",
				},

				instructions: {
					title: "So verifizieren Sie Ihre Domain",
					description:
						"Um Ihre Domain zu verifizieren, fügen Sie den folgenden TXT-Eintrag zu Ihren DNS-Einstellungen hinzu:",

					record: {
						name: {
							label: "Name",
							value: "_ping-verification",
						},
						content: {
							label: "Inhalt",
							value: "VERIFICATION_ID",
						},
					},

					note: "Stellen Sie sicher, dass Sie <code>VERIFICATION_ID</code> durch die oben angezeigte tatsächliche Verifizierungs-ID ersetzen.",
					disclaimer:
						"DNS-Änderungen können einige Zeit zur Propagierung benötigen, daher kann sich die Verifizierung verzögern.",
				},
			},

			billing: {
				title: "Abrechnung",
				description: "Verwalten Sie Ihr Abonnement und Zahlungsdetails.",

				card: {
					title: "Abonnement & Zahlungen",
					description:
						"Rechnungen anzeigen, Zahlungsmethoden aktualisieren und Ihr Abonnement verwalten.",
					notice:
						"Sie werden zum Kundenportal von Polar weitergeleitet, um Ihre Abrechnungseinstellungen zu verwalten.",
					cta: "Abrechnungsportal öffnen",
				},
			},

			danger: {
				title: "Gefahrenzone",
				description: "Unumkehrbare Aktionen, die Ihr Team betreffen.",

				card: {
					title: "Team löschen",
					description:
						"Löschen Sie dieses Team und alle seine Daten dauerhaft. Diese Aktion kann nicht rückgängig gemacht werden.",
					warning:
						"Dies wird Ihr Abonnement kündigen und alle Monitore, Benachrichtigungen, Domains, Mitglieder und Einladungen löschen.",
					confirmation: {
						label: "Geben Sie DELETE zur Bestätigung ein",
						placeholder: "DELETE",
					},
					cta: "Team löschen",
				},
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		flowMonitorDetail: {
			header: {
				breadcrumb: { flowMonitors: "Flow-Monitore" },
				action: { edit: "Bearbeiten" },
			},

			info: {
				status: "Status",
				interval: "Läuft alle",
				lastChecked: "Zuletzt geprüft",
				enabled: "Aktiv",
			},

			stats: {
				passRate: { label: "Erfolgsquote" },
				avgDuration: { label: "Ø Dauer" },
				totalRuns: { label: "Läufe insgesamt" },
			},

			failure: {
				title: "Letzter Fehler",
				failedTest: "{{test}} ist in Zeile {{line}} fehlgeschlagen.",
			},

			source: { title: "Flow" },

			results: {
				title: "Läufe",
				empty: "Noch keine Läufe.",
				label: "Flow-Läufe",
				columns: {
					time: "Zeit",
					status: "Status",
					tests: "Tests",
					requests: "Anfragen",
					duration: "Dauer",
				},
			},
		},

		flowMonitors: {
			header: {
				title: "Flow-Monitore",
				action: { create: "Erstellen" },
			},

			empty: {
				title: "Noch keine Flow-Monitore",
				description:
					"Ein Flow-Monitor führt mehrere Anfragen in Reihe aus und prüft die Antworten — anmelden, Token lesen, den damit autorisierten Endpunkt aufrufen. Er beantwortet die Frage, die eine einzelne Anfrage nicht stellen kann.",
				cta: "Ersten Flow-Monitor erstellen",
			},

			table: {
				label: "Flow-Monitore",
				columns: {
					name: "Name",
					interval: "Alle",
					status: "Status",
					lastChecked: "Zuletzt geprüft",
					actions: "Aktionen",
				},
				status: {
					pending: "Noch nicht geprüft",
					up: "Erfolgreich",
					down: "Fehlgeschlagen",
					error: "Nicht ausführbar",
					disabled: "Deaktiviert",
				},
				actions: {
					menu: "Aktionsmenü",
					view: "Ansehen",
					edit: "Bearbeiten",
					delete: "Löschen",
					confirmation: {
						delete:
							"Soll der Flow-Monitor {{name}} wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.",
					},
				},
			},

			run: {
				cta: "Jetzt ausführen",
				toast: {
					up: "{{name}} erfolgreich",
					down: "{{name}} fehlgeschlagen",
					error: "{{name}} konnte nicht ausgeführt werden",
					refused: "{{name}} wurde nicht ausgeführt",
					summary:
						"{{passed}} von {{total}} Tests erfolgreich, {{requests}} Anfragen, {{duration}}ms.",
					failedTest: "Fehlgeschlagen: {{test}} (Zeile {{line}}).",
				},
			},
		},

		createFlowMonitor: {
			header: {
				title: "Flow-Monitor erstellen",
				breadcrumb: { flowMonitors: "Flow-Monitore" },
			},

			form: {
				cta: "Flow-Monitor erstellen",
				sections: {
					basics: {
						title: "Flow",
						description: "Was dieser Flow tut und wie oft er ausgeführt wird.",
					},
				},
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Anmelden und Dashboard laden",
						description: "Ein beschreibender Name für diesen Flow.",
					},
					source: {
						label: "Flow",
						placeholder: 'test "ein Mitglied kann sich anmelden" { when { … } then { … } }',
						description:
							"Die Anfragen und die Zusicherungen dazwischen. Jede URL muss hier stehen, damit sie gegen die verifizierten Domains geprüft werden kann.",
						verifiedDomains: "Dieser Flow darf erreichen: {{domains}} — und deren Subdomains.",
						noVerifiedDomains:
							"Dieses Team hat keine verifizierten Domains, daher kann noch kein Flow laufen. Verifiziere zuerst eine Domain in den Team-Einstellungen.",
					},
					interval: {
						label: "Ausführen alle",
						description:
							"Wie oft dieser Flow läuft. Jeder Lauf berechnet eine Prüfung pro Anfrage, ein kürzeres Intervall kostet also mehr.",
						options: {
							"900": "15 Minuten",
							"1800": "30 Minuten",
							"3600": "1 Stunde",
							"10800": "3 Stunden",
							"21600": "6 Stunden",
							"43200": "12 Stunden",
							"86400": "1 Tag",
						},
					},
					isEnabled: { label: "Aktiv" },
				},
			},
		},

		editFlowMonitor: {
			header: {
				title: "Flow-Monitor bearbeiten",
				breadcrumb: { flowMonitors: "Flow-Monitore" },
			},

			lastRun: {
				title: "Letzter Lauf",
				description: "Was dieser Flow beim letzten Lauf ergeben hat.",
				summary:
					"{{passed}} von {{total}} Tests erfolgreich, {{requests}} Anfragen, {{duration}}ms.",
				failedTest: "Fehlgeschlagen: {{test}} (Zeile {{line}}).",
			},

			form: {
				cta: "Änderungen speichern",
				cancel: "Abbrechen",
				sections: {
					settings: {
						title: "Flow",
						description: "Was dieser Flow tut und wie oft er ausgeführt wird.",
					},
				},
				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Anmelden und Dashboard laden",
						description: "Ein beschreibender Name für diesen Flow.",
					},
					source: {
						label: "Flow",
						placeholder: 'test "ein Mitglied kann sich anmelden" { when { … } then { … } }',
						description:
							"Die Anfragen und die Zusicherungen dazwischen. Jede URL muss hier stehen, damit sie gegen die verifizierten Domains geprüft werden kann.",
						verifiedDomains: "Dieser Flow darf erreichen: {{domains}} — und deren Subdomains.",
						noVerifiedDomains:
							"Dieses Team hat keine verifizierten Domains, daher kann noch kein Flow laufen. Verifiziere zuerst eine Domain in den Team-Einstellungen.",
					},
					interval: {
						label: "Ausführen alle",
						description:
							"Wie oft dieser Flow läuft. Jeder Lauf berechnet eine Prüfung pro Anfrage, ein kürzeres Intervall kostet also mehr.",
						options: {
							"900": "15 Minuten",
							"1800": "30 Minuten",
							"3600": "1 Stunde",
							"10800": "3 Stunden",
							"21600": "6 Stunden",
							"43200": "12 Stunden",
							"86400": "1 Tag",
						},
					},
					isEnabled: { label: "Aktiv" },
				},
			},

			danger: {
				title: "Gefahrenbereich",
				sectionDescription: "Nicht umkehrbare Aktionen für diesen Flow-Monitor.",
				warning:
					"Beim Löschen dieses Flow-Monitors werden auch alle aufgezeichneten Ergebnisse gelöscht.",
				description: "Diese Aktion kann nicht rückgängig gemacht werden.",
				cta: "Flow-Monitor löschen",
			},
		},
		tcpMonitors: {
			header: {
				title: "TCP-Monitore",
				action: {
					create: "TCP-Monitor erstellen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
				limitation: {
					title: "TCP-Überwachungsbeschränkung",
					description:
						"TCP-Port-Überwachung erfordert den kostenpflichtigen Cloudflare Workers-Plan mit Socket-Unterstützung. Im kostenlosen Plan werden TCP-Prüfungen als nicht verfügbar angezeigt. Erwägen Sie HTTP-Überwachung als Alternative.",
				},
			},

			empty: {
				title: "Noch keine TCP-Monitore",
				description:
					"Erstellen Sie einen TCP-Monitor, um zu prüfen, ob Ports offen und reaktionsfähig sind.",
				cta: "TCP-Monitor erstellen",
			},

			table: {
				label: "TCP-Monitore",
				columns: {
					name: "Name",
					endpoint: "Host:Port",
					status: "Status",
					lastChecked: "Zuletzt geprüft",
					responseTime: "Antwortzeit",
					actions: "Aktionen",
				},
				status: {
					up: "Aktiv",
					down: "Ausgefallen",
					timeout: "Zeitüberschreitung",
					disabled: "Deaktiviert",
					pending: "Ausstehend",
				},
				actions: {
					edit: "Bearbeiten",
					delete: "Löschen",
					confirmation: {
						delete: "Sind Sie sicher, dass Sie {{name}} löschen möchten?",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "TCP-Monitor erstellen",
				breadcrumb: {
					tcpMonitors: "TCP-Monitore",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Grundlagen",
						description: "Was dieser Monitor überwacht und wie oft er es prüft.",
					},
				},

				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Datenbankserver",
						description: "Ein beschreibender Name für diesen TCP-Monitor.",
					},
					host: {
						label: "Host",
						placeholder: "db.beispiel.de",
						description: "Der Hostname oder die IP-Adresse zur Überwachung.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "Der zu prüfende TCP-Port (1-65535).",
						decrement: "Port verringern",
						increment: "Port erhöhen",
					},
					interval: {
						label: "Prüfintervall",
						description: "Wie oft der Port geprüft werden soll.",
						decrement: "Prüfintervall verringern",
						increment: "Prüfintervall erhöhen",
					},
					timeout: {
						label: "Verbindungs-Timeout",
						description:
							"Wie lange auf eine Verbindung gewartet wird, bevor eine Zeitüberschreitung auftritt.",
						decrement: "Verbindungs-Timeout verringern",
						increment: "Verbindungs-Timeout erhöhen",
					},
				},
				cta: "Monitor erstellen",
			},
		},

		editTcpMonitor: {
			header: {
				title: "TCP-Monitor bearbeiten",
				breadcrumb: {
					tcpMonitors: "TCP-Monitore",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				sections: {
					settings: {
						title: "Monitor-Einstellungen",
						description: "Womit sich dieser Monitor verbindet und wie oft er prüft.",
					},
				},

				fields: {
					name: {
						label: "Monitor-Name",
						placeholder: "Datenbankserver",
						description: "Ein beschreibender Name für diesen TCP-Monitor.",
					},
					host: {
						label: "Host",
						placeholder: "db.beispiel.de",
						description: "Der Hostname oder die IP-Adresse zur Überwachung.",
					},
					port: {
						label: "Port",
						placeholder: "5432",
						description: "Der zu prüfende TCP-Port (1-65535).",
						decrement: "Port verringern",
						increment: "Port erhöhen",
					},
					interval: {
						label: "Prüfintervall",
						description: "Wie oft der Port geprüft werden soll.",
						decrement: "Prüfintervall verringern",
						increment: "Prüfintervall erhöhen",
					},
					timeout: {
						label: "Verbindungs-Timeout",
						description:
							"Wie lange auf eine Verbindung gewartet wird, bevor eine Zeitüberschreitung auftritt.",
						decrement: "Verbindungs-Timeout verringern",
						increment: "Verbindungs-Timeout erhöhen",
					},
					isEnabled: {
						label: "Überwachung aktivieren",
					},
				},
				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			danger: {
				title: "Gefahrenzone",
				cta: "Monitor löschen",
				description:
					"Dadurch wird auch der Prüfergebnisverlauf gelöscht. Dies kann nicht rückgängig gemacht werden.",
				sectionDescription: "Aktionen in diesem Bereich können nicht rückgängig gemacht werden.",
				warning:
					"Wenn Sie diesen Monitor löschen, werden seine Prüfungen, sein Verlauf und seine Benachrichtigungen endgültig entfernt.",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "TCP-Monitore",
				},
				action: {
					edit: "Bearbeiten",
					checkNow: "Jetzt prüfen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			info: {
				title: "Monitor-Konfiguration",
				endpoint: "Endpunkt",
				status: "Status",
				interval: "Prüfintervall",
				timeout: "Timeout",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "Basierend auf den letzten Prüfungen",
				},
				avgResponseTime: {
					label: "Durchschn. Antwortzeit",
					description: "Durchschnittliche Verbindungszeit",
				},
				totalChecks: {
					label: "Gesamtprüfungen",
					description: "Anzahl der durchgeführten Prüfungen",
				},
			},

			history: {
				title: "Uptime-Verlauf",
			},

			results: {
				title: "Prüfverlauf",
				description: "Aktuelle TCP-Verbindungsprüfungsergebnisse",
				label: "Ergebnisse",
				empty: "Noch keine Prüfergebnisse. Ergebnisse erscheinen nach der ersten Prüfung.",
				columns: {
					time: "Zeit",
					status: "Status",
					responseTime: "Antwortzeit",
					error: "Fehler",
				},
			},
		},

		apiKeys: {
			header: {
				title: "API-Schlüssel",
				action: {
					create: "API-Schlüssel erstellen",
				},
			},

			docsLink: {
				text: "Erfahre, wie du API-Schlüssel verwendest, in unserer",
				link: "Dokumentation",
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Noch keine API-Schlüssel",
				description:
					"Erstellen Sie einen API-Schlüssel, um programmgesteuert auf die Uptime-API zuzugreifen.",
				cta: "API-Schlüssel erstellen",
			},

			newKey: {
				title: "API-Schlüssel '{{name}}' erstellt!",
				description:
					"Kopieren Sie diesen Schlüssel jetzt. Aus Sicherheitsgründen können Sie ihn nicht erneut sehen.",
				dismiss: "Ich habe meinen Schlüssel kopiert",
				copyLabel: "Schlüssel kopieren",
			},

			form: {
				title: "Neuen API-Schlüssel erstellen",
				description:
					"API-Schlüssel ermöglichen programmgesteuerten Zugriff auf Ihre Monitore und Benachrichtigungen.",

				sections: {
					details: {
						title: "Angaben zum Schlüssel",
						description:
							"Geben Sie dem Schlüssel einen Namen, an dem Sie ihn später wiedererkennen, und legen Sie fest, wann er ungültig werden soll.",
					},
				},

				fields: {
					name: {
						label: "Schlüsselname",
						placeholder: "Produktions-API-Schlüssel",
						description: "Ein Name zur Identifizierung dieses API-Schlüssels.",
					},
					scopes: {
						label: "Berechtigungen",
						description: "Wählen Sie, worauf dieser API-Schlüssel zugreifen kann.",
						descriptions: {
							"teams:read":
								"Name und Logo des Teams lesen sowie seine Mitglieder und deren Rollen auflisten.",
							"teams:write":
								"Name und Logo des Teams ändern. Mitglieder lassen sich damit weder hinzufügen noch entfernen, und das Team nicht löschen.",
							"invites:read":
								"Die Einladungen des Teams auflisten, offene wie angenommene, einschließlich der E-Mail-Adresse, an die jede ging.",
							"invites:write":
								"Eine E-Mail-Adresse ins Team einladen und eine bestehende Einladung zurückziehen. Wer eine Einladung annimmt, wird Mitglied.",
							"team-domains:read":
								"Die vom Team beanspruchten Domains auflisten und ob jede verifiziert ist.",
							"team-domains:write":
								"Eine Domain für das Team beanspruchen oder entfernen. Sobald eine Domain verifiziert ist, tritt jeder, der sich mit einer E-Mail-Adresse dieser Domain registriert, dem Team automatisch bei.",
							"monitors:read":
								"HTTP-Monitore, ihre Prüfergebnisse, ihre Verfügbarkeitsstatistiken und den Gesamtstatus des Teams lesen.",
							"monitors:write":
								"HTTP-Monitore und ihre Inhaltsprüfungen erstellen, ändern und löschen. Zusätzlich lässt sich damit ein Neuaufbau der Tagesstatistiken einreihen.",
							"maintenance:read": "Die Wartungsfenster des Teams auflisten und lesen.",
							"maintenance:write":
								"Wartungsfenster erstellen, ändern, vorzeitig beenden und löschen. Ein laufendes Fenster kann Benachrichtigungen für die abgedeckten Monitore unterdrücken.",
							"dns-monitors:read":
								"DNS-Monitore und die von ihnen aufgezeichneten Auflösungsergebnisse auflisten und lesen.",
							"dns-monitors:write": "DNS-Monitore erstellen, ändern und löschen.",
							"tcp-monitors:read":
								"TCP-Monitore und die von ihnen aufgezeichneten Verbindungsergebnisse auflisten und lesen.",
							"tcp-monitors:write": "TCP-Monitore erstellen, ändern und löschen.",
							"alerts:read":
								"Benachrichtigungen und die von ihnen ausgelösten Ereignisse auflisten und lesen. Webhook-URLs und andere Kanal-Geheimnisse werden nie zurückgegeben.",
							"alerts:write":
								"Benachrichtigungen erstellen, ändern und löschen, samt ihrer Webhook- und Chat-Ziele. Das Löschen einer Benachrichtigung stoppt alles, was sie versendet hat.",
							"status-pages:read":
								"Die Statusseiten des Teams und die jeweils angehängten Monitore auflisten und lesen.",
							"status-pages:write":
								"Statusseiten erstellen, ändern und löschen sowie festlegen, welche Monitore und Cron Jobs eine Seite öffentlich zeigt.",
							"cron-jobs:read": "Die Cron Jobs des Teams und ihre Zeitpläne auflisten und lesen.",
							"cron-jobs:write":
								"Cron Jobs erstellen, ändern und löschen. Wird einer gelöscht, wird seine Ping-URL nicht mehr angenommen.",
							"cron-jobs:ping":
								"Aufgeführt wegen der Ping-URL der Cron Jobs, die öffentlich ist und keinen Bereich prüft. Die Vergabe verschafft einem Schlüssel keinen Zugriff, den er nicht ohnehin hat.",
							"api-keys:read":
								"Die API-Schlüssel des Teams mit Name, Präfix, Bereichen und Ablauf auflisten. Der geheime Schlüssel selbst wird nie zurückgegeben.",
							"api-keys:write":
								"API-Schlüssel des Teams erstellen und löschen. Ein neuer Schlüssel kann jeden Bereich erhalten, dieser hier kann also jede andere Berechtigung vergeben.",
							"ping:trigger":
								"Einmalige HTTP-, DNS- und TCP-Prüfungen ausführen, ohne einen Monitor anzulegen. Jede Prüfung wird als ein Ping abgerechnet und erfordert ein aktives Abonnement.",
						} satisfies Record<ApiKeyScope, string>,
					},
					expiresAt: {
						label: "Ablaufdatum (optional)",
						description: "Leer lassen für einen Schlüssel, der nie abläuft.",
					},
				},

				actions: {
					cancel: "Abbrechen",
					create: "API-Schlüssel erstellen",
				},
			},

			table: {
				label: "API-Schlüssel",

				columns: {
					name: "Name",
					prefix: "Schlüssel",
					scopes: "Berechtigungen",
					lastUsed: "Zuletzt verwendet",
					expires: "Läuft ab",
					actions: "Aktionen",
				},

				lastUsed: {
					never: "Nie",
				},

				expires: {
					never: "Nie",
				},

				actions: {
					menu: "Aktionsmenü",
					delete: "Schlüssel löschen",
				},

				confirmation: {
					delete:
						"Sind Sie sicher, dass Sie den API-Schlüssel '{{name}}' löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
				},
			},

			error: {
				forbidden: {
					title: "Sie haben keine Berechtigung, auf diese Seite zuzugreifen.",
					description: "Bitte kontaktieren Sie Ihren Team-Administrator für Unterstützung.",
				},

				unknown: {
					title: "Ein unerwarteter Fehler ist aufgetreten.",
					description: "Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.",
				},
			},
		},

		cronJobs: {
			header: {
				title: "Cron Jobs",
				action: {
					create: "Cron Job erstellen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			empty: {
				title: "Noch keine Cron Jobs",
				description:
					"Erstellen Sie einen Cron Job Monitor, um Ihre geplanten Aufgaben zu verfolgen.",
				cta: "Cron Job erstellen",
			},

			table: {
				label: "Cron Job Monitore",
				columns: {
					name: "Name",
					schedule: "Zeitplan",
					status: "Status",
					lastPing: "Letzter Ping",
					nextExpected: "Nächster Erwartet",
					actions: "Aktionen",
				},
				status: {
					healthy: "Gesund",
					late: "Verspätet",
					missed: "Verpasst",
					new: "Neu",
				},
				disabled: "Deaktiviert",
				actions: {
					edit: "Bearbeiten",
					delete: "Löschen",
					confirmation: {
						delete: "Sind Sie sicher, dass Sie {{name}} löschen möchten?",
					},
				},
			},
		},

		createCronJob: {
			header: {
				title: "Cron Job erstellen",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Grundlagen",
						description: "Wie dieser Job heißt und was er tut.",
					},
					schedule: {
						title: "Zeitplan",
						description:
							"Wann der Job laufen soll und wie viel Verspätung erlaubt ist, bevor er als versäumt gilt.",
					},
					alerting: {
						title: "Benachrichtigungen",
						description: "Was passiert, wenn ein erwarteter Lauf ausbleibt.",
					},
				},

				fields: {
					name: {
						label: "Name",
						placeholder: "Tägliches Backup",
						description: "Ein beschreibender Name für diesen Cron Job Monitor.",
					},
					description: {
						label: "Beschreibung",
						placeholder: "Optionale Beschreibung, was dieser Job tut",
						description: "Eine optionale Beschreibung zur Identifizierung dieses Cron Jobs.",
					},
					cronExpression: {
						label: "Cron-Ausdruck",
						placeholder: "0 * * * *",
						description: "Der Cron-Zeitplanausdruck (z.B. '0 * * * *' für jede Stunde).",
					},
					gracePeriod: {
						label: "Karenzzeit",
						description:
							"Wie lange nach der erwarteten Zeit gewartet werden soll, bevor als verspätet markiert wird.",
						decrement: "Karenzzeit verringern",
						increment: "Karenzzeit erhöhen",
						unit: {
							minutes: "Minuten",
							seconds: "Sekunden",
						},
					},
					timezone: {
						label: "Zeitzone",
						description: "Die Zeitzone für den Cron-Zeitplan.",
					},
					alertOnLate: {
						label: "Bei Verspätung benachrichtigen",
						description:
							"Eine Benachrichtigung senden, wenn der Job seine erwartete Zeit verpasst.",
					},
					enabled: {
						label: "Aktiviert",
						description: "Diesen Cron Job sofort überwachen.",
					},
				},
				cta: "Cron Job erstellen",
			},
		},

		editCronJob: {
			header: {
				title: "Cron Job bearbeiten",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			form: {
				sections: {
					basics: {
						title: "Grundlagen",
						description: "Wie dieser Job heißt und was er tut.",
					},
					schedule: {
						title: "Zeitplan",
						description:
							"Wann der Job laufen soll und wie viel Verspätung erlaubt ist, bevor er als versäumt gilt.",
					},
					alerting: {
						title: "Benachrichtigungen",
						description: "Was passiert, wenn ein erwarteter Lauf ausbleibt.",
					},
				},

				fields: {
					name: {
						label: "Name",
						placeholder: "Tägliches Backup",
						description: "Ein beschreibender Name für diesen Cron Job Monitor.",
					},
					description: {
						label: "Beschreibung",
						placeholder: "Optionale Beschreibung, was dieser Job tut",
						description: "Eine optionale Beschreibung zur Identifizierung dieses Cron Jobs.",
					},
					cronExpression: {
						label: "Cron-Ausdruck",
						placeholder: "0 * * * *",
						description: "Der Cron-Zeitplanausdruck (z.B. '0 * * * *' für jede Stunde).",
					},
					gracePeriod: {
						label: "Karenzzeit",
						description:
							"Wie lange nach der erwarteten Zeit gewartet werden soll, bevor als verspätet markiert wird.",
						decrement: "Karenzzeit verringern",
						increment: "Karenzzeit erhöhen",
						unit: {
							minutes: "Minuten",
							seconds: "Sekunden",
						},
					},
					timezone: {
						label: "Zeitzone",
						description: "Die Zeitzone für den Cron-Zeitplan.",
					},
					alertOnLate: {
						label: "Bei Verspätung benachrichtigen",
						description:
							"Eine Benachrichtigung senden, wenn der Job seine erwartete Zeit verpasst.",
					},
					enabled: {
						label: "Aktiviert",
						description: "Ob dieser Cron Job aktiv überwacht werden soll.",
					},
				},
				cancel: "Abbrechen",
				cta: "Änderungen speichern",
			},

			danger: {
				title: "Gefahrenzone",

				description: "Aktionen in diesem Bereich können nicht rückgängig gemacht werden.",
				warning:
					"Wenn Sie diesen Cron Job löschen, werden sein Ping-Verlauf und seine Benachrichtigungen endgültig entfernt.",
				delete: {
					trigger: "Monitor löschen",
					confirmTitle: "Diesen Cron-Job-Monitor löschen?",
					confirmDescription:
						"Dies löscht auch dessen Ping-Verlauf. Dies kann nicht rückgängig gemacht werden.",
					confirm: "Löschen",
				},
			},
		},

		cronJobDetail: {
			header: {
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
				action: {
					edit: "Bearbeiten",
					delete: "Löschen",
				},
			},

			alert: {
				subscription: {
					title: "Ihre Monitore sind pausiert!",
					description:
						"Ein Abonnement ist erforderlich, um die automatische Überwachung fortzusetzen.",
					cta: "Überwachung starten",
				},
			},

			info: {
				title: "Cron Job Konfiguration",
				schedule: "Zeitplan",
				timezone: "Zeitzone",
				status: "Status",
				gracePeriod: "Karenzzeit",
				gracePeriodValue: "{{duration}} Karenz",
				description: "Beschreibung",
			},

			stats: {
				totalPings: {
					label: "Gesamt Pings",
					description: "Anzahl empfangener Pings",
				},
				onTimeRate: {
					label: "Pünktlichkeitsrate",
					description: "Prozentsatz pünktlicher Pings",
				},
				lastPing: {
					label: "Letzter Ping",
					description: "Wann der letzte Ping empfangen wurde",
					never: "Nie",
				},
				nextExpected: {
					label: "Nächster Erwartet",
					description: "Wann der nächste Ping erwartet wird",
				},
			},

			ping: {
				title: "Diesen Monitor pingen",
				description:
					"Lassen Sie Ihren Job nach Abschluss eine POST-Anfrage hierher senden, mit einem API-Schlüssel mit dem Bereich `cron-jobs:ping`.",
				snippet: {
					curl: "Aus einem Skript",
					copyCurl: "Befehl kopieren",
					crontab: "Aus der Crontab",
					copyCrontab: "Crontab-Zeile kopieren",
				},
				apiKey: {
					text: "Ohne Schlüssel mit diesem Bereich wird der Ping mit einem 401 abgelehnt, und der Lauf gilt trotzdem als verpasst.",
					cta: "API-Schlüssel erstellen",
				},
			},

			uptimeHistory: "Verlauf der Betriebszeit",

			pings: {
				title: "Ping-Verlauf",
				description: "Kürzlich empfangene Pings von diesem Cron Job",
				empty:
					"Noch keine Pings empfangen. Pings werden hier angezeigt, nachdem Ihr Job seinen ersten Ping gesendet hat.",
				label: "Pings",
				columns: {
					time: "Zeit",
					status: "Status",
					sourceIp: "Quell-IP",
				},
				status: {
					onTime: "Pünktlich",
					late: "Verspätet",
				},
			},

			integration: {
				title: "Integrations-Anleitung",
				description:
					"Senden Sie eine POST-Anfrage an diesen Endpunkt, wenn Ihr Cron Job abgeschlossen ist.",
				endpoint: "Ping-Endpunkt",
				curlExample: "cURL-Beispiel",
				codeExamples: {
					title: "Code-Beispiele",
					bash: "Bash / Cron",
					python: "Python",
					nodejs: "Node.js",
				},
				apiKeyNote:
					"Sie benötigen einen API-Schlüssel mit dem Bereich 'cron-jobs:ping'. Erstellen Sie einen in den API-Schlüssel-Einstellungen.",
			},

			delete: {
				confirmation:
					"Sind Sie sicher, dass Sie {{name}} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
			},
		},
	},

	docs: {
		meta: {
			title: "Dokumentation – Uptime",
			description:
				"Dokumentation zum Überwachungsdienst Uptime. Erfahren Sie, wie Sie Monitore, Benachrichtigungen, Statusseiten und mehr einsetzen.",
		},

		header: {
			cta: {
				in: "Dashboard öffnen",
				out: "Überwachung starten",
			},
		},

		sidebar: {
			title: "Dokumentation",
			description: "Anleitungen und Referenz",
			searchPlaceholder: "Suchen …",
			openMenu: "Menü öffnen",
			closeMenu: "Menü schließen",
		},

		nav: {
			gettingStarted: "Erste Schritte",
			overview: "Überblick",
			quickstart: "Schnellstart",

			api: "API-Referenz",
			apiOverview: "API-Überblick",
			authentication: "Authentifizierung",
			errors: "Fehler",

			resources: "Ressourcen",
			monitors: "Monitore",
			dnsMonitors: "DNS-Monitore",
			tcpMonitors: "TCP-Monitore",
			cronJobs: "Cron Jobs",
			alerts: "Benachrichtigungen",
			statusPages: "Statusseiten",
		},

		error: {
			title: "Fehler in der Dokumentation",
			description: "Beim Laden dieser Dokumentationsseite ist ein Fehler aufgetreten.",
			notFoundTitle: "Seite nicht gefunden",
			notFoundDescription: "Die gesuchte Dokumentationsseite existiert nicht.",
		},

		lastUpdated: "Zuletzt aktualisiert: {{date}}",
	},
};
