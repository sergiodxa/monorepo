/**
 * Italian (it) translation dictionary for the Uptime app. It maps every UI copy key
 * to its Italian string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in Italian, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ApiKeyScope } from "~/database/schema";

export default {
	landing: {
		meta: {
			title: "Uptime di Sergio Xalambrí",
			description: "Monitoraggio uptime semplice e affidabile per sviluppatori",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "Prezzi",
				features: "Funzionalità",
				compare: "Confronta",
				docs: "Documentazione",

				cta: {
					in: "Apri Dashboard",
					out: "Inizia il Monitoraggio",
				},
			},
		},

		hero: {
			pill: "Monitoraggio Uptime",
			title: "Monitora i tuoi servizi <strong>con sicurezza</strong>",
			description:
				"Riceva avvisi istantanei quando i suoi siti web e API vanno offline. Monitora i suoi siti web e API con facilità.",

			cta: {
				in: "Apri Dashboard",
				out: "Inizia il Monitoraggio",
				pricing: "Vedi Prezzi",
			},

			screenshot: {
				alt: "Screenshot della dashboard di Uptime: una barra laterale con monitor HTTP, DNS e TCP, cron job, avvisi, manutenzione e pagine di stato; schede di riepilogo con l'uso mensile dei ping, la percentuale di uptime complessiva e l'endpoint più lento; il numero di monitor attivi e non raggiungibili per tipo; e una tabella dei monitor HTTP con grafici dell'andamento della latenza ed etichette di stato",
			},

			trustIndicators: {
				freeToStart: "Gratis per iniziare",
				payForAutomation: "Paghi per l'automazione",
				cancelAnytime: "Annulli quando vuole",
			},
		},

		trustIndicators: {
			uptimeSla: "SLA Uptime",
			globalRegions: "Regioni Globali",
			daysDataRetention: "Giorni Conservazione Dati",
			alertLatency: "Latenza Avvisi",
		},

		features: {
			title: "Monitoraggio Potente Reso Semplice",
			description:
				"Tutto ciò che Le serve per mantenere i suoi servizi attivi senza inutili complessità.",
			badge: "Funzionalità",
			learnMore: "Scopri di più",

			list: {
				first: {
					title: "Monitora il tuo uptime",
					description:
						"Traccia i suoi servizi 24/7 con il 99,9% di affidabilità del monitoraggio. Ottenga metriche dettagliate e informazioni sulle prestazioni a colpo d'occhio.",
				},
				second: {
					title: "Riceva avvisi ovunque",
					description:
						"Riceva notifiche istantanee via email, Slack, Discord o webhook quando i suoi servizi subiscono interruzioni o problemi di prestazioni.",
				},
				third: {
					title: "Paghi per quello che usa",
					description:
						"Prezzi trasparenti senza costi nascosti. Scala verso l'alto o verso il basso secondo necessità, con piani che crescono con le sue esigenze di monitoraggio.",
				},
				fourth: {
					title: "Pagine di Stato",
					description:
						"Crei bellissime pagine di stato pubbliche per tenere informati i suoi utenti sulla disponibilità dei servizi e sugli incidenti.",
				},
				fifth: {
					title: "Monitoraggio SSL",
					description:
						"Tenga traccia delle date di scadenza dei certificati e riceva avvisi prima che i suoi certificati SSL scadano per prevenire avvisi di sicurezza.",
				},
				sixth: {
					title: "Monitoraggio DNS",
					description:
						"Rilevi modifiche ai record DNS e problemi di propagazione prima che impattino i suoi utenti o vengano dirottati.",
				},
				seventh: {
					title: "Integrazioni Native",
					description:
						"Integrazioni dirette con Slack e Discord con notifiche avanzate, non solo webhook di base.",
				},
			},
		},

		completeFeatureSet: {
			badge: "Set Completo di Funzionalità",
			title: "Tutto ciò che Le serve per un monitoraggio affidabile",
			description: "Capacità avanzate che rendono il monitoraggio semplice e completo.",

			list: {
				maintenanceWindows: {
					title: "Finestre di Manutenzione",
					description:
						"Programmi i tempi di inattività e sopprima gli avvisi durante la manutenzione pianificata",
				},
				contentMonitoring: {
					title: "Monitoraggio Contenuti",
					description:
						"Verifichi che parole chiave o contenuti specifici appaiano sulle sue pagine",
				},
				recoveryAlerts: {
					title: "Avvisi di Ripristino",
					description: "Venga notificato quando i servizi tornano online dopo un incidente",
				},
				apiAccess: {
					title: "Accesso API",
					description: "API REST completa con gestione delle chiavi per l'automazione",
				},
				alertCooldowns: {
					title: "Cooldown Avvisi",
					description: "Prevenga l'affaticamento da avvisi con periodi di cooldown configurabili",
				},
				customHeaders: {
					title: "Header Personalizzati",
					description: "Aggiunga header di autenticazione e parametri di richiesta personalizzati",
				},
				cronMonitoring: {
					title: "Monitoraggio Cron Job",
					description:
						"Monitori i job programmati e le attività in background con controlli heartbeat",
				},
			},
		},

		useCases: {
			badge: "Casi d'Uso",
			title: "Progettato per ogni esigenza di monitoraggio",
			description:
				"Dai semplici controlli di integrità ai sistemi distribuiti complessi, siamo qui per Lei.",
			learnMore: "Scopri di più",
			tailoredFor: "Soluzioni su misura per:",

			list: {
				websiteMonitoring: {
					title: "Monitoraggio Siti Web",
					description:
						"Tenga traccia dell'uptime e delle prestazioni per landing page, blog e applicazioni web.",
				},
				apiMonitoring: {
					title: "Monitoraggio API",
					description: "Monitori API REST, endpoint GraphQL e webhook per la disponibilità.",
				},
				saas: {
					title: "Applicazioni SaaS",
					description:
						"Mantenga affidabile il suo prodotto SaaS con monitoraggio proattivo e avvisi istantanei.",
				},
				microservices: {
					title: "Microservizi",
					description: "Monitori sistemi distribuiti e rilevi i guasti prima che si propaghino.",
				},
				healthChecks: {
					title: "Controlli di Integrità",
					description:
						"Verifichi lo stato dei servizi e le connessioni al database con ping programmati.",
				},
				ecommerce: {
					title: "E-commerce",
					description:
						"Monitori i flussi di checkout, le API di pagamento e le pagine prodotto per proteggere i ricavi.",
				},
			},

			audiences: {
				indieHackers: "Indie Hacker",
				soloDevelopers: "Sviluppatori Singoli",
				startups: "Startup",
				agencies: "Agenzie",
				enterprises: "Aziende",
				devops: "DevOps",
			},
		},

		pricing: {
			badge: "Prezzi",
			title: "Prezzi Semplici e Trasparenti",
			description:
				"Un abbonamento, nessun livello. Paghi solo per quello che usa con il nostro modello di prezzi diretto",

			howItWorks: {
				title: "Come funzionano i prezzi",

				list: {
					first: {
						title: "Abbonamento base",
						description: "{{price}}/mese include i primi {{included}} ping",
					},

					second: {
						title: "Ping aggiuntivi",
						description:
							"{{blockPrice}} ogni {{blockSize}} ping aggiuntivi, fatturati a blocchi interi",
					},

					third: {
						title: "Nessun costo nascosto",
						description:
							"Nessun costo aggiuntivo per funzionalità o integrazioni. Paghi per i ping che utilizza.",
					},
				},
			},

			calculator: {
				title: "Calcolatore Prezzi",
				description: "Calcola il costo mensile in base alle sue esigenze di monitoraggio",

				add: "Aggiungi Monitor",

				monitor: {
					label: "Frequenza monitor",
					delete: "Rimuovi",
					frequency: {
						lower: "1m",
						upper: "60m",
					},
				},

				stats: {
					pingsPerMonth: "Ping al mese:",
					baseSubscription: "Abbonamento base",
					includes: "Include i primi {{amount}} ping",
					additionalPings: "Ping aggiuntivi:",
					additionalPingsCost:
						"{{blocks}} × {{blockPrice}} ogni {{blockSize}} ping ({{pings}} in più)",
					totalCost: "Costo mensile totale:",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "Domande Frequenti",
			description: "Trova risposte alle domande comuni su Uptime",

			list: {
				first: {
					q: "Come monitora Uptime i miei servizi?",
					a: "Uptime invia richieste HTTP o HTTPS regolari ai suoi endpoint. Controlliamo i codici di risposta e i tempi di risposta per determinare se il suo servizio è disponibile e reattivo.",
				},

				second: {
					q: "Cosa succede quando viene rilevata un'interruzione?",
					a: "Quando Uptime rileva un'interruzione, invia immediatamente un avviso attraverso i canali che ha configurato.",
				},

				third: {
					q: "Posso monitorare servizi interni?",
					a: "Sì, purché i suoi servizi interni siano accessibili da internet. Può anche configurare intestazioni personalizzate per autenticare le richieste.",
				},

				fourth: {
					q: "Come posso iniziare?",
					a: "Basta registrarsi, creare il primo monitor e configurare le preferenze di avviso. Sarà operativo in meno di un minuto.",
				},

				fifth: {
					q: "C'è un piano gratuito?",
					a: "Sì! Può creare monitor illimitati e attivare ping manualmente gratuitamente, per sempre. Il monitoraggio automatico programmato richiede un abbonamento.",
				},

				sixth: {
					q: "Per quanto tempo vengono conservati i dati dei ping?",
					a: "Conserviamo i risultati dei suoi ping per 365 giorni. Successivamente vengono eliminati automaticamente.",
				},

				seventh: {
					q: "Posso monitorare servizi che richiedono autenticazione?",
					a: "Sì. Può impostare intestazioni personalizzate con token o credenziali per autenticare le sue richieste.",
				},

				eighth: {
					q: "Posso monitorare più URL?",
					a: "Sì. Basta creare un monitor separato per ogni URL. Ogni monitor può avere la propria frequenza di controllo, metodo HTTP, codice di stato atteso e altro.",
				},

				ninth: {
					q: "Posso monitorare API?",
					a: "Assolutamente. Uptime è progettato per monitorare sia siti web che API. Può impostare l'endpoint, il metodo, le intestazioni e le risposte attese per monitorare efficacemente la sua API.",
				},

				tenth: {
					q: "Posso impostare un timeout per ogni ping?",
					a: "Sì. Può configurare un timeout per ogni monitor. Se la risposta impiega più tempo del previsto, viene considerata un fallimento. Questo aiuta a rilevare servizi lenti.",
				},

				eleventh: {
					q: "Posso mettere in pausa o disabilitare temporaneamente un monitor?",
					a: "Sì. Può mettere in pausa qualsiasi monitor in qualsiasi momento, individualmente.",
				},

				twelfth: {
					q: "Posso testare un monitor subito dopo averlo creato?",
					a: "Sì. Un ping viene automaticamente attivato subito dopo la creazione di un monitor.",
				},

				thirteenth: {
					q: "Supportate le pagine di stato?",
					a: "Sì! Crea pagine di stato pubbliche personalizzabili per condividere lo stato dei suoi servizi con gli utenti. Includa qualsiasi monitor desideri e aggiunga il suo branding.",
				},

				fourteenth: {
					q: "Posso visualizzare i trend storici delle prestazioni?",
					a: "Conserviamo tutti i risultati passati in modo da avere una cronologia completa. I grafici dei trend delle prestazioni sono pianificati per una versione futura.",
				},

				fifteenth: {
					q: "Quali canali di avviso sono supportati?",
					a: "Email, Slack, Discord e webhook. Le integrazioni native rendono facile ricevere avvisi dove il suo team lavora già. I webhook Le permettono di connettersi a qualsiasi altro servizio.",
				},

				sixteenth: {
					q: "Supportate team o monitor condivisi?",
					a: "Sì! Ogni utente inizia con un team. Inviti i membri del team con ruoli diversi (Proprietario, Amministratore, Membro). Il provisioning automatico del dominio aggiunge automaticamente gli utenti con domini email aziendali verificati.",
				},

				seventeenth: {
					q: "Cosa succede se supero i limiti del mio piano?",
					a: "L'utilizzo oltre i {{included}} ping inclusi nel suo abbonamento viene fatturato a blocchi interi di {{blockSize}} a {{blockPrice}} ciascuno: un solo ping in più avvia un nuovo blocco.",
				},

				eighteenth: {
					q: "Memorizzate i body delle richieste o delle risposte?",
					a: "No. Non memorizziamo mai i dati del body. Per maggiore privacy ed efficienza, consigliamo di utilizzare il metodo `HEAD`.",
				},

				nineteenth: {
					q: "Da quali regioni posso monitorare i miei servizi?",
					a: "Uptime supporta il monitoraggio da più regioni: Africa, Asia-Pacifico, Europa Orientale e Occidentale, Nord America Orientale e Occidentale, Medio Oriente, Oceania e Sud America.\n\nPuò scegliere una regione per monitor. La regione è trattata come un suggerimento, il ping effettivo proverrà da un server in quella regione o nelle vicinanze.",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "Monitoraggio semplice e affidabile per i suoi siti web e API.",
			copyright: "© {{year}} Uptime di Sergio Xalambrí. Tutti i diritti riservati.",
			sections: {
				product: {
					title: "Prodotto",
					features: "Funzionalità",
					pricing: "Prezzi",
					faq: "FAQ",
				},
				features: {
					title: "Funzionalità",
					monitors: "Monitor",
					alerts: "Avvisi",
					statusPages: "Pagine di stato",
					ssl: "Monitoraggio SSL",
					dns: "Monitoraggio DNS",
					cronJobs: "Monitoraggio Cron Job",
					contentMonitoring: "Monitoraggio contenuti",
					maintenance: "Finestre di manutenzione",
					integrations: "Integrazioni",
					teams: "Team",
					analytics: "Analisi",
					api: "Accesso API",
				},
				useCases: {
					title: "Casi d'uso",
					websiteMonitoring: "Monitoraggio siti web",
					apiMonitoring: "Monitoraggio API",
					saas: "Applicazioni SaaS",
					ecommerce: "E-commerce",
					cronJobs: "Monitoraggio Cron Job",
				},
				solutions: {
					title: "Soluzioni",
					indieHackers: "Per Indie Hacker",
					soloDevs: "Per sviluppatori singoli",
					startups: "Per startup",
					agencies: "Per agenzie",
					enterprises: "Per aziende",
					devops: "Per DevOps",
				},
				compare: {
					title: "Confronta",
					uptimerobot: "vs UptimeRobot",
					pingdom: "vs Pingdom",
					betterUptime: "vs Better Uptime",
					healthchecks: "vs Healthchecks.io",
					cronitor: "vs Cronitor",
				},
				legal: {
					title: "Legale",
					terms: "Termini di servizio",
					privacy: "Informativa sulla privacy",
				},
			},
		},

		comparison: {
			tableLabel: "Uptime vs {{competitor}}",
			tableCategoryHeader: "Categoria",
			tableProductHeader: "Uptime",
			whyTeamsSwitchTitle: "Perché i team passano a Uptime",
			gettingStartedTitle: "Per iniziare",
			finalCtaTitle: "Passa a Uptime",

			honestTake: {
				badge: "Opinione sincera",
				title: "Quando {{competitor}} può essere la scelta migliore",
				description:
					"Crediamo nella trasparenza. Ecco i casi in cui {{competitor}} potrebbe essere la scelta giusta.",
			},

			pricing: {
				badge: "Prezzi",
				title: "Confronto reale dei costi",
				description:
					"Scopri quanto potresti risparmiare con una configurazione di monitoraggio tipica.",
				tableLabel: "Confronto dei costi: Uptime vs {{competitor}}",
				scenarioHeader: "Caso d'uso",
				savingsHeader: "Risparmio",
				savingsPerYear: "~{{amount}}/anno",
				footnote:
					"Stime basate su modelli di utilizzo tipici. I prezzi di {{competitor}} possono cambiare e il costo effettivo dipende dalla tua configurazione.",
			},
		},

		finalCta: {
			body: "Crei il suo primo monitor in meno di 2 minuti. Nessuna carta di credito richiesta per iniziare.",
		},

		marketingPage: {
			everythingBadge: "Nel dettaglio",
			everythingTitle: "Tutto ciò che Le serve",
			everythingDescription:
				"Uno sguardo più attento a ciò che ottiene, dal primo controllo all'avviso che Le arriva.",
			howItWorksBadge: "Per iniziare",
			howItWorksTitle: "Come funziona",
			howItWorksDescription:
				"Tre passaggi per passare da una dashboard vuota a controlli che si eseguono da soli.",
			faqBadge: "FAQ",
			faqTitle: "Domande Frequenti",
			faqDescription: "Le domande più comuni prima di iniziare a monitorare.",
			finalCtaTitle: "Inizi a monitorare i suoi servizi",
		},
	},

	app: {
		meta: {
			title: "Uptime di Sergio Xalambrí",
			description: "Monitoraggio uptime semplice e affidabile per sviluppatori",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "Seleziona Team" },
				userMenu: { label: "Menu Utente" },

				navigation: {
					items: {
						dashboard: "Dashboard",
						alerts: "Avvisi",
						maintenance: "Manutenzione",
						monitors: "Monitor",
						httpMonitors: "Monitor HTTP",
						statusPages: "Pagine di Stato",
						tcpMonitors: "Monitor TCP",
						dnsMonitors: "Monitor DNS",
						cronJobs: "Cron Jobs",
						settings: "Impostazioni",
						billing: "Fatturazione",
						domains: "Domini",
						members: "Membri",
						team: "Team",
						docs: "Documentazione",
						apiKeys: "Chiavi API",
					},
				},

				account: {
					title: "Account",
					overview: "Panoramica",
					teams: "I Suoi Team",
				},
			},
		},

		errors: {
			notFound: {
				title: "404 Non Trovato",
				description: "Il team che sta cercando non esiste.",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "Statistiche",
			uptime: "Uptime",
			totalChecks: "Controlli Totali",
			lastCheck: "Ultimo Controllo",
			neverRan: "N/D",
		},

		actions: {
			refresh: "Aggiorna",
			delete: {
				confirm: "È sicuro di voler eliminare questo monitor?",
				cta: "Elimina Monitor",
			},
		},
	},

	monitorList: {
		header: {
			title: "Monitor Uptime",
			cta: "Crea Monitor",
			subscribe: "I suoi monitor sono in pausa. Si abboni per continuare il monitoraggio",
		},
	},

	statusPage: {
		banner: {
			operational: "Tutti i sistemi sono operativi",
			degraded: "Interruzione parziale del sistema",
			down: "Interruzione grave del sistema",
		},
		status: {
			operational: "Operativo",
			degraded: "Degradato",
			down: "Non Attivo",
			unknown: "Sconosciuto",
		},
		heatmap: {
			daysAgo: "90 giorni fa",
			today: "Oggi",
			legend: {
				full: "100%",
				partial: "Parziale",
				down: "Non Attivo",
				noData: "Nessun dato",
			},
			tooltip: {
				uptime: "{{percentage}}% uptime",
				noData: "Nessun dato",
			},
		},
		cronJobs: {
			title: "Attività pianificate",
			lastPing: "Ultimo ping",
			never: "Mai",
			schedule: "Pianificazione",
		},
		empty: {
			description: "Nessun servizio configurato per questa pagina di stato.",
		},
		footer: {
			lastUpdated: "Ultimo aggiornamento {{date}}",
			poweredBy: "Offerto da Uptime",
		},
		error: {
			title: "Pagina di Stato Non Trovata",
			description: "La pagina di stato che sta cercando non esiste o non è pubblica.",
			goHome: "Vai alla homepage",
		},
	},

	contentMonitoring: {
		title: "Monitoraggio Contenuti",
		description:
			"Controlla il contenuto della risposta per parole chiave o pattern specifici. Il monitor fallirà se un controllo non passa.",
		empty:
			"Nessun controllo contenuti configurato. Aggiunga un controllo per monitorare parole chiave o pattern specifici nella risposta.",
		addButton: "Aggiungi Controllo Contenuti",

		form: {
			checkType: {
				label: "Tipo di Controllo",
				description: "Scelga come confrontare il contenuto della risposta",
				options: {
					contains: "Contiene",
					notContains: "Non Contiene",
					regex: "Pattern Regex",
				},
			},
			value: {
				label: "Valore",
				placeholder: "Inserisca parola chiave o pattern",
				description: "Il testo o pattern regex da cercare",
			},
			caseSensitive: "Corrispondenza maiuscole/minuscole",
			cancel: "Annulla",
			add: "Aggiungi Controllo",
		},

		item: {
			type: "Tipo",
			status: "Stato",
			caseSensitive: "Maiuscole/minuscole",
			enabled: "Abilitato",
			disabled: "Disabilitato",
			yes: "Sì",
			no: "No",
			delete: "Elimina",
			deleteConfirmTitle: "Eliminare questo controllo dei contenuti?",
		},

		types: {
			contains: "Contiene",
			notContains: "Non Contiene",
			regex: "Regex",
		},
	},

	auth: {
		error: {
			title: "Errore di Autenticazione",
			errorCode: "Codice Errore: {{code}}",
			description: "Descrizione: {{description}}",
			uri: "URI:",
			tryAgain: "Per favore riprovi o contatti l'assistenza se il problema persiste.",

			signInFailedTitle: "Accesso non riuscito",
			signInFailedGeneric: "Non è stato possibile completare il tentativo di accesso. Riprova.",
			missingIdToken: "Il provider di identità non ha restituito un token ID.",
		},
	},

	dashboard: {
		header: {
			title: "Monitor Uptime",
			cta: "Crea Monitor",
			subscribe: "I suoi monitor sono in pausa. Si abboni per continuare il monitoraggio",
		},

		monitor: {
			stats: {
				title: "Statistiche",
				uptime: "Uptime",
				totalChecks: "Controlli Totali",
				lastCheck: "Ultimo Controllo",
				neverRan: "N/D",
			},

			actions: {
				refresh: "Aggiorna",
				delete: {
					confirm: "È sicuro di voler eliminare questo monitor?",
					cta: "Elimina Monitor",
				},
			},
		},
	},

	createMonitor: {
		title: "Crea un Nuovo Monitor",
		fields: {
			name: {
				label: "Nome Monitor",
				placeholder: "Pagina di Atterraggio",
				description: "Un nome descrittivo per il suo monitor.",
			},
			url: {
				label: "URL da Monitorare",
				placeholder: "https://example.com/healthcheck",
				description: "L'URL del servizio che desidera monitorare.",
			},
			method: {
				label: "Metodo di Richiesta",
				placeholder: "HEAD",
				description: "Il metodo HTTP da utilizzare per la richiesta.",
			},
			status: {
				label: "Codice di Stato Atteso",
				placeholder: "200",
				description: "Il codice di stato HTTP che si aspetta di ricevere.",
			},
			interval: {
				label: "Intervallo di Controllo",
				placeholder: "60",
				description: "Intervallo in secondi. Il minimo è 60 secondi.",
			},
			visibility: {
				label: "Visibilità",
				description: "I monitor pubblici possono essere condivisi con chiunque.",
				options: { public: "Pubblico", private: "Privato" },
			},
			region: {
				label: "Regione",
				description: "La regione da cui verrà eseguito il ping.",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} Africa",
					apac: "{{emoji}} Asia-Pacifico",
					eeur: "{{emoji}} Europa Orientale",
					enam: "{{emoji}} Nord America Orientale",
					me: "{{emoji}} Medio Oriente",
					oc: "{{emoji}} Oceania",
					sam: "{{emoji}} Sud America",
					weur: "{{emoji}} Europa Occidentale",
					wnam: "{{emoji}} Nord America Occidentale",
				},
			},
		},
		cta: "Crea Monitor",
	},

	toasts: {
		refreshMonitor: {
			pending: "Ping di {{name}} in corso...",
			success: "Il ping di {{name}} è terminato.",
			failure: "Ops! Qualcosa è andato storto durante l'esecuzione del monitor.",
		},

		deleteMonitor: {
			success: "{{name}} è stato eliminato.",
			failure: "Non siamo riusciti a eliminare {{name}}. Per favore riprovi.",
		},

		createMonitor: {
			pending: "Creazione del monitor {{name}}...",
			success: "{{name}} è stato creato.",
			failure: "Non siamo riusciti a creare {{name}}. Per favore riprovi.",
		},
	},

	emails: {
		teamInvite: {
			subject: "È stato invitato a unirsi a {{team}} su Uptime",
			preview: "Si unisca a {{team}} su Uptime",
			heading: "È stato invitato a unirsi a {{team}}",
			body: "{{team}} usa Uptime per tenere d'occhio i propri servizi. Accetti l'invito per unirsi al team.",
			action: "Accetta invito",
			footer:
				"Ha ricevuto questa email perché qualcuno L'ha invitata nel suo team su Uptime. Se non se lo aspettava, può ignorare questo messaggio.",
		},

		alert: {
			subject: "[Avviso Uptime] {{monitor}} è {{status}}",
			preview: "{{monitor}} è {{status}}",
			heading: "{{monitor}} è {{status}}",
			field: "{{label}}: {{value}}",
			action: "Apri la dashboard",
			incident:
				"Notifiche per questo incidente: {{sent}} inviate, {{suppressed}} soppresse dal periodo di attesa e dal limite di {{cap}} per incidente.",
			footer:
				"Ha ricevuto questa email perché uno degli avvisi del suo team corrisponde a questo evento.",

			status: {
				up: "RIPRISTINATO",
				down: "NON ATTIVO",
				degraded: "DEGRADATO",
			},

			fields: {
				monitor: "Monitor",
				status: "Stato",
				time: "Ora",
				url: "URL",
				responseStatus: "Stato della risposta",
				responseTime: "Tempo di risposta",
				domain: "Dominio",
				resolvedValue: "Valore risolto",
				endpoint: "Endpoint",
				schedule: "Pianificazione",
				lastPing: "Ultimo ping",
				nextExpected: "Prossimo previsto",
				hostname: "Hostname",
				expiresAt: "Scade il",
			},

			values: {
				none: "—",
				never: "mai",
				monitor: "{{name}} ({{type}})",
				responseStatus: "{{actual}} (previsto {{expected}})",
				milliseconds: "{{value}}ms",
				domain: "{{domain}} ({{recordType}})",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}} ({{timezone}})",
			},
		},
	},

	components: {
		heatmap: {
			tooltip: "{{date}}\n{{successRate}} tasso di successo\n{{checks}} controlli",
			legend: {
				success: "Successo",
				failure: "Fallimento",
				mixed: "Misto",
				noData: "Nessun dato",
			},
		},
		copyButton: {
			label: "Copia",
			copied: "Copiato!",
		},
	},

	cron: {
		error: {
			empty: "Inserisca un'espressione cron.",
			"field-count":
				"Un'espressione cron richiede esattamente cinque campi: minuto, ora, giorno del mese, mese e giorno della settimana.",
			"seconds-not-supported":
				"I secondi non sono supportati. Usi il formato a cinque campi, iniziando dal minuto.",
			"unknown-macro":
				"Questa abbreviazione non è supportata. Usi @hourly, @daily, @weekly, @monthly o @yearly.",
			syntax: "Uno dei campi non è un valore, un intervallo, un elenco o un passo.",
			"unknown-name":
				"Uno dei nomi di mese o di giorno non è riconosciuto. Usi abbreviazioni di tre lettere come JAN o MON.",
			"out-of-range": "Uno dei valori è fuori dall'intervallo consentito per il suo campo.",
			"reversed-range": "Uno degli intervalli inizia dopo la sua fine.",
			"invalid-step": "Un passo deve essere un numero intero maggiore di zero.",
			"impossible-date": "Quel giorno del mese non esiste nel mese a cui è abbinato.",
		},
	},

	schedule: {
		interval: {
			minute_one: "Ogni minuto",
			minute_other: "Ogni {{count}} minuti",
			hour_one: "Ogni ora",
			hour_other: "Ogni {{count}} ore",
		},
		hourly: {
			onTheHour: "Ogni ora",
			atMinutes: "Ogni ora al minuto {{minutes}}",
		},
		daily: "Ogni giorno alle {{times}}",
		weekly: "Ogni {{days}} alle {{times}}",
		monthly: "Ogni mese il giorno {{days}} alle {{times}}",
		yearly: "Ogni anno il {{days}} {{months}} alle {{times}}",
		expression: "Pianificazione personalizzata ({{expression}})",
	},

	actions: {
		addDomain: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito aggiungere domini a questo team.",
				alreadyExists: "{{hostname}} è stato aggiunto il {{verifiedAt}}.",
			},

			success: {
				accepted: "{{hostname}} è ancora in attesa di verifica.",
				created: "{{hostname}} è stato aggiunto a {{team}}. La verifica è in sospeso.",
			},
		},

		changeRole: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito cambiare i ruoli in questo team.",
				cannotChangeOwner: "Non può cambiare il ruolo del proprietario del team.",
			},

			success: "Il ruolo di {{name}} è stato cambiato in {{role}} in {{team}}.",
		},

		createAlert: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito creare avvisi in questo team.",
				limitExceeded: "Ha raggiunto il limite di {{limit}} avvisi in questo team.",
			},
			success: { created: "L'avviso {{name}} è stato creato." },
		},

		createInvite: {
			email: {
				subject: "È stato invitato a unirsi a {{team}} su Uptime",
			},

			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito invitare membri in questo team.",
				alreadyAccepted: "C'è già un membro di {{team}} con questa email.",
			},

			success: "{{email}} è stato invitato a unirsi a {{team}}.",
		},

		createMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
			},

			success: "Il monitor {{name}} è stato creato.",
		},

		updateMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor non esiste.",
			},

			success: "Il monitor {{name}} è stato aggiornato.",
		},

		updateSsl: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor non esiste.",
			},

			success: "Le impostazioni SSL per {{name}} sono state aggiornate.",
		},

		deleteMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito eliminare monitor in questo team.",
				notFound: "Questo monitor non esiste.",
			},
			success: "Il monitor {{name}} è stato eliminato.",
		},

		playMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor non esiste.",
			},

			pending: "Ping di {{name}} in corso...",
			success: "Il ping di {{name}} è terminato.",
			failure: "Ops! Qualcosa è andato storto durante l'esecuzione del monitor.",
		},

		removeAlert: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				forbidden: "Non Le è consentito rimuovere avvisi in questo team.",
				notFound: "{{name}} non esiste.",
			},
			success: "L'avviso {{name}} è stato rimosso.",
		},

		removeDomain: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito rimuovere domini da questo team.",
				notFound: "{{hostname}} non esiste.",
			},

			success: "{{hostname}} è stato rimosso da {{team}}.",
		},

		removeMember: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito rimuovere membri da questo team.",
				cannotRemoveOwner: "Non può rimuovere il proprietario del team.",
			},

			success: "{{name}} è stato rimosso da {{team}}.",
		},

		retryDomainVerification: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito riprovare la verifica del dominio in questo team.",
				notFound: "{{hostname}} non esiste.",
				workflowFailed:
					"Il processo di verifica non è riuscito ad avviarsi per {{hostname}}. Riprovi più tardi.",
			},

			success: {
				alreadyVerified: "{{hostname}} è già verificato.",
				requested: "È stato richiesto un nuovo tentativo di verifica per {{hostname}}.",
			},
		},

		revokeInvite: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notAllowed: "Non Le è consentito revocare inviti in questo team.",
				notFound: "Questo invito non esiste.",
				alreadyAccepted: "Questo invito è già stato accettato dall'invitato.",
			},

			success: "L'invito di {{email}} è stato revocato da {{team}}.",
		},

		updateTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				forbidden: "Non Le è consentito aggiornare le impostazioni del team.",
			},

			success: {
				updated: "Le impostazioni del team sono state aggiornate con successo.",
			},
		},

		deleteTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'eliminazione del team.",
				forbidden: "Solo il proprietario del team può eliminare il team.",
				confirmationRequired: "Per favore digiti DELETE per confermare.",
			},

			success: "{{team}} è stato eliminato.",
		},

		leaveTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notMember: "Non è un membro di questo team.",
				ownerCannotLeave:
					"I proprietari del team non possono abbandonare il loro team. Prima trasferisca la proprietà.",
				adminCannotLeave:
					"Gli amministratori non possono abbandonare il team. Chieda al proprietario di declassarLa prima.",
			},

			success: "Ha abbandonato {{team}}.",
		},

		createStatusPage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				slugTaken: "Questo slug è già in uso.",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa pagina di stato non esiste.",
				slugTaken: "Questo slug è già in uso.",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa pagina di stato non esiste.",
			},

			success: "La pagina di stato è stata eliminata.",
		},

		createMaintenance: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				invalidDates: "L'ora di fine deve essere successiva all'ora di inizio.",
			},

			success: {
				created: "La finestra di manutenzione '{{name}}' è stata creata.",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa finestra di manutenzione non esiste.",
				forbidden: "Non Le è consentito eliminare questa finestra di manutenzione.",
			},

			success: "La finestra di manutenzione '{{name}}' è stata eliminata.",
		},

		endMaintenance: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questa finestra di manutenzione non esiste.",
				forbidden: "Non Le è consentito terminare questa finestra di manutenzione.",
			},

			success: "La finestra di manutenzione '{{name}}' è stata terminata anticipatamente.",
		},

		createTeam: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante la creazione del team.",
			},

			success: {
				created: "Il team {{name}} è stato creato con successo.",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				limitExceeded: "Ha raggiunto il limite di {{limit}} monitor DNS in questo team.",
			},

			success: {
				created: "Il monitor DNS {{name}} è stato creato.",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor DNS non esiste.",
				forbidden: "Non Le è consentito aggiornare questo monitor DNS.",
			},

			success: "Il monitor DNS {{name}} è stato aggiornato.",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor DNS non esiste.",
				forbidden: "Non Le è consentito eliminare questo monitor DNS.",
			},

			success: "Il monitor DNS {{name}} è stato eliminato.",
		},

		checkDnsMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo monitor DNS non esiste.",
				forbidden: "Non Le è consentito controllare questo monitor DNS.",
			},

			success: "Il controllo DNS per {{name}} è stato completato.",
		},

		createTcpMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante la creazione del monitor TCP.",
			},
			success: "Il monitor TCP {{name}} è stato creato.",
		},

		updateTcpMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'aggiornamento del monitor TCP.",
				notFound: "Questo monitor TCP non esiste.",
			},
			success: "Il monitor TCP {{name}} è stato aggiornato.",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'eliminazione del monitor TCP.",
				notAllowed: "Non Le è consentito eliminare monitor TCP in questo team.",
				notFound: "Questo monitor TCP non esiste.",
			},
			success: "Il monitor TCP {{name}} è stato eliminato.",
		},

		createApiKey: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante la creazione della chiave API.",
				limitExceeded: "Ha raggiunto il limite di {{limit}} chiavi API in questo team.",
			},
			success: {
				created: "La chiave API '{{name}}' è stata creata.",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'eliminazione della chiave API.",
				notFound: "Questa chiave API non esiste.",
			},
			success: "La chiave API '{{name}}' è stata eliminata.",
		},

		updateLanguage: {
			errors: {
				generic: "Ops! Qualcosa è andato storto durante l'aggiornamento della preferenza lingua.",
			},
			success: "La preferenza lingua è stata aggiornata con successo.",
		},

		createCronJob: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				limitExceeded: "Ha raggiunto il limite di {{limit}} cron job in questo team.",
			},
			success: "Il cron job '{{name}}' è stato creato.",
		},

		updateCronJob: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo cron job non esiste.",
			},
			success: "Il cron job '{{name}}' è stato aggiornato.",
		},

		deleteCronJob: {
			errors: {
				generic: "Ops! Qualcosa è andato storto.",
				notFound: "Questo cron job non esiste.",
				forbidden: "Non Le è consentito eliminare questo cron job.",
			},
			success: "Il cron job '{{name}}' è stato eliminato.",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "Dashboard",
				action: {
					create: "Crea Monitor",
					refresh: "Aggiorna",
				},
			},

			quickPing: {
				title: "Controllo rapido",
				description:
					"Controlli qualsiasi URL una volta, subito. Nulla viene salvato e nessun avviso viene inviato — conta come un ping.",
				field: {
					label: "URL",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "Esegui Controllo",
				},
				result: {
					noResponse: "Nessuna risposta",
					status: {
						up: "Attivo",
						degraded: "Degradato",
						down: "Non Funzionante",
					},
				},
				error: {
					invalidUrl: "Inserisca un URL completo con http:// o https://.",
					subscriptionRequired: "È richiesto un abbonamento attivo per eseguire un controllo.",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			empty: {
				title: "Nessun monitor ancora",
				description: "Crei il suo primo monitor per iniziare a tracciare i suoi servizi.",
				cta: "Crea Monitor",
			},

			stats: {
				monitors: {
					label: "Utilizzo Ping Mensile",
					value: "{{consumed}}<small> utilizzati</small>",
					description: "Su {{estimated}} stimati",
					unavailable: "Stima non disponibile",
				},

				uptime: {
					label: "Percentuale Uptime",
					description: "Uptime complessivo del sistema",
				},

				httpMonitors: {
					label: "Monitor HTTP",
					description: "{{up}} attivi / {{down}} non funzionanti",
				},
				dnsMonitors: {
					label: "Monitor DNS",
					description: "{{ok}} ok / {{changed}} cambiati / {{error}} errore",
				},
				tcpMonitors: {
					label: "Monitor TCP",
					description: "{{up}} attivi / {{down}} non funzionanti",
				},
				cronJobs: {
					label: "Cron Job",
					description: "{{healthy}} sani / {{late}} in ritardo / {{missed}} mancati",
				},

				slowestEndpoint: {
					label: {
						default: 'Endpoint più lento "<em>{{name}}</em>"',
						noData: "Endpoint più lento",
					},
					value: { noData: "N/D" },
					description: "Nelle ultime 24 ore",
				},

				sslMonitors: {
					label: "Monitor SSL",
					description: "{{valid}} validi, {{expiring}} in scadenza, {{expired}} scaduti",
				},
			},

			tabs: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cronJobs: "Cron Job",
			},

			loading: "Caricamento…",

			panel: {
				tabsLabel: "Tipo di monitor",
				tabPanelLabel: "Monitor {{tab}}",
				refresh: "Aggiorna",
			},

			error: {
				card: {
					label: "Errore",
					value: "-",
					description: "Impossibile caricare i dati",
				},
				table: {
					message: "Impossibile caricare i monitor. Si prega di riprovare.",
				},
				analytics: {
					message:
						"I dati di analisi sono temporaneamente non disponibili. Si prega di riprovare più tardi.",
				},
			},

			table: {
				label: "Monitor",

				columns: {
					name: "Nome",
					latencyChart: "Trend Latenza",
					status: "Stato",
					lastIncident: "Ultimo Incidente",
					responseTime: "Latenza Media",
					actions: "Azioni",
				},

				status: {
					up: "Attivo e Funzionante",
					down: "Non Attivo",
					degraded: "Degradato",
					unknown: "Nessun Dato",
				},

				lastIncident: { never: "-" },
				responseTime: "~{{value}}",

				actions: {
					menu: "Menu Azioni",
					edit: "Modifica Monitor",
					delete: "Elimina Monitor",
					play: "Esegui Monitor",
				},

				confirmation: {
					deleteMonitor:
						"È sicuro di voler eliminare il monitor {{name}}? Questa azione non può essere annullata.",
				},
			},
		},

		monitors: {
			header: {
				title: "Monitor Uptime",
				cta: "Crea Monitor",
				subscribe: "I suoi monitor sono in pausa. Si abboni per continuare il monitoraggio",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},
		},

		createMonitor: {
			header: {
				title: "Crea Monitor",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Pagina di Atterraggio",
						description: "Un nome descrittivo per il suo monitor.",
					},
					url: {
						label: "URL da Monitorare",
						placeholder: "https://example.com/healthcheck",
						description: "L'URL del servizio che desidera monitorare.",
					},
					method: {
						label: "Metodo di Richiesta",
						placeholder: "HEAD",
						description: "Il metodo HTTP da utilizzare per la richiesta.",
					},
					status: {
						label: "Codice di Stato Atteso",
						placeholder: "200",
						description: "Il codice di stato HTTP che si aspetta di ricevere.",
					},
					interval: {
						label: "Intervallo di Controllo",
						placeholder: "60",
						description: "Intervallo in secondi. Il minimo è 60 secondi.",
					},
					visibility: {
						label: "Visibilità",
						description: "I monitor pubblici possono essere condivisi con chiunque.",
						options: { public: "Pubblico", private: "Privato" },
					},
					region: {
						label: "Regione",
						description: "La regione da cui verrà eseguito il ping.",
						placeholder: "Seleziona una regione",
						options: {
							afr: "{{emoji}} Africa",
							apac: "{{emoji}} Asia-Pacifico",
							eeur: "{{emoji}} Europa Orientale",
							enam: "{{emoji}} Nord America Orientale",
							me: "{{emoji}} Medio Oriente",
							oc: "{{emoji}} Oceania",
							sam: "{{emoji}} Sud America",
							weur: "{{emoji}} Europa Occidentale",
							wnam: "{{emoji}} Nord America Occidentale",
						},
					},
				},

				cta: "Crea Monitor",
			},
		},

		editMonitor: {
			header: {
				title: "Modifica Monitor",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Pagina di Atterraggio",
						description: "Un nome descrittivo per il suo monitor.",
					},
					url: {
						label: "URL da Monitorare",
						placeholder: "https://example.com/healthcheck",
						description: "L'URL del servizio che desidera monitorare.",
					},
					method: {
						label: "Metodo di Richiesta",
						placeholder: "HEAD",
						description: "Il metodo HTTP da utilizzare per la richiesta.",
					},
					status: {
						label: "Codice di Stato Atteso",
						placeholder: "200",
						description: "Il codice di stato HTTP che si aspetta di ricevere.",
					},
					interval: {
						label: "Intervallo di Controllo",
						placeholder: "60",
						description: "Intervallo in secondi. Il minimo è 60 secondi.",
					},
					visibility: {
						label: "Visibilità",
						description: "I monitor pubblici possono essere condivisi con chiunque.",
						options: { public: "Pubblico", private: "Privato" },
					},
					region: {
						label: "Regione",
						description: "La regione da cui verrà eseguito il ping.",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} Africa",
							apac: "{{emoji}} Asia-Pacifico",
							eeur: "{{emoji}} Europa Orientale",
							enam: "{{emoji}} Nord America Orientale",
							me: "{{emoji}} Medio Oriente",
							oc: "{{emoji}} Oceania",
							sam: "{{emoji}} Sud America",
							weur: "{{emoji}} Europa Occidentale",
							wnam: "{{emoji}} Nord America Occidentale",
						},
					},
					ssl: {
						enabled: {
							label: "Abilita Monitoraggio SSL",
							description:
								"Monitora la scadenza del certificato SSL e riceva avvisi prima che scada.",
						},
						expiresAt: {
							label: "Data Scadenza Certificato",
							placeholder: "Seleziona data scadenza",
							description:
								"Inserisca la data di scadenza del suo certificato SSL. Può trovarla nella dashboard del suo provider di hosting o controllando i dettagli del certificato nel suo browser.",
						},
						issuer: {
							label: "Emittente Certificato",
							placeholder: "Let's Encrypt, DigiCert, ecc.",
							description:
								"L'Autorità di Certificazione che ha emesso il suo certificato SSL (opzionale).",
						},
						warningDays: {
							label: "Avviso Prima della Scadenza",
							description:
								"Riceva avvisi questo numero di giorni prima della scadenza del certificato.",
						},
					},
				},

				cancel: "Annulla",
				cta: "Salva Modifiche",
			},

			ssl: {
				title: "Monitoraggio certificato SSL",
				cta: "Salva impostazioni SSL",
			},

			dangerZone: {
				title: "Zona pericolosa",
				delete: "Elimina monitor",
			},
		},

		monitor: {
			header: {
				title: 'Monitor "{{name}}"',

				action: {
					play: "Esegui Monitor",
					running: "Esecuzione in corso…",
					edit: "Modifica Monitor",
					refresh: "Aggiorna",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			stats: {
				monitors: {
					label: "Utilizzo Ping Mensile",
					value: "{{consumed}}<small> utilizzati</small>",
					description: "Su {{estimated}} stimati",
					estimateUnavailable: "Stima non disponibile",
				},

				uptime: {
					label: "Percentuale Uptime",
					description: "Uptime complessivo del monitor",
				},

				slowestResult: {
					label: "Risultato più Lento",
					description: "Nelle ultime 24 ore",
				},

				p99ResponseTime: {
					label: "Tempo di Risposta P99",
					value: "{{value}} ms",
					description: "p99, ultime 24 h",
				},
			},

			heatmap: {
				tooltip: "{{date}}\n{{successRate}} tasso di successo\n{{checks}} controlli",
				legend: {
					success: "Successo",
					failure: "Fallimento",
					mixed: "Misto",
					noData: "Nessun dato",
				},
			},

			ssl: {
				title: "Certificato SSL",
				status: {
					valid: "Valido",
					expiring: "In Scadenza",
					expired: "Scaduto",
					error: "Errore",
					unknown: "Non Configurato",
				},
				expiresAt: "Scade",
				expiresIn: "{{days}} giorni",
				issuer: "Emittente",
				lastChecked: "Ultimo Controllo",
				notConfigured: "Il monitoraggio SSL non è abilitato per questo monitor.",
				configure: "Configura Monitoraggio SSL",
			},
		},

		billing: {
			header: {
				title: "Fatturazione",
			},
			ownerOnly:
				"Solo il proprietario del team può visualizzare e gestire la fatturazione di questo team.",
		},

		members: {
			header: {
				title: "Membri del Team",

				action: {
					invite: "Invita Membro",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			sections: {
				members: {
					title: "Membri",
					description: "Gestisca i membri del suo team e i loro ruoli.",
				},
			},

			membersTable: {
				label: "Membri Attuali",
				description: "Persone che hanno accesso a questo team.",

				columns: {
					name: "Nome",
					role: "Ruolo nel Team",
					actions: "Azioni",
				},

				role: {
					member: "Membro",
					admin: "Amministratore",
					owner: "Proprietario",
				},

				actions: {
					menu: "Menu Azioni",
					remove: "Rimuovi dal Team",
					transfer: "Trasferisci Proprietà",
					changeRole: {
						member: "Converti in Amministratore",
						admin: "Converti in Membro",
						owner: "Non può cambiare il proprietario",
					},
				},

				confirmation: {
					removeMember: "È sicuro di voler rimuovere {{name}} dal team?",
				},
			},

			invitedMembersTable: {
				label: "Inviti in Sospeso",
				description: "Persone che sono state invitate ma non si sono ancora unite.",

				columns: {
					email: "Email",
					actions: "Azioni",
				},

				actions: {
					menu: "Menu Azioni",
					copy: "Copia Link Invito",
					revoke: "Revoca Invito",
				},

				confirmation: {
					revokeInvite: "È sicuro di voler revocare l'invito di {{email}}?",
				},
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},

		invite: {
			header: {
				title: "Invita Membro del Team",
				description: "Invia un invito per unirsi al suo team.",
			},

			dialog: {
				close: "Chiudi finestra",
			},

			form: {
				fields: {
					email: {
						label: "Indirizzo Email",
						placeholder: "mario.rossi@example.com",
						description: "L'indirizzo email della persona che desidera invitare a {{team}}.",
					},
				},

				cancel: "Annulla",
				cta: "Invita Membro",
			},
		},

		acceptInvite: {
			errors: {
				pageTitle: "Invito non disponibile",
				notFound: "Questo invito non esiste.",
				gone: "Questo invito è già stato accettato.",
				forbidden: "Questo invito non era destinato a Lei.",
				badRequest: "In qualche modo non ha un indirizzo email. Provi ad accedere di nuovo.",
				wrongEmail:
					"Questo invito è stato inviato a {{email}}. Accedi con quell'indirizzo email per accettarlo.",
			},
		},

		domains: {
			header: {
				title: "Domini del Team",
				action: { addDomain: "Aggiungi Dominio" },
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			sections: {
				domains: {
					title: "Domini",
					description: "Gestisca i domini verificati per il suo team.",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "Dominio",
						placeholder: "example.com",
						description: "Il dominio che desidera aggiungere a {{team}}.",
					},
				},

				cta: "Aggiungi Dominio",
			},

			table: {
				label: "Domini Verificati",
				description:
					"Domini che possono essere utilizzati per il provisioning automatico dei membri del team.",

				columns: {
					hostname: "Hostname",
					id: "ID Verifica",
					verifiedAt: "Verificato Il",
					actions: "Azioni",
				},

				verifiedAt: {
					pending: "In attesa di verifica",
				},

				actions: {
					menu: "Menu Azioni",
					copy: "Copia ID Verifica",
					remove: "Rimuovi Dominio",
					retryVerification: "Riprova Verifica",
				},

				confirmation: {
					removeDomain: "È sicuro di voler rimuovere {{hostname}} dal team?",
				},
			},

			instructions: {
				title: "Come verificare il suo dominio",

				description:
					"Per verificare il suo dominio, aggiunga il seguente record `TXT` alle sue impostazioni DNS:",

				record: {
					name: {
						label: "Nome",
						value: "_ping-verification",
					},
					content: {
						label: "Contenuto",
						value: "VERIFICATION_ID",
					},
				},

				note: "Assicurati di sostituire <code>VERIFICATION_ID</code> con l'ID di verifica effettivo mostrato sopra.",

				disclaimer:
					"Le modifiche DNS potrebbero richiedere del tempo per propagarsi, quindi la verifica potrebbe essere ritardata.",
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},

		alerts: {
			header: {
				title: "Avvisi",

				action: {
					create: "Crea Avviso",
					history: "Visualizza Cronologia",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			empty: {
				title: "Nessun avviso configurato",
				description: "Crei un avviso per essere notificato quando i suoi monitor vanno offline.",
				cta: "Crea Avviso",
			},

			limitReached: "Questo team ha raggiunto il limite di {{limit}} avvisi.",

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Avviso CTO",
						description: "Un nome per identificare l'avviso.",
					},

					scope: {
						label: "Ambito",
						teamWide: "Intero team (tutti i monitor)",
					},

					channel: {
						label: "Canale",
						description: "Il canale da utilizzare per l'avviso.",
						options: {
							webhook: "Webhook",
							email: "Email",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL",
								placeholder: "https://example.com/webhook",
								description: "L'URL a cui inviare il payload dell'avviso.",
							},
							secret: {
								label: "Segreto di firma (opzionale)",
								placeholder: "segreto-opzionale",
								description:
									"Un segreto opzionale da includere negli header della richiesta. Verrà aggiunto un header `Webhook-Signature` con una firma HMAC SHA256 del payload usando questo segreto.",
							},
							signatureNote:
								"Se impostato, le richieste includono un header <code>Webhook-Signature: sha256=<hex></code> — un HMAC-SHA256 del corpo JSON grezzo utilizzando questo segreto.",
						},
						email: {
							to: {
								label: "Destinatario",
								placeholder: "cto@example.com",
								description: "L'indirizzo email a cui inviare l'avviso.",
							},

							subjectPrefix: {
								label: "Prefisso oggetto (opzionale)",
								placeholder: "[Avviso Uptime]",
								description:
									"Un prefisso opzionale da aggiungere all'oggetto dell'email. Utile per filtrare gli avvisi nella sua casella di posta.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL Webhook",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"L'URL Webhook in Entrata di Slack. Creane uno su api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Override canale (opzionale)",
								placeholder: "#avvisi",
								description:
									"Canale opzionale in cui pubblicare invece del predefinito del webhook. Includa il prefisso #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL Webhook",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"L'URL Webhook di Discord. Creane uno in Impostazioni Server > Integrazioni > Webhook.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notifica al ripristino",
						description:
							"Invia un avviso quando il monitor si riprende da uno stato non attivo. Include tempo di ripristino e durata del disservizio.",
					},

					cooldown: {
						label: "Cooldown Avviso",
						description:
							"Tempo minimo tra avvisi dello stesso tipo. Previene l'affaticamento da avvisi durante interruzioni prolungate.",
						options: {
							none: "Nessun cooldown",
							"5min": "5 minuti",
							"15min": "15 minuti",
							"30min": "30 minuti",
							"1hour": "1 ora",
							"2hours": "2 ore",
							custom: "Personalizzato",
						},
						custom: {
							label: "Cooldown Personalizzato (minuti)",
							placeholder: "Inserisci minuti",
							description: "Inserisca il numero di minuti tra gli avvisi.",
						},
					},

					cooldownMinutes: {
						label: "Cooldown (minuti, 0 = nessun cooldown)",
					},

					legends: {
						email: "Impostazioni email",
						webhook: "Impostazioni webhook",
						slack: "Impostazioni Slack",
						discord: "Impostazioni Discord",
					},
				},

				cta: "Crea Avviso",
			},

			table: {
				label: "Avvisi",

				columns: {
					name: "Nome",
					scope: "Ambito",
					strategy: "Tipo",
					notifyOnRecovery: "Ripristino",
					cooldown: "Cooldown",
					actions: "Azioni",
				},

				scope: {
					unknownMonitor: "Monitor sconosciuto",
					teamWide: "Intero team",
				},

				cooldown: {
					none: "Nessuno",
					minutes: "{{count}} min",
					hours: "{{count}} ore",
				},

				actions: {
					menu: "Menu Azioni",
					edit: "Modifica Avviso",
					remove: "Rimuovi Avviso",
				},

				types: {
					webhook: "Webhook",
					email: "Email",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "Sì",
					disabled: "No",
				},

				confirmation: {
					deleteAlert: "È sicuro di voler eliminare l'avviso {{name}}?",
				},
			},
		},

		statusPages: {
			header: {
				title: "Pagine di Stato",

				action: {
					create: "Crea Pagina di Stato",
				},
			},

			empty: {
				title: "Nessuna pagina di stato ancora",
				description:
					"Crei una pagina di stato per condividere lo stato del suo sistema con i suoi utenti.",
				cta: "Crea Pagina di Stato",
			},

			table: {
				label: "Pagine di Stato",

				columns: {
					name: "Nome",
					slug: "URL",
					services: "Servizi",
					monitors: "Monitor",
					visibility: "Visibilità",
					actions: "Azioni",
				},

				visibility: {
					public: "Pubblica",
					private: "Privata",
				},

				actions: {
					menu: "Menu Azioni",
					view: "Visualizza Pagina",
					edit: "Modifica Pagina",
					delete: "Elimina Pagina",
				},

				confirmation: {
					delete: "È sicuro di voler eliminare la pagina di stato {{name}}?",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Interno",
						placeholder: "Stato Produzione",
						description: "Un nome per identificare la pagina di stato internamente.",
					},
					slug: {
						label: "Slug URL",
						placeholder: "produzione",
						description:
							"Il percorso URL per la pagina di stato pubblica (es. /status/produzione).",
					},
					title: {
						label: "Titolo Pubblico",
						placeholder: "Stato Acme Inc.",
						description: "Il titolo visualizzato sulla pagina di stato pubblica.",
					},
					description: {
						label: "Descrizione",
						placeholder: "Stato attuale dei servizi di Acme Inc.",
						description: "Una descrizione opzionale per la pagina di stato.",
					},
					logoUrl: {
						label: "URL Logo",
						placeholder: "https://example.com/logo.png",
						description: "Un logo opzionale da visualizzare sulla pagina di stato.",
					},
					isPublic: {
						label: "Pubblica",
						description: "Renda questa pagina di stato accessibile a chiunque abbia il link.",
					},
					showOverallStatus: {
						label: "Mostra Stato Generale",
						description: "Visualizza un banner di stato generale del sistema in cima alla pagina.",
					},
					monitors: {
						label: "Monitor da Includere",
						description: "Selezioni quali monitor visualizzare su questa pagina di stato.",
					},
				},

				cta: "Crea Pagina di Stato",
				ctaUpdate: "Salva Modifiche",
			},
		},

		createStatusPage: {
			header: {
				title: "Crea Pagina di Stato",
			},
		},

		editStatusPage: {
			header: {
				title: "Modifica Pagina di Stato",
			},
		},

		httpMonitors: {
			header: {
				title: "Monitor HTTP",
				action: {
					create: "Crea Monitor",
				},
			},
			empty: {
				title: "Nessun monitor HTTP",
				description: "Crea un monitor HTTP per iniziare a monitorare i tuoi endpoint.",
				cta: "Crea Monitor",
			},
			table: {
				label: "Monitor HTTP",
				columns: {
					name: "Nome",
					url: "URL",
					status: "Stato",
					responseTime: "Tempo di Risposta",
					lastChecked: "Ultimo Controllo",
					actions: "Azioni",
				},
				neverChecked: "Mai",
				disabled: "Disabilitato",
				actions: {
					menu: "Menu Azioni",
					view: "Visualizza",
					edit: "Modifica",
					delete: "Elimina",
				},
				status: {
					up: "Attivo",
					down: "Non Funzionante",
					degraded: "Degradato",
					unknown: "Sconosciuto",
				},
				confirmation: {
					delete: "Sei sicuro di voler eliminare il monitor {{name}}?",
					deleteDescription:
						"Questo eliminerà anche i controlli sui contenuti e la cronologia dei risultati. Questa azione non può essere annullata.",
				},
			},
		},

		dnsMonitors: {
			header: {
				title: "Monitor DNS",

				action: {
					create: "Crea Monitor DNS",
				},
			},

			empty: {
				title: "Nessun monitor DNS ancora",
				description: "Crei un monitor DNS per tracciare le modifiche ai record DNS.",
				cta: "Crea Monitor DNS",
			},

			table: {
				label: "Monitor DNS",

				columns: {
					name: "Nome",
					domain: "Dominio",
					recordType: "Tipo",
					status: "Stato",
					lastChecked: "Ultimo Controllo",
					actions: "Azioni",
				},

				disabled: "Disabilitato",
				neverChecked: "Mai",
				notChecked: "Non controllato",

				actions: {
					menu: "Menu Azioni",
					check: "Controlla Ora",
					edit: "Modifica",
					delete: "Elimina",
				},

				confirmation: {
					delete: "È sicuro di voler eliminare il monitor DNS {{name}}?",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "Crea Monitor DNS",
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "DNS Produzione",
						description: "Un nome descrittivo per questo monitor DNS.",
					},

					domain: {
						label: "Dominio",
						placeholder: "example.com",
						description: "Il dominio per cui monitorare i record DNS.",
					},

					recordType: {
						label: "Tipo Record",
						description: "Il tipo di record DNS da controllare.",
					},

					expectedValue: {
						label: "Valore Atteso",
						placeholder: "192.168.1.1",
						description:
							"Opzionale. Avvisa se il valore risolto non corrisponde. Lascia vuoto per tracciare le modifiche.",
					},

					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare il record DNS.",
						options: {
							"5m": "5 minuti",
							"15m": "15 minuti",
							"30m": "30 minuti",
							"1h": "1 ora",
							"6h": "6 ore",
							"12h": "12 ore",
							"24h": "24 ore",
						},
					},

					isEnabled: {
						label: "Abilita monitoraggio",
						description: "Inizia a monitorare questo record DNS immediatamente.",
					},
				},

				cta: "Crea Monitor DNS",
			},
		},

		editDnsMonitor: {
			header: {
				title: "Modifica Monitor DNS",
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "DNS Produzione",
						description: "Un nome descrittivo per questo monitor DNS.",
					},

					domain: {
						label: "Dominio",
						placeholder: "example.com",
						description: "Il dominio per cui monitorare i record DNS.",
					},

					recordType: {
						label: "Tipo Record",
						description: "Il tipo di record DNS da controllare.",
					},

					expectedValue: {
						label: "Valore Atteso",
						placeholder: "192.168.1.1",
						description:
							"Opzionale. Avvisa se il valore risolto non corrisponde. Lascia vuoto per tracciare le modifiche.",
					},

					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare il record DNS.",
						options: {
							"5m": "5 minuti",
							"15m": "15 minuti",
							"30m": "30 minuti",
							"1h": "1 ora",
							"6h": "6 ore",
							"12h": "12 ore",
							"24h": "24 ore",
						},
					},

					isEnabled: {
						label: "Abilita monitoraggio",
						description: "Se monitorare attivamente questo record DNS.",
					},
				},

				cancel: "Annulla",
				cta: "Salva Modifiche",
			},

			dangerZone: {
				title: "Zona pericolosa",
				deleteMonitor: "Elimina monitor",
				deleteDescription:
					"Questo elimina anche la sua cronologia dei risultati di controllo. Questa azione non può essere annullata.",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: 'Monitor DNS "{{name}}"',

				action: {
					check: "Controlla Ora",
					refresh: "Aggiorna",
					edit: "Modifica",
				},
			},

			uptimeHistory: "Cronologia attività",
			notChecked: "Non controllato",

			info: {
				domain: "Dominio",
				recordType: "Tipo Record",
				status: "Stato",
				expectedValue: "Valore Atteso",
				currentValue: "Valore Attuale",
			},

			stats: {
				totalChecks: {
					label: "Controlli Totali",
					description: "Numero di controlli DNS eseguiti",
				},

				successRate: {
					label: "Tasso di Successo",
					description: "Percentuale di controlli riusciti",
				},

				avgResponseTime: {
					label: "Tempo di Risposta Medio",
					description: "Tempo medio di risoluzione DNS",
				},
			},

			results: {
				title: "Cronologia Controlli",
				empty: "Nessun controllo è stato ancora eseguito.",

				table: {
					columns: {
						checkedAt: "Controllato Il",
						status: "Stato",
						value: "Valore",
						responseTime: "Tempo di Risposta",
					},
				},
			},
		},

		maintenance: {
			header: {
				title: "Finestre di Manutenzione",

				action: {
					create: "Programma Manutenzione",
				},
			},

			empty: {
				title: "Nessuna finestra di manutenzione",
				description:
					"Programmi finestre di manutenzione per sopprimere gli avvisi durante i tempi di inattività pianificati.",
				cta: "Programma Manutenzione",
			},

			tabs: {
				label: "Stato Manutenzione",
				active: "Attiva",
				upcoming: "Programmata",
				past: "Passata",
			},

			noActive: "Nessuna finestra di manutenzione attiva",
			noUpcoming: "Nessuna finestra di manutenzione programmata",
			noPast: "Nessuna finestra di manutenzione passata",

			table: {
				columns: {
					name: "Nome",
					schedule: "Programmazione",
					monitor: "Monitor",
					status: "Stato",
					actions: "Azioni",
					scope: "Ambito",
					starts: "Inizio",
					ends: "Fine",
				},

				allMonitors: "Tutti i Monitor",
				recurring: "Ricorrente",
				unknownMonitor: "Monitor sconosciuto",
				endedEarly: "Terminata in anticipo",
				edit: "Modifica",

				status: {
					active: "Attiva",
					upcoming: "Programmata",
					past: "Completata",
				},

				actions: {
					menu: "Menu Azioni",
					end: "Termina Ora",
					delete: "Elimina",
				},

				confirmation: {
					endMaintenance: "È sicuro di voler terminare anticipatamente la manutenzione '{{name}}'?",
					deleteMaintenance: "È sicuro di voler eliminare '{{name}}'?",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "Programma Manutenzione",
			},

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Aggiornamento database",
						description: "Una descrizione del lavoro di manutenzione.",
					},

					monitor: {
						label: "Monitor",
						description: "Selezioni un monitor specifico o lasci vuoto per tutti i monitor.",
						all: "Tutti i Monitor",
					},

					startsAt: {
						label: "Ora di Inizio",
						description: "Quando inizia la finestra di manutenzione.",
					},

					duration: {
						label: "Durata",
						description: "Quanto dura la finestra di manutenzione.",
						options: {
							"15m": "15 minuti",
							"30m": "30 minuti",
							"1h": "1 ora",
							"2h": "2 ore",
							"4h": "4 ore",
							"8h": "8 ore",
						},
					},

					suppressAlerts: {
						label: "Sopprimi avvisi",
						description: "Non inviare avvisi durante questa finestra di manutenzione.",
					},

					showOnStatusPage: {
						label: "Mostra sulla pagina di stato",
						description: "Visualizza un avviso di manutenzione sulle pagine di stato pubbliche.",
					},

					isRecurring: {
						label: "Ricorrente",
						description: "Ripeti questa finestra di manutenzione secondo una programmazione.",
					},

					recurringPattern: {
						label: "Schema Ricorrente",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"Formato schema: 'daily:HH:MM-HH:MM', 'weekly:giornoSettimana:HH:MM-HH:MM', o 'monthly:giornoDelMese:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "Finestra di manutenzione",
				},

				cta: "Programma Manutenzione",
			},
		},

		editMaintenance: {
			header: {
				title: "Modifica {{name}}",
			},

			form: {
				cta: "Salva modifiche",
				cancel: "Annulla",
			},

			endNow: {
				cta: "Termina manutenzione ora",
			},

			danger: {
				title: "Zona pericolosa",

				delete: {
					trigger: "Elimina finestra di manutenzione",
					confirmTitle: "Eliminare questa finestra di manutenzione?",
					confirmDescription: "Questa azione non può essere annullata.",
					confirm: "Elimina",
				},
			},
		},

		maintenanceWindows: {
			form: {
				fields: {
					name: {
						label: "Nome",
					},

					scope: {
						label: "Ambito",
						allMonitors: "Tutti i monitor",
					},

					startsAt: {
						label: "Ora di inizio",
					},

					endsAt: {
						label: "Ora di fine",
					},

					suppressAlerts: {
						label: "Sopprimi gli avvisi durante questa finestra",
					},

					showOnStatusPage: {
						label: "Mostra sulla pagina di stato",
					},

					recurring: {
						label: "Ricorrente",
					},

					recurringPattern: {
						label: "Schema di ricorrenza (se ricorrente)",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"daily:HH:MM-HH:MM, weekly:<giorno>:HH:MM-HH:MM, o monthly:<giorno-del-mese>:HH:MM-HH:MM, in UTC.",
					},
				},
			},
		},

		alertHistory: {
			header: {
				title: "Cronologia Avvisi",
			},

			breadcrumbs: {
				alerts: "Avvisi",
			},

			empty: {
				title: "Nessun evento di avviso ancora",
				description:
					"Gli eventi di avviso appariranno qui quando i monitor attivano gli avvisi. Configuri gli avvisi per iniziare.",
				cta: "Visualizza Avvisi",
			},

			table: {
				label: "Eventi Avviso",

				columns: {
					alert: "Avviso",
					monitor: "Monitor",
					eventType: "Evento",
					status: "Stato",
					sentAt: "Ora",
				},

				unknownAlert: "Avviso Sconosciuto",
				unknownMonitor: "Monitor Sconosciuto",

				eventType: {
					down: "Non Attivo",
					up: "Ripristinato",
					degraded: "Degradato",
				},

				status: {
					sent: "Inviato",
					skipped_cooldown: "Saltato (Cooldown)",
					skipped_cap: "Saltato (Limite di ripetizioni)",
					skipped: "Saltato",
					failed: "Fallito",
				},
			},
		},

		createAlert: {
			header: {
				title: "Crea Avviso",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Avviso CTO",
						description: "Un nome per identificare l'avviso.",
					},

					strategy: {
						label: "Strategia",
						description: "La strategia da utilizzare per l'avviso.",
						options: {
							webhook: "Webhook",
							email: "Email",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL Webhook",
								placeholder: "https://example.com/webhook",
								description: "L'URL a cui inviare il payload dell'avviso.",
							},
							secret: {
								label: "Segreto",
								placeholder: "segreto-opzionale",
								description:
									"Un segreto opzionale da includere negli header della richiesta. Verrà aggiunto un header `Webhook-Signature` con una firma HMAC SHA256 del payload usando questo segreto.",
							},
						},
						email: {
							to: {
								label: "Indirizzo Email",
								placeholder: "cto@example.com",
								description: "L'indirizzo email a cui inviare l'avviso.",
							},

							subjectPrefix: {
								label: "Prefisso Oggetto",
								placeholder: "[Avviso Uptime]",
								description:
									"Un prefisso opzionale da aggiungere all'oggetto dell'email. Utile per filtrare gli avvisi nella sua casella di posta.",
							},
						},
						slack: {
							webhookUrl: {
								label: "URL Webhook Slack",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"L'URL Webhook in Entrata di Slack. Creane uno su api.slack.com/apps > Incoming Webhooks.",
							},
							channel: {
								label: "Override Canale",
								placeholder: "#avvisi",
								description:
									"Canale opzionale in cui pubblicare invece del predefinito del webhook. Includa il prefisso #.",
							},
						},
						discord: {
							webhookUrl: {
								label: "URL Webhook Discord",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"L'URL Webhook di Discord. Creane uno in Impostazioni Server > Integrazioni > Webhook.",
							},
						},
					},

					notifyOnRecovery: {
						label: "Notifica al ripristino",
						description:
							"Invia un avviso quando il monitor si riprende da uno stato non attivo. Include tempo di ripristino e durata del disservizio.",
					},

					cooldown: {
						label: "Cooldown Avviso",
						description:
							"Tempo minimo tra avvisi dello stesso tipo. Previene l'affaticamento da avvisi durante interruzioni prolungate.",
						options: {
							none: "Nessun cooldown",
							"5min": "5 minuti",
							"15min": "15 minuti",
							"30min": "30 minuti",
							"1hour": "1 ora",
							"2hours": "2 ore",
							custom: "Personalizzato",
						},
						custom: {
							label: "Cooldown Personalizzato (minuti)",
							placeholder: "Inserisci minuti",
							description: "Inserisca il numero di minuti tra gli avvisi.",
						},
					},
				},

				cta: "Crea Avviso",
			},
		},

		editAlert: {
			header: {
				title: "Modifica Avviso",
			},

			form: {
				cta: "Salva modifiche",
				cancel: "Annulla",
			},

			danger: {
				title: "Zona pericolosa",

				delete: {
					trigger: "Elimina avviso",
					confirmTitle: "Eliminare questo avviso?",
					confirmDescription: "Questa azione non può essere annullata.",
					confirm: "Elimina",
				},
			},
		},

		logout: {
			title: "È sicuro di voler effettuare il logout?",
			cta: "Logout",
		},

		splat: {
			notFound: {
				title: "Non Trovato",
				description: "La pagina che sta cercando non esiste.",
			},
		},

		account: {
			meta: {
				title: "Account - Uptime",
				description: "Gestisca le impostazioni del suo account e i team.",
			},

			header: {
				title: "Account",
			},

			form: {
				actions: {
					cancel: "Annulla",
				},
			},

			profile: {
				title: "Profilo",
				description: "Le sue informazioni personali.",

				card: {
					title: "Dettagli profilo",
					description: "Il suo nome, indirizzo email e avatar.",
				},
			},

			language: {
				title: "Preferenza Lingua",
				description: "Scelga la sua lingua preferita per l'interfaccia.",

				card: {
					title: "Lingua",
					description: "Si applica alla dashboard e alle notifiche via email.",
				},

				form: {
					fields: {
						language: {
							label: "Lingua preferita",
							description:
								"Selezioni la sua lingua preferita. Il rilevamento automatico utilizza le impostazioni del suo browser.",
							options: {
								auto: "Rilevamento automatico",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "Giapponese",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "Salva Lingua",
				},
			},

			teams: {
				title: "I Suoi Team",
				description: "Team di cui è membro.",

				actions: {
					createTeam: "Crea Team",
				},

				empty: {
					title: "Nessun team ancora",
					description: "Crei un team per iniziare a monitorare i suoi servizi.",
					cta: "Crea Team",
				},

				table: {
					label: "Team",
					description: "Tutti i team a cui appartiene.",

					columns: {
						team: "Team",
						role: "Ruolo",
						actions: "Azioni",
					},

					role: {
						member: "Membro",
						admin: "Amministratore",
						owner: "Proprietario",
					},

					actions: {
						menu: "Menu Azioni",
						leave: "Abbandona Team",
					},

					confirmation: {
						leaveTeam: "È sicuro di voler abbandonare {{name}}?",
					},
				},
			},
		},

		createTeam: {
			header: {
				title: "Crea Team",
				description: "Crei un nuovo team per monitorare i suoi servizi.",
			},

			dialog: {
				close: "Chiudi finestra",
			},

			form: {
				fields: {
					name: {
						label: "Nome Team",
						placeholder: "Il Mio Team Fantastico",
						description: "Scelga un nome per il suo nuovo team.",
					},
				},

				cancel: "Annulla",
				cta: "Crea Team",
			},
		},

		settings: {
			header: {
				title: "Impostazioni Team",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			sections: {
				general: {
					title: "Generale",
					description: "Gestisca le informazioni di base del suo team.",
				},
			},

			form: {
				card: {
					title: "Profilo Team",
					description: "Aggiorni il nome e il logo del suo team.",
				},

				fields: {
					logo: {
						label: "URL Logo",
						placeholder: "https://example.com/logo.png",
						description: "Un URL dell'immagine logo del suo team.",
					},
					name: {
						label: "Nome Team",
						placeholder: "Il Mio Team",
						description: "Il nome del suo team.",
					},
				},

				actions: {
					cancel: "Annulla",
					save: "Salva Modifiche",
				},
			},

			members: {
				title: "Membri",
				description: "Gestisca i membri del suo team e i loro ruoli.",

				actions: {
					invite: "Invita Membro",
				},

				table: {
					label: "Membri Attuali",
					description: "Persone che hanno accesso a questo team.",

					columns: {
						name: "Nome",
						role: "Ruolo",
						actions: "Azioni",
					},

					role: {
						member: "Membro",
						admin: "Amministratore",
						owner: "Proprietario",
					},

					actions: {
						menu: "Menu Azioni",
						remove: "Rimuovi dal Team",
						transfer: "Trasferisci Proprietà",
						changeRole: {
							member: "Converti in Amministratore",
							admin: "Converti in Membro",
							owner: "Non può cambiare il proprietario",
						},
					},

					confirmation: {
						removeMember: "È sicuro di voler rimuovere {{name}} dal team?",
					},
				},

				invitedTable: {
					label: "Inviti in Sospeso",
					description: "Persone che sono state invitate ma non si sono ancora unite.",

					columns: {
						email: "Email",
						expires: "Scade",
						actions: "Azioni",
					},

					expires: {
						expired: "Scaduto",
					},

					actions: {
						menu: "Menu Azioni",
						copy: "Copia Link Invito",
						revoke: "Revoca Invito",
					},

					confirmation: {
						revokeInvite: "È sicuro di voler revocare l'invito di {{email}}?",
					},

					empty: {
						description: "Nessun invito in sospeso.",
					},
				},
			},

			domains: {
				title: "Domini",
				description: "Gestisca i domini verificati per il suo team.",

				actions: {
					addDomain: "Aggiungi Dominio",
				},

				table: {
					label: "Domini Verificati",
					description:
						"Domini che possono essere utilizzati per il provisioning automatico dei membri del team.",

					columns: {
						hostname: "Hostname",
						id: "ID Verifica",
						verifiedAt: "Verificato Il",
						actions: "Azioni",
					},

					verifiedAt: {
						pending: "In attesa di verifica",
					},

					actions: {
						menu: "Menu Azioni",
						copy: "Copia ID Verifica",
						remove: "Rimuovi Dominio",
						retryVerification: "Riprova Verifica",
					},

					confirmation: {
						removeDomain: "È sicuro di voler rimuovere {{hostname}} dal team?",
					},

					empty: {
						description: "Ancora nessun dominio verificato.",
					},
				},

				form: {
					title: "Aggiungi Dominio",

					fields: {
						hostname: {
							label: "Dominio",
							placeholder: "example.com",
							description: "Il dominio che desidera aggiungere a {{team}}.",
						},
					},

					cta: "Aggiungi Dominio",
				},

				instructions: {
					title: "Come verificare il suo dominio",
					description:
						"Per verificare il suo dominio, aggiunga il seguente record TXT alle sue impostazioni DNS:",

					record: {
						name: {
							label: "Nome",
							value: "_ping-verification",
						},
						content: {
							label: "Contenuto",
							value: "VERIFICATION_ID",
						},
					},

					note: "Assicurati di sostituire <code>VERIFICATION_ID</code> con l'ID di verifica effettivo mostrato sopra.",
					disclaimer:
						"Le modifiche DNS potrebbero richiedere del tempo per propagarsi, quindi la verifica potrebbe essere ritardata.",
				},
			},

			billing: {
				title: "Fatturazione",
				description: "Gestisca il suo abbonamento e i dettagli di pagamento.",

				card: {
					title: "Abbonamento e Pagamenti",
					description:
						"Visualizzi le fatture, aggiorni i metodi di pagamento e gestisca il suo abbonamento.",
					notice:
						"Verrà reindirizzato al portale clienti di Polar per gestire le sue impostazioni di fatturazione.",
					cta: "Apri Portale Fatturazione",
				},
			},

			danger: {
				title: "Zona Pericolosa",
				description: "Azioni irreversibili che influenzano il suo team.",

				card: {
					title: "Elimina Team",
					description:
						"Elimina permanentemente questo team e tutti i suoi dati. Questa azione non può essere annullata.",
					warning:
						"Questo cancellerà il suo abbonamento ed eliminerà tutti i monitor, avvisi, domini, membri e inviti.",
					confirmation: {
						label: "Digiti DELETE per confermare",
						placeholder: "DELETE",
					},
					cta: "Elimina Team",
				},
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},

		tcpMonitors: {
			header: {
				title: "Monitor TCP",
				action: {
					create: "Crea Monitor TCP",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
				limitation: {
					title: "Limitazione Monitoraggio TCP",
					description:
						"Il monitoraggio delle porte TCP richiede il piano a pagamento di Cloudflare Workers con supporto socket. Con il piano gratuito, i controlli TCP appariranno come non disponibili. Consideri l'utilizzo del monitoraggio HTTP come alternativa.",
				},
			},

			empty: {
				title: "Nessun monitor TCP ancora",
				description: "Crei un monitor TCP per verificare se le porte sono aperte e responsive.",
				cta: "Crea Monitor TCP",
			},

			table: {
				label: "Monitor TCP",
				columns: {
					name: "Nome",
					endpoint: "Host:Porta",
					status: "Stato",
					lastChecked: "Ultimo Controllo",
					responseTime: "Tempo di Risposta",
					actions: "Azioni",
				},
				status: {
					up: "Attivo",
					down: "Non Attivo",
					timeout: "Timeout",
					disabled: "Disabilitato",
					pending: "In Attesa",
				},
				actions: {
					edit: "Modifica",
					delete: "Elimina",
					confirmation: {
						delete: "È sicuro di voler eliminare {{name}}?",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "Crea Monitor TCP",
				breadcrumb: {
					tcpMonitors: "Monitor TCP",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Server Database",
						description: "Un nome descrittivo per questo monitor TCP.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "L'hostname o l'indirizzo IP da monitorare.",
					},
					port: {
						label: "Porta",
						placeholder: "5432",
						description: "La porta TCP da controllare (1-65535).",
						decrement: "Diminuisci porta",
						increment: "Aumenta porta",
					},
					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare la porta.",
						decrement: "Diminuisci intervallo di controllo",
						increment: "Aumenta intervallo di controllo",
					},
					timeout: {
						label: "Timeout Connessione",
						description: "Quanto tempo attendere per una connessione prima del timeout.",
						decrement: "Diminuisci timeout connessione",
						increment: "Aumenta timeout connessione",
					},
				},
				cta: "Crea Monitor",
			},
		},

		editTcpMonitor: {
			header: {
				title: "Modifica Monitor TCP",
				breadcrumb: {
					tcpMonitors: "Monitor TCP",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome Monitor",
						placeholder: "Server Database",
						description: "Un nome descrittivo per questo monitor TCP.",
					},
					host: {
						label: "Host",
						placeholder: "db.example.com",
						description: "L'hostname o l'indirizzo IP da monitorare.",
					},
					port: {
						label: "Porta",
						placeholder: "5432",
						description: "La porta TCP da controllare (1-65535).",
						decrement: "Diminuisci porta",
						increment: "Aumenta porta",
					},
					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza controllare la porta.",
						decrement: "Diminuisci intervallo di controllo",
						increment: "Aumenta intervallo di controllo",
					},
					timeout: {
						label: "Timeout Connessione",
						description: "Quanto tempo attendere per una connessione prima del timeout.",
						decrement: "Diminuisci timeout connessione",
						increment: "Aumenta timeout connessione",
					},
					isEnabled: {
						label: "Abilita monitoraggio",
					},
				},
				cancel: "Annulla",
				cta: "Salva Modifiche",
			},

			danger: {
				title: "Zona pericolosa",
				cta: "Elimina monitor",
				description:
					"Questo elimina anche la cronologia dei risultati di controllo. Questa azione non può essere annullata.",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "Monitor TCP",
				},
				action: {
					edit: "Modifica",
					checkNow: "Controlla ora",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			info: {
				title: "Configurazione Monitor",
				endpoint: "Endpoint",
				status: "Stato",
				interval: "Intervallo di Controllo",
				timeout: "Timeout",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "Basato sui controlli recenti",
				},
				avgResponseTime: {
					label: "Tempo di Risposta Medio",
					description: "Tempo medio di connessione",
				},
				totalChecks: {
					label: "Controlli Totali",
					description: "Numero di controlli eseguiti",
				},
			},

			history: {
				title: "Cronologia Uptime",
			},

			results: {
				title: "Cronologia Controlli",
				description: "Risultati recenti dei controlli di connessione TCP",
				label: "Risultati",
				empty:
					"Nessun risultato ancora. I risultati appariranno dopo l'esecuzione del primo controllo.",
				columns: {
					time: "Ora",
					status: "Stato",
					responseTime: "Tempo di Risposta",
					error: "Errore",
				},
			},
		},

		apiKeys: {
			header: {
				title: "Chiavi API",
				action: {
					create: "Crea Chiave API",
				},
			},

			docsLink: {
				text: "Scopri come utilizzare le chiavi API nella nostra",
				link: "documentazione",
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			empty: {
				title: "Nessuna chiave API ancora",
				description: "Crei una chiave API per accedere all'API di Uptime in modo programmatico.",
				cta: "Crea Chiave API",
			},

			newKey: {
				title: "Chiave API '{{name}}' creata!",
				description: "Copi questa chiave ora. Per motivi di sicurezza, non potrà vederla di nuovo.",
				dismiss: "Ho copiato la mia chiave",
				copyLabel: "Copia chiave",
			},

			form: {
				title: "Crea Nuova Chiave API",
				description: "Le chiavi API consentono l'accesso programmatico ai suoi monitor e avvisi.",

				fields: {
					name: {
						label: "Nome Chiave",
						placeholder: "Chiave API Produzione",
						description: "Un nome per identificare questa chiave API.",
					},
					scopes: {
						label: "Permessi",
						description: "Selezioni a cosa può accedere questa chiave API.",
						descriptions: {
							"teams:read": "Legge il nome e il logo del team ed elenca i membri con i loro ruoli.",
							"teams:write":
								"Modifica il nome e il logo del team. Non consente di aggiungere o rimuovere membri, né di eliminare il team.",
							"invites:read":
								"Elenca gli inviti del team, in sospeso e accettati, compreso l'indirizzo email a cui ciascuno è stato inviato.",
							"invites:write":
								"Invita un indirizzo email nel team e revoca un invito esistente. Chi accetta un invito diventa membro.",
							"team-domains:read":
								"Elenca i domini rivendicati dal team e indica se ciascuno è verificato.",
							"team-domains:write":
								"Rivendica un dominio per il team o lo rimuove. Una volta verificato un dominio, chiunque si registri con un'email di quel dominio entra automaticamente nel team.",
							"monitors:read":
								"Legge i monitor HTTP, i loro risultati di controllo, le statistiche di disponibilità e lo stato complessivo del team.",
							"monitors:write":
								"Crea, aggiorna ed elimina i monitor HTTP e i loro controlli sul contenuto. Consente anche di accodare una ricostruzione delle statistiche giornaliere.",
							"maintenance:read": "Elenca e legge le finestre di manutenzione del team.",
							"maintenance:write":
								"Crea, aggiorna, termina in anticipo ed elimina le finestre di manutenzione. Una finestra in corso può sospendere gli avvisi dei monitor che copre.",
							"dns-monitors:read":
								"Elenca e legge i monitor DNS e i risultati di risoluzione registrati.",
							"dns-monitors:write": "Crea, aggiorna ed elimina i monitor DNS.",
							"tcp-monitors:read":
								"Elenca e legge i monitor TCP e i risultati di connessione registrati.",
							"tcp-monitors:write": "Crea, aggiorna ed elimina i monitor TCP.",
							"alerts:read":
								"Elenca e legge gli avvisi e gli eventi che hanno generato. Gli URL dei webhook e gli altri segreti dei canali non vengono mai restituiti.",
							"alerts:write":
								"Crea, aggiorna ed elimina gli avvisi, comprese le destinazioni webhook e chat. Eliminare un avviso interrompe tutte le notifiche che inviava.",
							"status-pages:read":
								"Elenca e legge le pagine di stato del team e i monitor collegati a ciascuna.",
							"status-pages:write":
								"Crea, aggiorna ed elimina le pagine di stato e sostituisce l'insieme di monitor e cron job che una pagina mostra pubblicamente.",
							"cron-jobs:read": "Elenca e legge i cron job del team e le loro pianificazioni.",
							"cron-jobs:write":
								"Crea, aggiorna ed elimina i cron job. Eliminandone uno, il suo URL di ping non viene più accettato.",
							"cron-jobs:ping":
								"Presente per l'URL di ping dei cron job, che è pubblico e non verifica alcun ambito. Concederlo non dà alla chiave alcun accesso che non abbia già.",
							"api-keys:read":
								"Elenca le chiavi API del team con nome, prefisso, ambiti e scadenza. La chiave segreta non viene mai restituita.",
							"api-keys:write":
								"Crea ed elimina le chiavi API del team. Una nuova chiave può ricevere qualsiasi ambito, quindi questo permesso consente di concedere tutti gli altri.",
							"ping:trigger":
								"Esegue controlli HTTP, DNS e TCP estemporanei senza creare un monitor. Ogni controllo viene fatturato come un ping e richiede un abbonamento attivo.",
						} satisfies Record<ApiKeyScope, string>,
					},
					expiresAt: {
						label: "Data Scadenza (Opzionale)",
						description: "Lasci vuoto per una chiave che non scade mai.",
					},
				},

				actions: {
					cancel: "Annulla",
					create: "Crea Chiave API",
				},
			},

			table: {
				label: "Chiavi API",

				columns: {
					name: "Nome",
					prefix: "Chiave",
					scopes: "Permessi",
					lastUsed: "Ultimo Utilizzo",
					expires: "Scade",
					actions: "Azioni",
				},

				lastUsed: {
					never: "Mai",
				},

				expires: {
					never: "Mai",
				},

				actions: {
					menu: "Menu Azioni",
					delete: "Elimina Chiave",
				},

				confirmation: {
					delete:
						"È sicuro di voler eliminare la chiave API '{{name}}'? Questa azione non può essere annullata.",
				},
			},

			error: {
				forbidden: {
					title: "Non ha il permesso di accedere a questa pagina.",
					description: "Per favore contatti l'amministratore del suo team per assistenza.",
				},

				unknown: {
					title: "Si è verificato un errore imprevisto.",
					description: "Per favore riprovi più tardi o contatti l'assistenza.",
				},
			},
		},

		cronJobs: {
			header: {
				title: "Cron Jobs",
				action: {
					create: "Crea Cron Job",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			empty: {
				title: "Nessun cron job ancora",
				description: "Crei un monitor di cron job per tracciare le sue attività pianificate.",
				cta: "Crea Cron Job",
			},

			table: {
				label: "Monitor Cron Job",
				columns: {
					name: "Nome",
					schedule: "Pianificazione",
					status: "Stato",
					lastPing: "Ultimo Ping",
					nextExpected: "Prossimo Atteso",
					actions: "Azioni",
				},
				status: {
					healthy: "Sano",
					late: "In Ritardo",
					missed: "Mancato",
					new: "Nuovo",
				},
				disabled: "Disabilitato",
				actions: {
					edit: "Modifica",
					delete: "Elimina",
					confirmation: {
						delete: "È sicuro di voler eliminare {{name}}?",
					},
				},
			},
		},

		createCronJob: {
			header: {
				title: "Crea Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Backup Giornaliero",
						description: "Un nome descrittivo per questo monitor di cron job.",
					},
					description: {
						label: "Descrizione",
						placeholder: "Descrizione opzionale di cosa fa questo job",
						description: "Una descrizione opzionale per aiutare a identificare questo cron job.",
					},
					cronExpression: {
						label: "Espressione Cron",
						placeholder: "0 * * * *",
						description: "L'espressione di pianificazione cron (es. '0 * * * *' per ogni ora).",
					},
					gracePeriod: {
						label: "Periodo di Grazia",
						description:
							"Quanto tempo aspettare dopo l'orario previsto prima di segnare come in ritardo.",
						decrement: "Diminuisci periodo di grazia",
						increment: "Aumenta periodo di grazia",
						unit: {
							minutes: "minuti",
							seconds: "secondi",
						},
					},
					timezone: {
						label: "Fuso Orario",
						placeholder: "Seleziona fuso orario",
						description: "Il fuso orario per la pianificazione cron.",
					},
					alertOnLate: {
						label: "Avvisa in Ritardo",
						description: "Inviare un avviso quando il job manca il suo orario previsto.",
					},
					enabled: {
						label: "Abilitato",
						description: "Iniziare a monitorare questo cron job immediatamente.",
					},
				},
				cta: "Crea Cron Job",
			},
		},

		editCronJob: {
			header: {
				title: "Modifica Cron Job",
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			form: {
				fields: {
					name: {
						label: "Nome",
						placeholder: "Backup Giornaliero",
						description: "Un nome descrittivo per questo monitor di cron job.",
					},
					description: {
						label: "Descrizione",
						placeholder: "Descrizione opzionale di cosa fa questo job",
						description: "Una descrizione opzionale per aiutare a identificare questo cron job.",
					},
					cronExpression: {
						label: "Espressione Cron",
						placeholder: "0 * * * *",
						description: "L'espressione di pianificazione cron (es. '0 * * * *' per ogni ora).",
					},
					gracePeriod: {
						label: "Periodo di Grazia",
						description:
							"Quanto tempo aspettare dopo l'orario previsto prima di segnare come in ritardo.",
						decrement: "Diminuisci periodo di grazia",
						increment: "Aumenta periodo di grazia",
						unit: {
							minutes: "minuti",
							seconds: "secondi",
						},
					},
					timezone: {
						label: "Fuso Orario",
						placeholder: "Seleziona fuso orario",
						description: "Il fuso orario per la pianificazione cron.",
					},
					alertOnLate: {
						label: "Avvisa in Ritardo",
						description: "Inviare un avviso quando il job manca il suo orario previsto.",
					},
					enabled: {
						label: "Abilitato",
						description: "Se monitorare attivamente questo cron job.",
					},
				},
				cancel: "Annulla",
				cta: "Salva Modifiche",
			},

			danger: {
				title: "Zona Pericolosa",

				delete: {
					trigger: "Elimina monitor",
					confirmTitle: "Eliminare questo monitor di cron job?",
					confirmDescription:
						"Questo elimina anche la cronologia dei ping. Questa azione non può essere annullata.",
					confirm: "Elimina",
				},
			},
		},

		cronJobDetail: {
			header: {
				breadcrumb: {
					cronJobs: "Cron Jobs",
				},
				action: {
					edit: "Modifica",
					delete: "Elimina",
				},
			},

			alert: {
				subscription: {
					title: "I suoi monitor sono in pausa!",
					description: "È richiesto un abbonamento per continuare il monitoraggio automatico.",
					cta: "Inizia il Monitoraggio",
				},
			},

			info: {
				title: "Configurazione Cron Job",
				schedule: "Pianificazione",
				timezone: "Fuso Orario",
				status: "Stato",
				gracePeriod: "Periodo di Grazia",
				description: "Descrizione",
			},

			stats: {
				totalPings: {
					label: "Totale Pings",
					description: "Numero di ping ricevuti",
				},
				onTimeRate: {
					label: "Tasso di Puntualità",
					description: "Percentuale di ping puntuali",
				},
				lastPing: {
					label: "Ultimo Ping",
					description: "Quando è stato ricevuto l'ultimo ping",
					never: "Mai",
				},
				nextExpected: {
					label: "Prossimo Atteso",
					description: "Quando è atteso il prossimo ping",
				},
			},

			ping: {
				title: "Pingare questo monitor",
				description:
					"Fai in modo che il tuo processo invii una richiesta POST qui al termine, con una chiave API che abbia l'ambito `cron-jobs:ping`.",
			},

			uptimeHistory: "Cronologia uptime",

			pings: {
				title: "Cronologia Pings",
				description: "Ping recenti ricevuti da questo cron job",
				empty:
					"Nessun ping ricevuto ancora. I ping appariranno qui dopo che il suo job invierà il primo ping.",
				label: "Pings",
				columns: {
					time: "Ora",
					status: "Stato",
					sourceIp: "IP Sorgente",
				},
				status: {
					onTime: "Puntuale",
					late: "In Ritardo",
				},
			},

			integration: {
				title: "Istruzioni di Integrazione",
				description:
					"Invii una richiesta POST a questo endpoint quando il suo cron job si completa.",
				endpoint: "Endpoint Ping",
				curlExample: "Esempio cURL",
				codeExamples: {
					title: "Esempi di Codice",
					bash: "Bash / Cron",
					python: "Python",
					nodejs: "Node.js",
				},
				apiKeyNote:
					"Ha bisogno di una chiave API con l'ambito 'cron-jobs:ping'. Ne crei una nelle impostazioni Chiavi API.",
			},

			delete: {
				confirmation:
					"È sicuro di voler eliminare {{name}}? Questa azione non può essere annullata.",
			},
		},
	},
};
