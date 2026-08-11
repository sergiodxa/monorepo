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

		try: {
			title: "Controlla qualsiasi URL, gratis",
			description:
				"Nessun account necessario. Eseguiamo un controllo e ti mostriamo esattamente cosa segnalerebbe un monitor.",
			label: "Controlla una URL",
			placeholder: "https://esempio.com",
			submit: "Esegui un controllo",
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
				try: "Monitora un sito gratis per {{days}} giorni",
			},

			try: {
				label: "Controlla una URL",
				placeholder: "https://esempio.com",
				submit: "Esegui un controllo",
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
			monitorTypes: "Tipi di Monitor",
			globalRegions: "Regioni Globali",
			daysDataRetention: "Giorni Conservazione Dati",
			minCheckInterval: "Intervallo Minimo di Controllo",
		},

		/**
		 * Le tre cose che restano vere qualunque sia la quantità di servizi monitorati. Il prezzo
		 * e la quota inclusa arrivano da `~/app/lib/pricing.ts` invece di essere scritti qui —
		 * un valore letterale diventerebbe obsoleto il giorno in cui i prezzi cambiano, e
		 * `app/lib/public-claims.ts` fa fallire la build se ne trova uno.
		 */
		benefits: {
			badge: "Perché Uptime",
			title: "Un solo piano, tutti i controlli, nessun calcolo",
			description: "Tre cose che restano vere qualunque sia la quantità di servizi che monitora.",

			list: {
				everythingIncluded: {
					title: "Tutto incluso",
					description:
						"Controlli HTTP, DNS, TCP e SSL, heartbeat dei cron job, avvisi e pagine di stato. Un solo piano, niente venduto come componente aggiuntivo.",
				},
				noMonitorMath: {
					title: "Nessun calcolo sui monitor",
					description:
						"Monitor illimitati e membri del team illimitati. Aggiunga tutto ciò che vuole tenere d'occhio, e tutte le persone che devono vederlo.",
				},
				payForUsage: {
					title: "Paghi per l'utilizzo effettivo",
					description:
						"{{price}} al mese includono {{included}} controlli. Oltre quella soglia paga i controlli che esegue davvero, e nient'altro.",
				},
			},
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
						"Traccia i suoi servizi 24/7, da nove regioni e con intervalli da un minuto. Ottenga metriche dettagliate e informazioni sulle prestazioni a colpo d'occhio.",
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
					microservices: "Microservizi",
					healthChecks: "Health check",
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
					checkly: "vs Checkly",
					statuscake: "vs StatusCake",
					datadog: "vs Datadog",
					site24x7: "vs Site24x7",
					ohdear: "vs Oh Dear",
				},
				docs: {
					title: "Documentazione",
					overview: "Panoramica",
					quickstart: "Guida rapida",
					apiReference: "Riferimento API",
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

	/**
	 * `/trust` — come funziona il monitoraggio e chi lo gestisce.
	 */
	trust: {
		meta: {
			title: "Trasparenza | Uptime",
			description:
				"Come funziona Uptime: chi lo gestisce, da dove partono i controlli, come viene confermato un incidente e cosa viene conservato e cosa no.",
		},
		footerLink: "Trasparenza",
		heading: "Trasparenza",
		intro:
			"Un monitor vale solo quanto la fiducia che Le ispira. Questa pagina descrive come funziona davvero il servizio — chi lo gestisce, da dove partono i suoi controlli, come un guasto diventa una notifica e cosa conserviamo — con dettagli sufficienti per decidere se affidarsi a esso. Tutto quanto è scritto qui descrive il sistema così com'è costruito oggi, non come è previsto che sia.",
		regions: {
			afr: "Africa",
			apac: "Asia-Pacifico",
			eeur: "Europa orientale",
			enam: "America del Nord orientale",
			me: "Medio Oriente",
			oc: "Oceania",
			sam: "America del Sud",
			weur: "Europa occidentale",
			wnam: "America del Nord occidentale",
		},
		sections: {
			whoRuns: {
				title: "Chi lo gestisce",
				bodyPrefix: "Uptime è sviluppato e gestito da ",
				founderName: "Sergio Xalambrí",
				bodySuffix:
					", in modo indipendente. Dietro quel nome non c'è alcun turno di assistenza né una squadra di reperibilità: una sola persona scrive il codice, lo mette in produzione e risponde alle email.",
				second:
					"Vale la pena saperlo in entrambe le direzioni. Una domanda sul comportamento di un controllo arriva alla persona che l'ha scritto. Un problema che comincia mentre quella persona dorme aspetta che si svegli.",
			},

			/**
			 * Code-available, not open source: the repository carries its own license with
			 * conditions, so the claim is only that a reader can check the code.
			 */
			source: {
				title: "Può leggere il codice",
				bodyPrefix:
					"Il codice che fa funzionare questo servizio è pubblico, quindi le affermazioni di questa pagina si possono verificare invece di accettarle per fiducia: come viene classificato un controllo, cosa contiene un risultato memorizzato, quando parte una notifica: ",
				linkText: "apps/uptime su GitHub",
				bodySuffix: ".",
				caveat:
					"Questo le mostra il codice, non il deployment in esecuzione in questo momento. È una cosa in più che può verificare da sé, non una garanzia di per sé.",
			},
			ownStatus: {
				title: "La nostra pagina di stato",
				bodyPrefix:
					"Il servizio pubblica una pagina di stato su se stesso, costruita con lo stesso monitoraggio dei cron job che il prodotto offre: ",
				linkText: "uptime.sergiodxa.com/status/uptime",
				bodySuffix: ".",
				scope:
					"Ciò che quella pagina copre è più ristretto di quanto possa sembrare, quindi ecco l'affermazione precisa. Ognuno dei lavori interni pianificati del servizio — i cicli di controllo dei monitor, il consolidamento notturno delle statistiche giornaliere, le pulizie di conservazione — segnala quando termina, così la pagina mostra se quel lavoro pianificato viene eseguito nei tempi previsti. Non è una sonda indipendente dell'intero servizio, e gira sulla stessa piattaforma dell'applicazione, quindi un problema abbastanza ampio da fermare l'applicazione può fermare anche i rapporti della pagina.",
			},
			whereChecksRun: {
				title: "Da dove partono i controlli",
				intro:
					"Ogni monitor viene controllato da una regione che scelga Lei. Ne sono disponibili nove:",
				hint: "Una regione è un'indicazione, non una promessa. Il controllo viene eseguito su infrastruttura collocata vicino alla regione scelta, e la piattaforma può collocarlo altrove quando è necessario. Le due regioni europee sono l'eccezione: sono vincolate all'UE, che è un requisito rigido e non una preferenza.",
				timing:
					"Il tempo di risposta registrato per un controllo misura solo la richiesta al suo endpoint, non il lavoro che facciamo attorno a essa, così il valore resta confrontabile con ciò che sperimenterebbe qualcuno in quella regione.",
			},
			incidents: {
				title: "Come viene confermato un incidente",
				classification:
					"Ogni controllo si chiude con uno di tre esiti. Non raggiungibile significa che l'endpoint non è stato raggiunto affatto, ha risposto con uno stato diverso da quello che si aspetta, oppure non ha superato un controllo sul contenuto che ha configurato. Degradato significa che ha risposto correttamente, ma più lentamente della soglia che ha impostato. Attivo significa che tutto corrispondeva.",
				noConfirmation:
					"Non c'è un secondo controllo di conferma prima della prima notifica: un solo controllo fallito basta a marcare un monitor come non raggiungibile e a inviare l'avviso. È un compromesso deliberato — una verifica di conferma ritarderebbe ogni avviso reale di un intervallo intero — ma significa anche che un singolo momento sfortunato della rete può arrivarLe nella casella di posta.",
				falsePositivesIntro: "Ciò che invece tiene basso il rumore:",
				infraFault: {
					label: "I nostri guasti non sono i suoi.",
					body: "Quando è la nostra infrastruttura di controllo a guastarsi, il controllo viene riprovato invece di essere registrato. Un guasto dalla nostra parte non diventa mai un esito negativo nel suo storico né un avviso nella sua casella di posta.",
				},
				yourThresholds: {
					label: "Il suo timeout, le sue soglie.",
					body: "Il timeout, lo stato atteso e la soglia di degrado li imposta Lei, quindi un controllo risulta lento o fallito solo secondo la definizione che gli ha dato.",
				},
				cooldown: {
					label: "Le ripetizioni sono distanziate, e il ripristino arriva sempre.",
					body: "Il primo avviso di un incidente parte immediatamente. Finché un monitor resta non raggiungibile, le ripetizioni sono distanziate dal periodo di attesa di quell'avviso — un'ora per impostazione predefinita — così un'interruzione prolungata continua ad avvisarla invece di ammutolirsi. Al ripristino riceve un ulteriore messaggio.",
				},
				recovery: {
					label: "Avvisi di ripristino solo dopo un guasto reale.",
					body: "Un messaggio di ripristino viene inviato solo se il monitor si trovava prima in uno stato di guasto. Il primo controllo in assoluto di un monitor non si annuncia mai come ripristinato.",
				},
				maintenance: {
					label: "Le finestre di manutenzione sospendono gli avvisi.",
					body: "Mentre una finestra di manutenzione copre un monitor, le sue notifiche vengono saltate del tutto, così il lavoro pianificato non sveglia nessuno.",
				},
				accounting: {
					label: "Le notifiche trattenute vengono conteggiate.",
					body: "Quando un incidente si chiude, il messaggio di ripristino riporta quante notifiche sono state inviate e quante sono state trattenute, così un incidente silenzioso si distingue da avvisi persi.",
				},
			},
			storage: {
				title: "Cosa viene conservato e cosa no",
				noBodies:
					"I corpi delle risposte non vengono mai conservati. Né troncati, né sottoposti ad hash, né campionati: nel database non esiste alcuna colonna per contenerli.",
				contentChecks:
					"Il corpo di una risposta viene scaricato soltanto quando configura un controllo sul contenuto per quel monitor. In quel caso viene confrontato con le sue regole in memoria durante il controllo e poi scartato insieme al resto della richiesta. Un monitor senza controlli sul contenuto non legge mai un corpo.",
				storedIntro: "Cosa viene conservato, e per quanto tempo:",
				httpResults: {
					label: "Singoli record dei controlli HTTP:",
					body: "il codice di stato restituito, quanto è durata la richiesta e quando è terminata. Conservati per una settimana, che è tutto ciò che leggono le viste recenti e il conteggio dell'utilizzo.",
				},
				dailyStats: {
					label: "Statistiche giornaliere:",
					body: "ogni notte i controlli del giorno precedente vengono consolidati in una riga per monitor. Quel consolidamento è lo storico di lungo periodo dietro ogni grafico di uptime dell'app, e viene conservato per 365 giorni.",
				},
				otherResults: {
					label: "Record dei controlli DNS e TCP:",
					body: "conservati per 90 giorni, perché sono lo storico che la pagina di dettaglio di un monitor e un'analisi post mortem leggono direttamente.",
				},
				alertHistory: {
					label: "Storico degli avvisi:",
					body: "ogni notifica che abbiamo inviato, che non siamo riusciti a inviare o che abbiamo trattenuto deliberatamente, conservata per 90 giorni, così può verificare cosa Le è stato detto e cosa no.",
				},
				cronPings: {
					label: "Segnalazioni dei cron job:",
					body: "conservate per 365 giorni. L'indirizzo di provenienza e lo user agent registrati insieme a una segnalazione vengono cancellati dopo 30 giorni; la segnalazione in sé resta.",
				},
			},
			customerData: {
				title: "I dati del suo account",
				bodyPrefix:
					"I dati dell'account, la gestione dei pagamenti, i cookie e i suoi diritti su tutto questo sono trattati nell'",
				privacyLinkText: "Informativa sulla privacy",
				bodySuffix:
					", che è il documento di riferimento e non un riassunto scritto due volte. In breve: i suoi dati non vengono venduti, e i suoi dati di monitoraggio appartengono al suo team.",
			},
			ourIncidents: {
				title: "Quando è Uptime stesso ad avere un incidente",
				retries:
					"I controlli vengono messi in coda invece di essere eseguiti in linea, e un controllo che non è potuto terminare per un guasto dalla nostra parte viene riprovato invece di essere registrato. Nessun nostro problema viene scritto nello storico del suo monitor come un guasto del suo servizio.",
				gaps: "Se il problema si prolunga, i controlli vengono ritardati o saltati. Un controllo saltato non scrive nulla, quindi quel periodo compare nel suo storico come un intervallo senza dati e non come un'indisponibilità che non ha mai avuto, e i suoi valori vengono calcolati sui controlli effettivamente eseguiti.",
				missedAlerts:
					"La modalità di guasto che vale la pena capire è quella che ne consegue: se il suo endpoint va giù durante una nostra interruzione, il suo avviso può arrivare in ritardo o non arrivare affatto. Un servizio di monitoraggio non può avvisarLa mentre è fuori servizio, e questo non fa eccezione.",
				noSlaPrefix:
					"Non offriamo alcun accordo sul livello di servizio, e non pubblichiamo alcun valore di disponibilità a cui vincolarci. I ",
				termsLinkText: "Termini di servizio",
				noSlaSuffix:
					" dicono altrettanto, e questa pagina non dirà di nascosto il contrario. Ciò che c'è invece: la pagina di stato di cui sopra, e una persona che risponde alle email.",
			},
		},
	},

	legal: {
		terms: {
			meta: {
				title: "Termini di servizio | Uptime",
				description:
					"Termini di servizio di Uptime, il servizio di monitoraggio uptime di Sergio Xalambrí.",
			},

			lastUpdated: "Ultimo aggiornamento: 11 febbraio 2026",
			title: "Termini di servizio",

			sections: {
				introduction: {
					title: "1. Introduzione",
					body: "Benvenuto su Uptime. Questi Termini di servizio regolano il tuo utilizzo del nostro servizio di monitoraggio uptime gestito da Sergio Xalambrí. Accedendo a Uptime o utilizzandolo, accetti di essere vincolato da questi termini.",
				},
				serviceDescription: {
					title: "2. Descrizione del servizio",
					body: "Uptime offre servizi di monitoraggio dell'uptime e delle attività pianificate, tra cui il monitoraggio di endpoint HTTP, DNS, porte TCP, certificati SSL e cron job. Questi servizi ti aiutano a tenere sotto controllo lo stato dei tuoi servizi e delle tue attività pianificate. Controlliamo i tuoi endpoint da più regioni nel mondo e ti avvisiamo quando rileviamo un problema.",
				},
				accountTerms: {
					title: "3. Condizioni dell'account",
					first: "Devi fornire informazioni corrette e complete quando crei un account.",
					second:
						"Sei responsabile della sicurezza delle credenziali del tuo account e di tutte le attività che avvengono al suo interno.",
					third:
						"Devi avere almeno 18 anni oppure avere il potere legale di stipulare questo accordo per conto di un'organizzazione.",
					fourth: "Devi avvisarci subito di qualsiasi utilizzo non autorizzato del tuo account.",
				},
				acceptableUse: {
					title: "4. Uso consentito",
					intro: "Usando Uptime, accetti di non:",
					first:
						"Abusare del nostro servizio, sovraccaricarlo, interferire con esso o tentare di aggirare i limiti di utilizzo.",
					second:
						"Monitorare URL o endpoint che non ti appartengono o per cui non hai autorizzazione.",
					third:
						"Monitorare cron job o attività pianificate che non ti appartengono o per cui non hai autorizzazione.",
					fourth:
						"Usare gli endpoint di ping dei cron job per scopi diversi dal legittimo monitoraggio di attività pianificate.",
					fifth: "Usare il servizio per scopi illeciti o non autorizzati.",
					sixth:
						"Tentare di accedere senza autorizzazione ai nostri sistemi o agli account di altri utenti.",
					seventh: "Rivendere o ridistribuire il servizio senza il nostro consenso scritto.",
				},
				paymentTerms: {
					title: "5. Condizioni di pagamento",
					first:
						"Uptime funziona con un modello di fatturazione a consumo. Paghi in base al numero di monitor e alla frequenza dei controlli che imposti.",
					second: "Gli abbonamenti sono gestiti ed elaborati tramite Polar.",
					third:
						"Se disdici, i rimborsi vengono calcolati in proporzione alla parte di abbonamento non utilizzata.",
					fourth:
						"Ci riserviamo il diritto di cambiare i prezzi con un preavviso di 30 giorni. Continuare a usare il servizio dopo una variazione di prezzo equivale ad accettarla.",
				},
				dataAndPrivacy: {
					title: "6. Dati e privacy",
					firstPrefix: "Il tuo utilizzo di Uptime è regolato anche dalla nostra ",
					firstLinkText: "Informativa sulla privacy",
					firstSuffix: ", che spiega come raccogliamo, usiamo e proteggiamo i tuoi dati.",
					second:
						"I dati di monitoraggio vengono conservati per 365 giorni. Trascorso questo periodo, lo storico viene cancellato automaticamente.",
					third:
						"Puoi chiedere la cancellazione dei tuoi dati in qualsiasi momento scrivendoci. Alla chiusura dell'account, i tuoi dati vengono cancellati entro 30 giorni.",
				},
				serviceAvailability: {
					title: "7. Disponibilità del servizio",
					first:
						"Puntiamo a una disponibilità del servizio del 99,9%, ma è un obiettivo, non una garanzia. Non offriamo accordi sul livello di servizio (SLA) con penali economiche.",
					second:
						"Possiamo svolgere manutenzioni programmate dandoti, quando possibile, un preavviso ragionevole. Le manutenzioni d'emergenza possono avvenire senza preavviso.",
					third:
						"Non siamo responsabili di interruzioni del servizio, perdite di dati o danni derivanti da interruzioni, programmate o meno.",
				},
				limitationOfLiability: {
					title: "8. Limitazione di responsabilità",
					first:
						'Uptime è fornito "così com\'è" e "come disponibile", senza garanzie di alcun tipo, esplicite o implicite.',
					second:
						"Non garantiamo che il nostro servizio rilevi tutti i disservizi che riguardano gli endpoint che monitori. Il monitoraggio dipende dalle condizioni di rete e da altri fattori fuori dal nostro controllo.",
					third:
						"La nostra responsabilità complessiva verso di te per qualsiasi richiesta legata all'uso del servizio è limitata a quanto ci hai pagato nei 12 mesi precedenti la richiesta.",
					fourth:
						"Non siamo responsabili di danni indiretti, incidentali, speciali, consequenziali o punitivi.",
				},
				termination: {
					title: "9. Chiusura",
					first:
						"Puoi chiudere il tuo account in qualsiasi momento dalle impostazioni dell'account o scrivendoci.",
					second:
						"Possiamo sospendere o chiudere il tuo account se violi questi termini o per altri motivi, con un preavviso ragionevole.",
					third:
						"Alla chiusura, il tuo accesso al servizio termina e i tuoi dati vengono cancellati entro 30 giorni.",
				},
				changesToTerms: {
					title: "10. Modifiche ai termini",
					body: "Possiamo aggiornare questi Termini di servizio di tanto in tanto. Ti avviseremo delle modifiche importanti via email o tramite il servizio. Continuare a usare Uptime dopo che le modifiche sono in vigore equivale ad accettare i termini aggiornati.",
				},
				contact: {
					title: "11. Contatti",
					prefix: "Se hai domande su questi Termini di servizio, scrivici a ",
					email: "hello@sergiodxa.com",
				},
			},
		},
		privacy: {
			meta: {
				title: "Informativa sulla privacy | Uptime",
				description:
					"Informativa sulla privacy di Uptime. Scopri come raccogliamo, usiamo e proteggiamo i tuoi dati quando usi il nostro servizio di monitoraggio uptime.",
			},

			lastUpdated: "Ultimo aggiornamento: 2 agosto 2026",
			title: "Informativa sulla privacy",

			sections: {
				introduction: {
					title: "1. Introduzione",
					first:
						'Questa Informativa sulla privacy descrive come Uptime, gestito da Sergio Xalambrí ("noi" o "nostro"), raccoglie, usa e protegge i tuoi dati personali quando usi il nostro servizio di monitoraggio uptime.',
					second:
						"Questa informativa vale per tutti gli utenti del servizio e riguarda i dati raccolti tramite il nostro sito e la piattaforma di monitoraggio.",
				},
				dataCollected: {
					title: "2. Dati che raccogliamo",
					accountData: {
						title: "Dati dell'account",
						body: "Quando ti registri con l'autenticazione GitHub, raccogliamo il tuo indirizzo email e il nome visualizzato dal tuo profilo GitHub.",
					},
					monitoringData: {
						title: "Dati di monitoraggio",
						body: "Raccogliamo i dati relativi ai monitor che crei, tra cui gli URL che scegli di monitorare, i tempi di risposta, i codici di stato HTTP e gli eventi di uptime e downtime.",
					},
					cronJobData: {
						title: "Dati di monitoraggio dei cron job",
						intro: "Per il monitoraggio dei cron job (attività pianificate) raccogliamo:",
						first:
							"Gli orari dei ping (quando le tue attività pianificate segnalano di aver finito)",
						second: "Gli indirizzi IP di origine delle richieste di ping",
						third: "Gli user agent delle richieste di ping",
						fourth:
							"La configurazione della pianificazione (espressioni cron, fusi orari, periodi di tolleranza)",
						outro:
							"Questi dati ti aiutano a capire se le tue attività pianificate girano nei tempi previsti e ci permettono di avvisarti quando manca un ping atteso.",
					},
					usageData: {
						title: "Dati di utilizzo",
						body: "Raccogliamo dati analitici e di log su come usi il nostro servizio, tra cui le pagine viste, l'uso delle funzionalità e i log degli errori.",
					},
					paymentData: {
						title: "Dati di pagamento",
						body: "I pagamenti sono gestiti da Polar. Non conserviamo i dati della tua carta di credito. Da Polar riceviamo solo la conferma dello stato del tuo abbonamento e lo storico della fatturazione.",
					},
				},
				dataUsage: {
					title: "3. Come usiamo i tuoi dati",
					first: {
						label: "Per fornire il servizio di monitoraggio:",
						body: "Usiamo i tuoi dati per monitorare gli URL che hai indicato e seguirne la disponibilità.",
					},
					second: {
						label: "Per inviare avvisi e notifiche:",
						body: "Usiamo la tua email per inviarti avvisi di downtime e notifiche di stato.",
					},
					third: {
						label: "Per migliorare il servizio:",
						body: "Analizziamo come viene usato il servizio per migliorare le funzionalità e risolvere i problemi.",
					},
					fourth: {
						label: "Per comunicare con te:",
						body: "Possiamo inviarti aggiornamenti sul servizio, avvisi di sicurezza e messaggi di assistenza.",
					},
				},
				dataSharing: {
					title: "4. Condivisione dei dati",
					noSell: "Non vendiamo i tuoi dati personali.",
					intro:
						"Condividiamo dati con i seguenti servizi di terze parti che ci aiutano a far funzionare Uptime:",
					first: {
						label: "Cloudflare:",
						body: "Infrastruttura, hosting e distribuzione dei contenuti",
					},
					second: { label: "Polar:", body: "Gestione dei pagamenti e degli abbonamenti" },
					third: { label: "GitHub:", body: "Servizi di autenticazione" },
					outro:
						"Possiamo inoltre comunicare i tuoi dati se la legge lo richiede o per tutelare i nostri diritti e la sicurezza dei nostri utenti.",
				},
				dataRetention: {
					title: "5. Conservazione dei dati",
					first: {
						label: "Dati di monitoraggio:",
						body: "Conservati per 365 giorni dalla raccolta",
					},
					second: {
						label: "Dati dell'account:",
						body: "Conservati finché non cancelli il tuo account",
					},
					third: { label: "Log:", body: "Conservati per 30 giorni" },
				},
				rights: {
					title: "6. I tuoi diritti (GDPR)",
					intro:
						"In base al Regolamento generale sulla protezione dei dati (GDPR), hai il diritto di:",
					first: {
						label: "Accedere ai tuoi dati:",
						body: "Chiedere una copia dei dati personali che abbiamo su di te",
					},
					second: {
						label: "Correggere i tuoi dati:",
						body: "Chiedere la correzione di dati personali inesatti",
					},
					third: {
						label: "Cancellare i tuoi dati:",
						body: "Chiedere la cancellazione dei tuoi dati personali",
					},
					fourth: {
						label: "Esportare i tuoi dati:",
						body: "Ricevere i tuoi dati in un formato portabile",
					},
					fifth: {
						label: "Opporti al trattamento:",
						body: "Opporti ad alcuni tipi di trattamento dei dati",
					},
					outro:
						"Per esercitare uno di questi diritti, scrivici all'indirizzo email indicato qui sotto.",
				},
				security: {
					title: "7. Sicurezza",
					intro: "Adottiamo misure di sicurezza adeguate per proteggere i tuoi dati:",
					first: {
						label: "Crittografia in transito:",
						body: "Tutti i dati viaggiano su HTTPS/TLS",
					},
					second: { label: "Crittografia a riposo:", body: "I dati archiviati sono cifrati" },
					third: {
						label: "Controlli di accesso:",
						body: "Controlli rigorosi limitano chi può accedere ai tuoi dati",
					},
					fourth: {
						label: "Revisioni di sicurezza periodiche:",
						body: "Rivediamo regolarmente le nostre pratiche di sicurezza",
					},
				},
				cookies: {
					title: "8. Cookie",
					intro: "Usiamo il minimo di cookie necessari al funzionamento del servizio:",
					first: {
						label: "Cookie di sessione:",
						body: "Servono per l'autenticazione e per mantenerti connesso",
					},
					outro:
						"Non usiamo cookie di tracciamento, cookie pubblicitari di terze parti né cookie a scopo di marketing.",
				},
				turnstile: {
					title: "9. Protezione dai bot",
					first:
						"La pagina pubblica dove chiunque può controllare un URL senza avere un account è protetta da Cloudflare Turnstile. Serve a distinguere una persona da un bot, così che il controllo gratuito non venga esaurito dal traffico automatizzato.",
					second:
						"Per farlo, Cloudflare riceve il tuo indirizzo IP e informazioni sul tuo browser, e può salvare un token nel tuo browser per ricordare che il controllo è stato superato.",
					third:
						"Turnstile viene eseguito solo su quella pagina pubblica. Non è usato in nessuna parte dell'applicazione con l'accesso effettuato.",
					referencePrefix: "Per sapere cosa fa Cloudflare con quei dati, consulta la sua ",
					referenceLinkText: "Appendice sulla privacy di Turnstile",
					referenceSuffix: ".",
				},
				childrensPrivacy: {
					title: "10. Privacy dei minori",
					body: "Uptime non è pensato per essere usato da persone con meno di 18 anni. Non raccogliamo consapevolmente dati personali di minori di 18 anni.",
				},
				internationalTransfers: {
					title: "11. Trasferimenti internazionali di dati",
					first:
						"I tuoi dati possono essere trattati tramite la rete globale di Cloudflare. Se ti trovi nell'Unione Europea, i tuoi dati possono essere trasferiti e trattati negli Stati Uniti.",
					second:
						"Ci basiamo sulle Clausole contrattuali standard di Cloudflare e su altre garanzie adeguate per assicurare che i tuoi dati siano protetti secondo quanto richiede il GDPR.",
				},
				changesToPolicy: {
					title: "12. Modifiche a questa informativa",
					first:
						'Possiamo aggiornare questa Informativa sulla privacy di tanto in tanto. Ti avviseremo di qualsiasi modifica sostanziale pubblicando la nuova informativa su questa pagina e aggiornando la data di "Ultimo aggiornamento".',
					second:
						"Per le modifiche importanti ti manderemo anche una notifica via email, se hai un account con noi.",
				},
				contact: {
					title: "13. Contattaci",
					body: "Se hai domande su questa Informativa sulla privacy o vuoi esercitare i tuoi diritti sui dati, scrivici a:",
					email: "hello+privacy@sergiodxa.com",
				},
			},
		},
	},

	notFound: {
		title: "Pagina non trovata",
		description: "La pagina che sta cercando non esiste o potrebbe essere stata spostata.",
		goBackHome: "Torna alla home page",
	},

	errors: {
		backHome: "Torna alla home",
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
				toggle: "Mostra o nascondi la navigazione",

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
					signOut: "Esci",
				},
			},
			breadcrumbs: { label: "Percorso di navigazione" },
			toasts: {
				region: "Notifiche",
				dismiss: "Chiudi",
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
		uptimeBar: {
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
		dns: {
			coverage: "Tutti i record DNS tracciati per questo dominio",
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
			title: "Aggiungi un controllo",
			description: "Ogni controllo viene applicato al corpo della risposta a ogni ping.",
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

	emails: {
		accountDeleted: {
			subject: "Il suo account Uptime è stato eliminato",
			preview: "Il suo account e i suoi dati sono stati eliminati.",
			heading: "Il suo account è stato eliminato",
			body: "Ci ha chiesto di eliminare il suo account Uptime e lo abbiamo fatto. I suoi team, monitor, avvisi, pagine di stato e preferenze non ci sono più, ogni team di cui era proprietario è stato eliminato insieme a loro e il suo abbonamento è stato disdetto.",
			retained: {
				intro:
					"Alcune cose non abbiamo potuto eliminarle, così sa esattamente come stanno le cose:",
				billing:
					"Le fatture e le registrazioni dei pagamenti conservate dal nostro fornitore di fatturazione. La normativa fiscale ci obbliga a conservarle, e per questo motivo la normativa sulla protezione dei dati lo consente.",
				analytics:
					"I risultati dei controlli di monitoraggio nel nostro archivio analitico. È a sola aggiunta: non c'è modo di eliminare un record, solo di lasciarlo scadere secondo il suo periodo di conservazione.",
				logs: "I log delle richieste al server, per lo stesso motivo: scadono secondo un periodo di conservazione e non possono essere eliminati in anticipo.",
				identity:
					"La sua identità di accesso, che è conservata dal provider di identità con cui ha effettuato l'accesso e non da noi.",
			},
			address:
				"Questo indirizzo email era conservato solo per poterLe inviare questo messaggio. Ora è stato eliminato anche quello.",
			footer:
				"Ha ricevuto questa email perché ci ha chiesto di eliminare il suo account Uptime. Nessun'altra email verrà inviata a questo indirizzo.",
		},

		teamDeleted: {
			subject: "{{team}} è stato eliminato su Uptime",
			preview: "{{team}} e tutto ciò che monitorava non esistono più.",
			heading: "{{team}} è stato eliminato",
			body: "Il proprietario di {{team}} ha eliminato il suo account Uptime e il team è stato eliminato insieme a esso. Non ha più accesso al team.",
			lost: "Tutto ciò che apparteneva al team non c'è più: i suoi monitor, avvisi e pagine di stato non esistono più e nulla di ciò può essere recuperato.",
			next: "Se ha ancora bisogno di questo monitoraggio, può creare un team suo su Uptime e configurarlo di nuovo.",
			footer:
				"Ha ricevuto questa email perché era membro di {{team}} su Uptime. Non c'è nulla che debba fare.",
		},

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
			action: "Apri la dashboard",
			incidentCooldown:
				"Notifiche per questo incidente: {{sent}} inviate, {{suppressed}} trattenute dal periodo di attesa dell'avviso.",
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
				endpoint: "Endpoint",
				schedule: "Pianificazione",
				lastPing: "Ultimo ping",
				nextExpected: "Prossimo previsto",
				hostname: "Hostname",
				expiresAt: "Scade il",
				records: "Record",
				findings: "Che cosa è cambiato",
			},

			values: {
				none: "—",
				never: "mai",
				monitor: "{{name}} ({{type}})",
				responseStatus: "{{actual}} (previsto {{expected}})",
				milliseconds: "{{value}}ms",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}} ({{timezone}})",
				dnsRecordCounts:
					"{{missing}} mancanti, {{changed}} cambiati, {{new}} visti per la prima volta",

				/** One finding, written out per outcome so each reads as its own sentence. */
				dnsFinding: {
					missing: "Non risolve più: {{name}} {{type}} {{value}}",
					changed: "Ora risolve a: {{name}} {{type}} {{value}}",
					new: "Visto per la prima volta: {{name}} {{type}} {{value}}",
				},

				dnsMoreFindings: "…e altri {{count}}",
			},

			/** Said only where it applies: what a DNS diff means, not what it found. */
			dns: {
				recordSetEditNote:
					"Un insieme di record che contiene più valori non ha un'identità per singolo record nel DNS, quindi un valore modificato al suo interno viene segnalato come un record che non risolve più e un record nuovo.",
				newRecordsNote:
					"I record visti per la prima volta non sono ancora monitorati. Apra il monitor per accettare quelli che si aspettava, oppure corregga il suo DNS.",
			},
		},

		teamDigest: {
			action: "Apri la dashboard",
			footer: "Ha ricevuto questa email perché è membro di {{team}} su Uptime.",
			manageAction: "Scelga quali email ricevere",

			status: {
				up: "Attivo",
				degraded: "Degradato",
				down: "Non attivo",
				noData: "Non controllato",
			},

			types: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cron: "Cron job",
			},

			columns: {
				monitor: "Monitor",
				status: "Stato",
				uptime: "Disponibilità",
			},

			values: {
				none: "—",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% di disponibilità",
				legend: {
					up: "Attivo",
					degraded: "Degradato",
					down: "Non attivo",
					noData: "Nessun dato",
				},
			},

			daily: {
				subject_one: "{{team}}: il monitor va controllato",
				subject_other: "{{team}}: {{up}} monitor su {{count}} attivi ieri",
				subjectAll_one: "{{team}}: il monitor è stato attivo ieri",
				subjectAll_other: "{{team}}: tutti e {{count}} i monitor attivi ieri",
				preview: "L'ultima giornata completa di controlli su {{team}}",
				heading: "Ieri su {{team}}",
				summaryAll_one: "Il monitor del team è stato attivo il {{date}}.",
				summaryAll_other: "Tutti e {{count}} i monitor erano attivi il {{date}}.",
				summary_one: "Il monitor del team non è stato attivo il {{date}}.",
				summary_other: "{{up}} monitor su {{count}} erano attivi il {{date}}.",
			},

			weekly: {
				subject_one: "{{team}}: il monitor ha avuto una giornata negativa questa settimana",
				subject_other: "{{team}}: {{up}} monitor su {{count}} attivi per tutta la settimana",
				subjectAll_one: "{{team}}: il monitor è stato attivo per tutta la settimana",
				subjectAll_other: "{{team}}: tutti e {{count}} i monitor attivi per tutta la settimana",
				preview: "Gli ultimi sette giorni di controlli su {{team}}",
				heading: "Gli ultimi sette giorni su {{team}}",
				summaryAll_one: "Il monitor del team è stato attivo ogni giorno.",
				summaryAll_other: "Tutti e {{count}} i monitor erano attivi ogni giorno.",
				summary_one: "Il monitor del team non è stato attivo tutti i giorni.",
				summary_other: "{{up}} monitor su {{count}} erano attivi ogni giorno.",
			},
		},

		trial: {
			stopAction: "Interrompere queste email",

			/**
			 * The report page every per-target trial report links, shared because the wrap-up and the
			 * repeat-submission answer point at the same page with the same sentence.
			 */
			reportLink: {
				body: "Questo rapporto vive anche a un link che può riaprire o condividere:",
				action: "Visualizzarlo online",
			},
			stop: "Un clic termina tutti gli URL che ci ha chiesto di sorvegliare ed elimina il suo indirizzo e i suoi dati. Può ricominciare in qualsiasi momento dal nostro sito.",

			status: {
				up: "ATTIVO",
				degraded: "DEGRADATO",
				down: "NON ATTIVO",
			},

			fields: {
				url: "URL",
				status: "Stato",
				previousStatus: "Stato precedente",
				responseStatus: "Stato della risposta",
				responseTime: "Tempo di risposta",
				checkedAt: "Controllato il",
				changedAt: "Cambiato il",
				checks: "Controlli eseguiti",
				uptime: "Disponibilità",
				slowest: "Risposta più lenta",
			},

			values: {
				none: "—",
				milliseconds: "{{value}}ms",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "{{value}}% di disponibilità",
				legend: {
					up: "Attivo",
					degraded: "Degradato",
					down: "Non attivo",
					noData: "Nessun dato",
				},
			},

			confirmation: {
				subject: "Ora controlliamo {{url}} ogni ora",
				preview: "I controlli orari di {{url}} sono iniziati",
				heading: "Ora controlliamo {{url}} ogni ora",
				body: "Questo è il controllo che ha appena eseguito. Lo ripeteremo ogni ora fino al {{until}} e Le scriveremo ogni volta che il risultato cambia. Riceverà anche un riepilogo una volta al giorno.",
				footer:
					"Ha ricevuto questa email perché ci ha chiesto di controllare questo URL dal nostro sito.",
			},

			change: {
				subject: "{{url}} è {{status}}",
				preview: "{{url}} è {{status}}",
				heading: "{{url}} è {{status}}",
				body: "Il controllo orario delle {{time}} ha restituito un risultato diverso dal precedente.",
				footer:
					"Ha ricevuto questa email perché ci ha chiesto di sorvegliare questo URL per una settimana.",
			},

			daily: {
				subject: "Rapporto giornaliero: {{url}}",
				subjectMany: "Rapporto giornaliero: {{total}} URL",
				preview: "Le ultime 24 ore di controlli su {{url}}",
				previewMany: "Le ultime 24 ore di controlli su {{total}} URL",
				heading: "{{url}} nelle ultime 24 ore",
				headingMany: "I suoi {{total}} URL nelle ultime 24 ore",
				summaryAll: "Tutti e {{total}} erano attivi all'ultimo controllo.",
				summary: "{{up}} su {{total}} erano attivi all'ultimo controllo.",
				target: "{{url}} — {{status}}",
				rangeStart: "24 ore fa",
				rangeEnd: "Adesso",
				footer:
					"Ha ricevuto questa email perché ci ha chiesto di eseguire questi controlli dal nostro sito.",
			},

			weekly: {
				subject: "Rapporto di sette giorni: {{url}}",
				preview: "La settimana completa di controlli su {{url}}",
				heading: "{{url}} negli ultimi sette giorni",
				rangeStart: "7 giorni fa",
				rangeEnd: "Oggi",
				closing:
					"Questo era il settimo giorno, quindi i controlli gratuiti su {{url}} terminano qui.",
				action: "Continuare a controllare questo URL",
				footer:
					"Ha ricevuto questa email perché ci ha chiesto di sorvegliare questo URL per una settimana. È l'ultima.",
			},

			repeat: {
				subject: "Quello che abbiamo trovato finora su {{url}}",
				preview: "I controlli che abbiamo già su {{url}}",
				heading: "{{url}} è già sotto controllo",
				intro:
					"Ci ha chiesto di sorvegliare {{url}} il {{since}}. Ecco tutto quello che quei controlli hanno rilevato.",
				rangeStart: "Giorno 1",
				rangeEnd: "Giorno 7",
				closing:
					"Ogni URL ha una settimana gratuita ogni 30 giorni, quindi questa richiesta non ne ha avviata una seconda. Per continuare a controllare {{url}} — con la frequenza che preferisce e con un avviso appena qualcosa cambia — usi Uptime.",
				action: "Continuare a controllare questo URL",
				footer:
					"Ha ricevuto questa email perché ha inviato questo URL sul nostro sito e avevamo già un rapporto su di esso.",
			},
		},
	},

	components: {
		copyButton: {
			label: "Copia",
			copied: "Copiato!",
		},

		selectAll: {
			select: "Seleziona tutto",
			clear: "Deseleziona tutto",
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
		checks: {
			queued: "Controllo in coda per «{{name}}».",
			subscriptionRequired: "È richiesto un abbonamento attivo per eseguire un controllo.",
		},

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

		/**
		 * Un'importazione in blocco riporta due numeri, e `partial` è quello che conta: un invio
		 * in cui alcune righe sono andate a buon fine è un successo con una lista di cose da
		 * fare, non un errore, quindi dice quanti monitor esistono prima di dire quante righe
		 * vanno corrette.
		 */
		importMonitors: {
			errors: {
				generic: "Ops! Qualcosa è andato storto. Controlli la lista e riprovi.",
				none: "Nessuna voce di quella lista è stata importata. Controlli i motivi qui sotto e riprovi.",
			},

			success_one: "1 monitor è stato creato.",
			success_other: "{{count}} monitor sono stati creati.",
			partial_one:
				"1 monitor è stato creato. Altri {{rejected}} non sono stati creati — veda qui sotto.",
			partial_other:
				"{{count}} monitor sono stati creati. Altri {{rejected}} non sono stati creati — veda qui sotto.",
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
			success: { checked: 'Controllato "{{name}}".' },
		},

		reviewDnsMonitor: {
			errors: { generic: "Non è stato possibile salvare quali record monitorare. Riprovi." },
			success: {
				saved_one: "{{count}} record monitorato.",
				saved_other: "{{count}} record monitorati.",
			},
		},

		toggleDnsMonitorRecord: {
			errors: { generic: "Non è stato possibile modificare questo record. Riprovi." },
			success: {
				enabled: "Ora sta monitorando {{name}}.",
				disabled: "Non sta più monitorando {{name}}.",
			},
		},

		importDnsMonitorZoneFile: {
			errors: {
				generic: "Non è stato possibile leggere questo file di zona. Riprovi.",
				tooLarge: "Un file di zona deve essere di {{limit}} o meno.",
				tooManyNames:
					"Questa zona contiene più di {{limit}} nomi, troppi perché un solo monitor possa esaminarli.",
			},
			success: {
				imported_one: "Importato {{count}} nome dal suo file di zona.",
				imported_other: "Importati {{count}} nomi dal suo file di zona.",
			},
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
			},

			quickPing: {
				title: "Controllo rapido",
				description:
					"Controlli un URL una volta. Nulla viene salvato, nessun avviso — costa un ping.",
				field: {
					label: "URL da controllare",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "Controlla una volta",
					/** Names the icon button that opens the bar as a sheet, below the width it is a row at. */
					open: "Apri controllo rapido",
				},
				result: {
					/** Names the toast region a finished check is reported in. */
					label: "Risultato del controllo",
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
					create: "Nuovo monitor HTTP",
					breakdown: {
						up: "{{up}} attivi",
						down: "{{down}} inattivi",
					},
				},
				dnsMonitors: {
					label: "Monitor DNS",
					create: "Nuovo monitor DNS",
					/** One monitor is one domain, so this count is smaller than the work behind it. */
					hint: "Un monitor copre un intero dominio e ogni record tracciato su di esso.",
					breakdown: {
						ok: "{{ok}} ok",
						changed: "{{changed}} cambiati",
						error: "{{error}} errore",
					},
				},
				tcpMonitors: {
					label: "Monitor TCP",
					create: "Nuovo monitor TCP",
					breakdown: {
						up: "{{up}} attivi",
						down: "{{down}} inattivi",
					},
				},
				cronJobs: {
					label: "Cron Job",
					create: "Nuovo cron job",
					breakdown: {
						healthy: "{{healthy}} sani",
						late: "{{late}} ritardo",
						missed: "{{missed}} mancati",
					},
				},

				slowestEndpoint: {
					label: {
						default: 'Endpoint più lento "<em>{{name}}</em>"',
						noData: "Endpoint più lento",
					},
					value: { noData: "N/D" },
					description: "Nelle ultime 24 ore",
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

				sections: {
					basics: {
						title: "Informazioni di Base",
						description: "Cosa controlla questo monitor.",
					},
					checks: {
						title: "Impostazioni di Controllo",
						description:
							"Con quale frequenza viene eseguito il monitor, cosa si aspetta in risposta e da dove viene eseguito.",
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

				sections: {
					basics: {
						title: "Informazioni di Base",
						description: "Cosa controlla questo monitor.",
					},
					checks: {
						title: "Impostazioni di Controllo",
						description:
							"Con quale frequenza viene eseguito il monitor, cosa si aspetta in risposta e da dove viene eseguito.",
					},
				},

				cancel: "Annulla",
				cta: "Salva Modifiche",
			},

			ssl: {
				title: "Monitoraggio del certificato SSL",
				description:
					"Tenga traccia della scadenza del suo certificato per saperlo prima dei suoi visitatori.",
				cta: "Salva impostazioni SSL",
			},

			dangerZone: {
				title: "Zona pericolosa",
				description: "Le azioni in questa sezione non possono essere annullate.",
				warning:
					"Eliminando questo monitor si perdono definitivamente i suoi controlli, la cronologia e gli avvisi.",
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
					description: "Ultimi 90 giorni",
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
			run: {
				toast: {
					up: "{{name}} è attivo",
					down: "{{name}} non è attivo",
					degraded: "{{name}} è degradato",
					changed: "Il controllo che ha appena eseguito ha cambiato lo stato di questo monitor.",
					notQueued: {
						title: "Controllo non eseguito",
						description: "È richiesto un abbonamento attivo per eseguire un controllo.",
					},
				},
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
						description:
							"Che cosa sorveglia questo avviso. Lascialo sull'intero team, restringilo a un tipo di monitor oppure puntalo su uno solo.",
						teamWide: "Intero team (tutti i monitor)",
						unknownMonitor: "Un monitor che non esiste più",
						types: {
							http: "Monitor HTTP",
							dns: "Monitor DNS",
							tcp: "Monitor TCP",
							cron: "Processi pianificati",
						},
						allOfType: {
							http: "Tutti i monitor HTTP",
							dns: "Tutti i monitor DNS",
							tcp: "Tutti i monitor TCP",
							cron: "Tutti i processi pianificati",
						},
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
						label: "Periodo di attesa (minuti)",
						description:
							"Quanto attendere prima di ripetere un avviso mentre un monitor è ancora non raggiungibile. Il primo avviso di un incidente viene sempre inviato immediatamente, e il ripristino viene sempre inviato. Le ripetizioni non sono mai distanziate meno di {{floor}} minuti, qualunque valore imposti qui.",
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
					allOfType: {
						http: "Tutti i monitor HTTP",
						dns: "Tutti i monitor DNS",
						tcp: "Tutti i monitor TCP",
						cron: "Tutti i processi pianificati",
					},
				},

				cooldown: {
					none: "Il più rapido consentito",
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
					cronJobs: {
						label: "Cron Job da Includere",
						description: "Selezioni quali cron job visualizzare su questa pagina di stato.",
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
			form: {
				sections: {
					branding: {
						title: "Identità",
						description: "Come la pagina si presenta, internamente e a chi la visita.",
					},
					visibility: {
						title: "Visibilità",
						description: "Chi può raggiungere questa pagina e quanto mostra a colpo d'occhio.",
					},
					services: {
						title: "Servizi",
						description: "Scelga i monitor e i cron job di cui questa pagina riporta lo stato.",
						empty:
							"Non ha ancora monitor o cron job. Ne crei uno e potrà aggiungerlo a questa pagina in seguito.",
					},
				},
			},
		},

		editStatusPage: {
			header: {
				title: "Modifica Pagina di Stato",
			},
			form: {
				sections: {
					branding: {
						title: "Identità",
						description: "Come la pagina si presenta, a Lei e ai suoi visitatori.",
					},
					visibility: {
						title: "Visibilità",
						description: "Chi può raggiungere questa pagina e cosa mostra in cima.",
					},
					services: {
						title: "Servizi",
						description: "Scelga i monitor e i cron job di cui questa pagina riporta lo stato.",
						empty: "Non ha ancora monitor o cron job da aggiungere.",
					},
				},
			},
			dangerZone: {
				title: "Zona pericolosa",
				description: "Le azioni in questa sezione non possono essere annullate.",
				warning: "Eliminando questa pagina di stato, il suo URL pubblico resta offline per sempre.",
				deleteDescription: "Questa azione non può essere annullata.",
			},
		},

		monitorsImport: {
			meta: { title: "Importa monitor" },
			header: { title: "Importa Monitor" },

			form: {
				sections: {
					urls: {
						title: "Cosa importare",
						description: "Incolli gli indirizzi da tenere sotto controllo, uno per riga.",
					},
					schedule: {
						title: "Ogni quanto controllare",
						description:
							"Applicato a ogni monitor creato da questa importazione. Può cambiarlo per ciascuno in seguito.",
					},
				},

				fields: {
					urls: {
						label: "URL da monitorare",
						description:
							"Un URL per riga, fino a {{limit}}. Un host semplice come esempio.com diventa https://esempio.com. Le righe vuote e le ripetizioni dello stesso indirizzo vengono ignorate.",
						placeholder: "esempio.com\nhttps://www.esempio.org/health\nstato.esempio.net",
					},
					interval: {
						label: "Intervallo di Controllo",
						description:
							"Applicato a ogni monitor di questa lista. Può cambiarlo per ciascuno in seguito.",
					},
				},
				cta: "Importa Monitor",
			},

			/**
			 * Le righe scartate, mostrate sopra il campo in cui vengono reincollate. Si apre con
			 * ciò che *è* stato creato, così un'importazione parziale non si legge come un errore.
			 */
			report: {
				section: { title: "Ultima importazione" },
				title_one: "1 monitor è stato creato. Queste righe no:",
				title_other: "{{count}} monitor sono stati creati. Queste righe no:",
				overflow_one:
					"1 altra riga è stata esclusa: un'importazione accetta {{limit}} righe per volta. Incolli le restanti per importarle.",
				overflow_other:
					"Altre {{count}} righe sono state escluse: un'importazione accetta {{limit}} righe per volta. Incolli le restanti per importarle.",
				table: {
					label: "Righe che non sono state importate",
					columns: { line: "Riga", input: "Cosa ha incollato", reason: "Perché" },
				},
				reasons: {
					invalidUrl: "Non è un URL che possiamo controllare.",
					duplicate: "Stesso indirizzo di una riga precedente.",
					tooLong: "Troppo lungo per essere un URL.",
				},
			},
		},

		httpMonitors: {
			header: {
				title: "Monitor HTTP",
				action: {
					create: "Crea Monitor",
					import: "Importa",
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
					records: "Record",
					status: "Stato",
					lastChecked: "Ultimo Controllo",
					actions: "Azioni",
				},

				records: "{{enabled}} di {{total}} monitorati",
				noRecords: "Nessuno ancora",
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
				sections: {
					basics: {
						title: "Informazioni di base",
						description: "Cosa controlla questo monitor.",
					},
					checks: {
						title: "Impostazioni di controllo",
						description: "Con quale frequenza viene risolto ogni nome tracciato.",
					},
					zoneFile: {
						title: "File di zona",
						description:
							"Incolli la sua zona per monitorare i sottodomini. Senza di essa possiamo vedere solo l'apice del suo dominio.",
					},
				},

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

					zoneFile: {
						label: "File di Zona",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"Opzionale. Incolli un file di zona BIND esportato dal suo provider DNS. Viene letto una sola volta e mai memorizzato, ed è l'unico modo con cui possiamo conoscere i nomi presenti nella sua zona.",
						limits: "Fino a {{size}} di testo e {{limit}} nomi per monitor.",
					},

					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza viene risolto ogni nome tracciato.",
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
						description: "Inizia a monitorare questo dominio immediatamente.",
					},
				},

				/** ADR-026 §14: said on the setup screen, not only in the docs. */
				apexOnlyNotice:
					"Il DNS non consente a nessuno di elencare i record di una zona. Senza un file di zona possiamo monitorare solo l'apice del suo dominio — mai un sottodominio.",

				cta: "Crea Monitor DNS",
			},
		},

		editDnsMonitor: {
			header: {
				title: "Modifica Monitor DNS",
			},

			form: {
				sections: {
					basics: {
						title: "Informazioni di base",
						description: "Cosa controlla questo monitor e con quale frequenza.",
					},
				},

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

					zoneFile: {
						label: "File di Zona",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"Opzionale. Incolli un file di zona BIND esportato dal suo provider DNS. Viene letto una sola volta e mai memorizzato, ed è l'unico modo con cui possiamo conoscere i nomi presenti nella sua zona.",
					},

					interval: {
						label: "Intervallo di Controllo",
						description: "Con quale frequenza viene risolto ogni nome tracciato.",
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
						description: "Se monitorare attivamente questo dominio.",
					},
				},

				cancel: "Annulla",
				cta: "Salva Modifiche",
			},

			zoneFileImport: {
				title: "File di zona",
				description:
					"Incolli di nuovo la sua zona per rilevare i nomi aggiunti dall'ultima importazione. Il testo viene letto una sola volta e mai memorizzato, ed è per questo che aggiornarlo significa richiederle di nuovo il file.",
				lastImported: "Ultima importazione {{date}}.",
				neverImported: "Nessun file di zona è stato importato. Questo monitor copre solo l'apice.",
				cta: "Importa File di Zona",
			},

			dangerZone: {
				title: "Zona pericolosa",
				deleteMonitor: "Elimina monitor",
				deleteDescription:
					"Questo elimina anche i suoi record e la cronologia dei controlli. Questa azione non può essere annullata.",
				description: "Le azioni in questa sezione non possono essere annullate.",
				warning:
					"Eliminando questo monitor si rimuovono definitivamente i suoi controlli DNS, la cronologia e gli avvisi.",
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
				status: "Stato",
				recordsWatched: "Record Monitorati",
				recordsWatchedValue: "{{enabled}} di {{total}}",
				zoneFileImported: "File di Zona Importato",
				zoneFileNeverImported: "Mai — solo apice",
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
			},

			results: {
				title: "Cronologia Controlli",
				empty: "Nessun controllo è stato ancora eseguito.",

				table: {
					columns: {
						checkedAt: "Controllato Il",
						status: "Stato",
						findings: "Riscontri",
						responseTime: "Query Più Lenta",
					},
				},

				findings: "{{changed}} cambiati · {{missing}} mancanti · {{new}} nuovi",
				noFindings: "Nessuna modifica",
				/** A failed query is never diffed, so a partial sweep must read as partial. */
				queriesFailed_one: "{{count}} query non ha risposto",
				queriesFailed_other: "{{count}} query non hanno risposto",
			},

			records: {
				title: "Record Tracciati",
				description:
					"Tutti i record che abbiamo mai visto per questo dominio. I record non monitorati vengono conservati per non essere mai riscoperti come nuovi.",
				empty: "Nessun record è ancora tracciato.",

				table: {
					columns: {
						name: "Nome",
						type: "Tipo",
						value: "Valore",
						source: "Origine",
						state: "Stato",
						watched: "Monitorato",
					},
				},

				source: {
					resolver: "Risolto",
					zone_file: "File di zona",
				},

				state: {
					ok: "OK",
					changed: "Cambiato",
					missing: "Mancante",
					new: "Nuovo",
					error: "Errore",
				},

				actions: {
					enable: "Monitora",
					disable: "Smetti di monitorare",
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
				title: 'Riveda i record di "{{name}}"',
				description:
					"Tutti i record trovati vengono monitorati per impostazione predefinita. Deselezioni ciò per cui non desidera ricevere avvisi — viene conservato in ogni caso, quindi nulla di ciò che esclude tornerà in seguito come record nuovo.",
			},

			/** A line the parser could not use is reported, never silently dropped. */
			unparsed: {
				title_one: "{{count}} riga non è stata importata",
				title_other: "{{count}} righe non sono state importate",
				description:
					"Queste righe non fanno parte del sottoinsieme che leggiamo. Tutto ciò che dichiarano non viene monitorato.",
				line: "Riga {{line}}: {{reason}}",

				/** One sentence per parser outcome, so each names the fix it points at. */
				reasons: {
					originDirective:
						"Cambia a quale zona appartengono i nomi che seguono, quindi non possiamo leggerla in sicurezza",
					ttlDirective: "Non teniamo traccia dei TTL",
					includeDirective: "Indica un file che non abbiamo e che non andremo a recuperare",
					generateDirective: "Si espande in molti nomi in una volta sola",
					unsupportedDirective: "Non è una direttiva che leggiamo",
					multiLineRecord: "Distribuito su più righe con le parentesi",
					blankOwnerContinuation: "Inizia con uno spazio ed eredita il nome della riga precedente",
					nonInternetClass: "Non è un record di classe internet",
					unsupportedType: "Non è uno dei sei tipi di record che monitoriamo",
					outOfZone: "Appartiene a un altro dominio",
					malformed: "Non siamo riusciti a leggerlo come record",
				},
			},

			groups: {
				resolving: {
					title: "Risolvono ora",
					description: "Trovati risolvendo ogni tipo di record supportato su ogni nome conosciuto.",
				},
				discovered: {
					title: "Scoperti di recente",
					description:
						"Si risolvono ora, ma non erano presenti all'ultima revisione. Restano non monitorati finché non li accetta, così un record comparso a sua insaputa non diventa mai un'aspettativa a suo nome.",
				},
				declared: {
					title: "Dichiarati ma non risolvono",
					description:
						"Presenti nel suo file di zona, ma oggi nessuno risponde per loro. Restano non monitorati salvo sua diversa indicazione — una zona incollata è un'istantanea, e col tempo non fa che invecchiare.",
					proxiedNote:
						"Un record dietro proxy non compare nell'esportazione della propria zona e risponde invece con l'indirizzo del proxy. In una zona con proxy questo è normale e atteso: non è il segno che qualcosa non funzioni.",
				},
			},

			/**
			 * A line repeating a record an earlier line declared. Reported apart from the
			 * rejections: nothing was lost, so calling it "not imported" would describe a
			 * complete import as a partial one.
			 */
			duplicates: {
				title_one: "{{count}} riga dichiarava un record già dichiarato da un'altra riga",
				title_other: "{{count}} righe dichiaravano record già dichiarati da altre righe",
				description:
					"Non è andato perso nulla. Il DNS risponde una sola volta a un record ripetuto, quindi è stato importato dalla prima riga che lo dichiarava.",
				line: "Riga {{line}}: {{name}} {{type}} era già dichiarato alla riga {{firstLine}}.",
			},

			/** Said at review, where the cap is enforced, rather than at check time. */
			namesCap: {
				title: "Più nomi di quanti un monitor possa monitorarne",
				description:
					"Questo monitor copre ora {{count}} nomi, mentre un controllo ne può percorrere {{limit}}. Divida la zona su più monitor affinché ogni nome continui a essere controllato.",
			},

			/** Column headings match the monitor's own record list, so both screens read alike. */
			table: {
				columns: {
					watched: "Monitorato",
					name: "Nome",
					type: "Tipo",
					value: "Valore",
				},

				/** Each box names the record it decides, since the column heading is not read per row. */
				watchRecord: "Monitora {{name}} {{type}}",
			},

			empty: "Non è stato trovato nulla per questo dominio.",
			cancel: "Annulla",
			cta: "Salva Record",
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
				sections: {
					coverage: {
						title: "Ambito",
						description: "Assegni un nome a questa finestra e scelga a quali monitor si applica.",
					},
					schedule: {
						title: "Pianificazione",
						description: "Quando inizia e finisce la finestra di manutenzione.",
					},
					behavior: {
						title: "Comportamento",
						description: "Cosa succede mentre la finestra è attiva e se si ripete.",
					},
				},

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
				sections: {
					coverage: {
						title: "Cosa comprende",
						description: "Assegni un nome a questa finestra e scelga a quali monitor si applica.",
					},
					schedule: {
						title: "Pianificazione",
						description: "Quando inizia e finisce la finestra di manutenzione.",
					},
					behavior: {
						title: "Durante la manutenzione",
						description:
							"Come si comportano gli avvisi e la sua pagina di stato mentre la finestra è attiva.",
					},
					recurrence: {
						title: "Ricorrenza",
						description:
							"Ripeta questa finestra secondo una pianificazione invece di eseguirla una sola volta.",
					},
				},
			},

			endNow: {
				cta: "Termina manutenzione ora",
				title: "Termina questa finestra",
				description: "Questa finestra è attiva in questo momento.",
				warning:
					"Terminandola ora si ripristinano gli avvisi e si rimuove la notifica di manutenzione dalla sua pagina di stato. La finestra viene comunque conservata.",
			},

			danger: {
				title: "Zona pericolosa",

				description: "Azioni irreversibili per questa finestra di manutenzione.",
				warning: "L'eliminazione di questa finestra di manutenzione non può essere annullata.",
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
				sections: {
					basics: {
						title: "Informazioni di base",
						description: "Come si chiama questo avviso e quali monitor controlla.",
					},
					channel: {
						title: "Canale di notifica",
						description:
							"Dove viene inviata la notifica. Sono obbligatori solo i campi del canale scelto.",
					},
					delivery: {
						title: "Regole di invio",
						description:
							"Se i ripristini vengono annunciati e con quale frequenza si ripete l'invio mentre un monitor è ancora non attivo.",
					},
				},

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
				sections: {
					basics: {
						title: "Cosa controlla",
						description:
							"Assegni un nome a questo avviso e scelga se copre tutti i monitor o soltanto uno.",
					},
					channel: {
						title: "Come notifica",
						description: "Scelga un canale e indichi la destinazione a cui inviare.",
					},
					delivery: {
						title: "Regole di invio",
						description:
							"Controlli le notifiche di ripristino e con quale frequenza un avviso può ripetersi durante un'interruzione.",
					},
				},
			},

			danger: {
				title: "Zona pericolosa",

				description: "Azioni irreversibili per questo avviso.",
				warning:
					"Eliminando questo avviso si interrompono tutte le notifiche che invia. Questa azione non può essere annullata.",
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

		trial: {
			/**
			 * Il rapporto come pagina a sé, raggiungibile con il token della sorveglianza. Ogni
			 * valore è calcolato dai controlli registrati, quindi ognuno ha accanto una formula
			 * per "ancora niente da riportare": una sorveglianza senza alcun controllo completato
			 * mostra un trattino e spiega perché, e non afferma mai "nessun incidente", perché
			 * nessuno ha ancora guardato.
			 */
			report: {
				meta: {
					title: "Il rapporto sullo stato del suo sito in {{days}} giorni — Uptime",
					description:
						"L'uptime, i controlli e gli incidenti che abbiamo registrato sul suo sito nella sua settimana di monitoraggio gratuito.",
				},
				eyebrow: "Rapporto sullo stato in {{days}} giorni",
				period: "Monitorato dal {{start}} al {{end}} ({{zone}})",
				bar: {
					caption: "Un blocco al giorno su {{days}} giorni, dal più vecchio al più recente.",
					status: {
						up: "Attivo tutto il giorno",
						degraded: "Lento almeno una volta",
						down: "Non raggiungibile almeno una volta",
						noData: "Nessun controllo in questo giorno",
					},
				},
				summary: {
					title: "Cosa abbiamo registrato",
					uptime: "Uptime",
					checks: "Controlli completati",
					healthy: "Controlli completamente regolari",
					noChecks:
						"Nessun controllo è ancora stato completato, quindi non c'è nulla da riportare su questo URL. Il primo controllo orario parte un'ora dopo l'avvio della sorveglianza.",
				},
				incidents: {
					title: "Incidenti",
					unknown:
						"Nessun controllo è ancora stato completato, quindi non possiamo dire se questo URL abbia avuto un incidente.",
					none_one: "Nessun incidente: l'unico controllo completato ha risposto come previsto.",
					none_other:
						"Nessun incidente: tutti i {{count}} controlli completati hanno risposto come previsto.",
					summary_one: "Un incidente.",
					summary_other: "{{count}} incidenti.",
					entry_one: "Primo guasto rilevato {{started}} — un controllo è fallito.",
					entry_other:
						"Primo guasto rilevato {{started}} — {{count}} controlli consecutivi sono falliti.",
				},
				timing: {
					title: "Tempi di risposta",
					fastest: "Il più rapido",
					average: "Media",
					slowest: "Il più lento",
					basis_one: "Misurato sull'unico controllo che ha risposto.",
					basis_other: "Misurato sui {{count}} controlli che hanno risposto.",
				},
				cta: {
					title: "Continui a monitorare questo sito per {{price}}/mese",
					action: "Inizi a monitorare",
					convertible: {
						body: "Acceda e trasformeremo questo URL in un monitor vero, con lo storico qui sopra riportato al suo interno.",
					},
					expired: {
						body: "Questa settimana gratuita ha superato la finestra per il riscatto, quindi lo storico qui sopra resta qui — ma può iniziare a monitorare questo URL per davvero quando vuole.",
					},
					converted: {
						title: "Questo URL è già sotto monitoraggio",
						body: "Ha trasformato questo obiettivo in un monitor, quindi ora viene controllato secondo la sua frequenza.",
						action: "Apri la sua dashboard",
					},
				},
			},

			meta: {
				title: "Rapporto gratuito sullo stato del sito in {{days}} giorni — Uptime",
				description:
					"Controlliamo il suo sito adesso, poi ogni ora per {{days}} giorni, e Le inviamo per email quello che abbiamo trovato. Senza account, senza carta.",
			},

			heading: "Un rapporto gratuito sullo stato del suo sito in {{days}} giorni",
			intro:
				"Ci dia un URL e lo controlliamo subito dalla nostra rete: lo stesso controllo che esegue un monitor a pagamento. Ci lasci poi una email e continuiamo a controllarlo ogni ora per {{days}} giorni, poi Le inviamo il rapporto.",

			form: {
				url: {
					label: "URL da controllare",
					description: "Un indirizzo http:// o https:// sulla rete pubblica.",
					placeholder: "https://esempio.com",
				},
				submit: "Esegui il primo controllo",
			},

			refusal: {
				title: "Il controllo non è stato eseguito",
				blockedTarget:
					"Quello non è un indirizzo che controlliamo per suo conto. Deve essere un URL http:// o https:// pubblico, sulla porta 80 o 443, senza nome utente né password, e deve risolvere a un indirizzo sulla rete aperta.",
				challengeIncomplete: "Completi la verifica e potremo eseguire il controllo.",
				failedChallenge:
					"Non siamo riusciti a confermare che la richiesta arrivasse da un browser. Ricarichi la pagina e riprovi.",
				rateLimited: "Può eseguire un altro controllo tra un minuto.",
				rateLimitedFor: "Può eseguire un altro controllo tra {{seconds}} secondi.",
				budgetExhausted:
					"Abbiamo già eseguito tutti i controlli gratuiti che facciamo in un giorno. Dipende da noi, non dal suo URL: torni domani, oppure inizi a monitorare e lo controlleremo ogni minuto.",
				unavailable:
					"Qualcosa dalla nostra parte ha impedito al controllo di partire, quindi non abbiamo scoperto nulla sul suo URL. È un problema nostro, non suo. Riprovi fra poco.",
			},

			result: {
				checkAnother: "Controlla un altro URL",
				noResponse: "Nessuna risposta",
				httpStatus: "HTTP {{status}}",
				milliseconds: "{{value}} ms",
				checkedAt: "Controllato il {{time}}",

				redirect: {
					badge: "Reindirizza",
					title: "Questo URL reindirizza altrove",
					description:
						"Ha risposto, e la risposta ci indicava un altro indirizzo. Non ci siamo andati: controlliamo solo l'URL che ci ha dato, ed è questo che impedisce a questo campo di servire per raggiungere posti dove non dovrebbe. Controlli invece la destinazione e ne otterrà un risultato reale.",
					destination: "Punta a {{url}}",
					action: "Controlla quello",
					unknownDestination:
						"Non abbiamo letto dove punta. Apra l'URL in un browser, guardi dove arriva e controlli qui quell'indirizzo.",
				},

				status: {
					up: "Attivo",
					degraded: "Lento",
					down: "Non raggiungibile",
				},
			},

			lead: {
				title: "Riceva il rapporto gratuito in {{days}} giorni",
				description:
					"Il controllo che ha appena visto era il primo. Ci lasci una email e andiamo avanti, poi Le raccontiamo cosa hanno rilevato {{days}} giorni di controlli.",
				consent: "Scrivetemi ogni tanto anche di Uptime.",
				consentNote: "In ogni caso i controlli li riceve.",
				promise:
					"Ogni email contiene un link che con un clic le ferma e cancella il suo indirizzo.",
				submit: "Avvia il rapporto gratuito in {{days}} giorni",

				/**
				 * Ciò a cui un visitatore acconsente, indicato accanto al campo e non dopo. Ogni
				 * riga è qualcosa che il sistema fa davvero — l'indirizzo è quello che abbiamo
				 * appena sondato e non uno che si possa riscrivere, la frequenza e la durata sono
				 * quelle della sorveglianza stessa, e le tre email citate sono le tre che esistono.
				 */
				expectations: {
					target:
						"Continuiamo a controllare {{url}} — esattamente l'indirizzo che abbiamo appena controllato, e nient'altro.",
					cadence: "Una volta all'ora, ogni ora, per {{days}} giorni.",
					emails:
						"Un riepilogo al giorno, un avviso quando lo stato cambia, e il rapporto completo alla fine.",
					noAccount: "Nessuna carta, nessuna password, nessun account da creare.",
				},

				email: {
					label: "Email",
					placeholder: "lei@esempio.com",
					error: "Non sembra un indirizzo email.",
				},
			},

			monitor: {
				title: "Continui a tenere d'occhio questo URL",
				description:
					"Trasformi questo singolo controllo in un monitor: lo stesso controllo alla frequenza che sceglie, con un avviso appena qualcosa cambia.",
				subscribeDescription:
					"Trasformi questo singolo controllo in un monitor: lo stesso controllo alla frequenza che sceglie, con un avviso appena qualcosa cambia. Partirà non appena il suo abbonamento sarà attivo.",
				create: "Crea un monitor per questo URL",
				subscribe: "Attiva il suo abbonamento",
			},

			watching: {
				title: "Ci pensiamo noi",
				description:
					"Il primo controllo orario di {{url}} parte fra un'ora, e continuiamo a controllarlo per {{days}} giorni. Una copia del controllo appena eseguito è già nella sua casella di posta.",
			},

			repeated: {
				title: "Questo l'abbiamo già controllato",
				description:
					"{{url}} ha già avuto il suo rapporto gratuito con una richiesta precedente: ogni URL ne ha uno ogni 30 giorni. Le abbiamo inviato per email tutto quello che quei controlli hanno rilevato, quindi non è stato avviato niente di nuovo.",
			},

			benefits: {
				title: "Cosa contiene il rapporto",
				description:
					"Tutto quello che un monitor a pagamento Le direbbe su questo URL, gratis, per {{days}} giorni.",

				list: {
					hourly: {
						title: "Un controllo ogni ora",
						description:
							"Per {{days}} giorni, dalla stessa rete su cui gira un monitor a pagamento.",
					},
					changes: {
						title: "Una email quando cambia",
						description:
							"Va giù o torna su, lo viene a sapere. Al massimo una al giorno, così un sito instabile non La sommerge.",
					},
					digest: {
						title: "Un riepilogo al giorno",
						description:
							"Come ha retto il suo URL, a colpo d'occhio — e tutti i {{days}} giorni in un unico rapporto alla fine.",
					},
					noAccount: {
						title: "Niente account, niente carta",
						description: "Niente da registrare, e un clic ferma tutto per sempre.",
					},
				},
			},

			more: {
				title: "Non solo siti web",
				description:
					"Il rapporto gratuito copre l'HTTP. Con un account a pagamento teniamo d'occhio altre tre cose per Lei.",

				list: {
					tcp: {
						title: "TCP",
						description:
							"Sapere che una porta risponde ancora, per tutto ciò che non è un sito: database, server di posta, server di gioco.",
					},
					dns: {
						title: "DNS",
						description:
							"Sapere che un record punta ancora dove deve, così un dirottamento o una modifica sbagliata non passa inosservata.",
					},
					cron: {
						title: "Job pianificati",
						description:
							"Sapere che il backup notturno è finito, e scoprirlo la notte in cui non lo è.",
					},
				},
			},

			cta: {
				badge: "Quando il rapporto finisce",
				title: "Continui a monitorare questo sito per {{price}} al mese",
				description:
					"Registrandosi questo URL diventa un monitor vero e il suo storico dei controlli viene trasferito, così nulla ricomincia da zero. Un controllo ogni minuto invece che ogni ora, tutti gli URL che vuole, avvisi dove già lavora, pagine di stato e un anno di storico.",
				action: "Continui a monitorare questo sito",
				pricing: "Vedi i prezzi",
			},
		},

		unsubscribe: {
			confirm: {
				title: "Fermare queste email?",
				body: "Questo termina ogni controllo richiesto da quell'indirizzo e cancella l'indirizzo insieme a tutto ciò che vi è collegato. Non resta nulla, quindi non c'è nulla da annullare, ma puoi ricominciare dal nostro sito quando vuoi.",
				cta: "Sì, ferma e cancella",
			},

			done: {
				title: "Iscrizione annullata",
				body: "Quell'indirizzo non è più nella nostra lista e i controlli che aveva richiesto sono fermi. Non gli verrà inviato altro. Puoi ricominciare dal nostro sito quando vuoi.",
				cta: "Torna al sito",
			},
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

			emails: {
				title: "Email",
				description: "Scelga quali email inviarLe.",

				card: {
					title: "Notifiche via email",
					description:
						"Si applicano a tutti i team di cui è membro. Avvisi e inviti non sono interessati.",
				},

				list: {
					teamDailyDigest: {
						name: "Riepilogo giornaliero dei monitor",
						description:
							"Ogni mattina, una email per team con lo stato di ciascuno dei suoi monitor nel giorno precedente.",
					},
					teamWeeklyDigest: {
						name: "Riepilogo settimanale dei monitor",
						description:
							"Il lunedì, lo stesso rapporto sugli ultimi sette giorni, con la disponibilità della settimana giorno per giorno.",
					},
				},

				form: {
					cta: "Salva Email",
				},
			},

			teams: {
				title: "I suoi team",
				description: "I team di cui fa parte.",

				actions: {
					createTeam: "Crea team",
				},

				empty: {
					title: "Nessun team",
					description: "Crei un team per iniziare a monitorare i suoi servizi.",
					cta: "Crea team",
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
						leave: "Esci dal team",
					},

					confirmation: {
						leaveTeam: "È sicuro di voler uscire da {{name}}?",
					},
				},
			},

			dataExport: {
				title: "I suoi dati",
				description: "Scarichi tutto ciò che questa applicazione conserva su di Lei.",

				card: {
					title: "Esporti i suoi dati",
					description:
						"Un unico file JSON, generato nel momento in cui lo richiede. Non viene conservato nulla.",
					includes:
						"Include il suo profilo e le sue preferenze, ogni team di cui fa parte e il suo ruolo al suo interno e — per i team di cui è proprietario — i loro monitor, avvisi, finestre di manutenzione, pagine di stato e domini verificati.",
					excludes:
						"Esclude tutto ciò che non è suo da portare via: i dati degli altri membri, gli indirizzi degli invitati, gli hash delle chiavi API, i segreti dei webhook e gli URL dei webhook di Slack o Discord. Anche lo storico dei controlli è escluso: è prodotto dalla configurazione di cui sopra, e il file lo dichiara.",
				},

				form: {
					cta: "Scarica JSON",
				},
			},

			deleteAccount: {
				title: "Elimina Account",
				description: "Chiuda il suo account ed elimini i dati che vi stanno dietro.",

				queued: {
					title: "Eliminazione richiesta",
					description:
						"Il suo account è in coda per l'eliminazione e non è stato eliminato ancora nulla. L'operazione viene eseguita entro un giorno e Le invieremo un'email quando sarà avvenuta. Può ancora fermarla: annulli qui sotto in qualsiasi momento prima che venga eseguita.",
					requestedAt: "Richiesta il {{date}}.",
					cta: "Annulla eliminazione",
				},

				card: {
					title: "Elimini il suo account",
					description:
						"Mette il suo account in coda per l'eliminazione. Inviando questo modulo non viene eliminato nulla.",

					whatHappens:
						"La sua richiesta viene messa in coda e Lei viene disconnesso. Entro un giorno disdiciamo il suo abbonamento, eliminiamo i suoi dati e Le inviamo un'email per confermare che è tutto fatto. Fino a quel momento non è andato perso nulla, e accedendo di nuovo può annullare.",

					noOwnedTeams:
						"Non è proprietario di alcun team, quindi verranno rimosse solo le sue iscrizioni e le sue preferenze. I team di cui fa parte proseguono senza di Lei.",

					ownedTeamsIntro:
						"In questa applicazione non c'è modo di cedere un team a qualcun altro, quindi ogni team di cui è proprietario viene eliminato insieme al suo account, insieme ai suoi monitor, avvisi, pagine di stato, chiavi API e membri:",
					ownedTeam_one: "{{name}} — 1 altro membro perde l'accesso.",
					ownedTeam_other: "{{name}} — {{count}} altri membri perdono l'accesso.",
					ownedTeamAlone: "{{name}} — nessun altro membro.",

					othersWarning_one:
						"1 altra persona perderà l'accesso a un team quando questa operazione verrà eseguita. Non le verrà chiesto nulla e non verrà avvisata.",
					othersWarning_other:
						"{{count}} altre persone perderanno l'accesso ai loro team quando questa operazione verrà eseguita. Non verrà chiesto loro nulla e non verranno avvisate.",

					retained: {
						intro: "Alcune cose non possono essere eliminate, e preferiamo dirlo:",
						billing:
							"Le fatture e le registrazioni dei pagamenti conservate dal nostro fornitore di fatturazione: la normativa fiscale ne impone la conservazione.",
						analytics:
							"I risultati dei controlli di monitoraggio nel nostro archivio analitico, che è a sola aggiunta: i record scadono secondo un periodo di conservazione e non possono essere eliminati in anticipo.",
						logs: "I log delle richieste al server, che scadono secondo lo stesso tipo di periodo.",
						identity:
							"La sua identità di accesso, che appartiene al provider di identità con cui effettua l'accesso e non a noi.",
					},

					confirmation: {
						label: 'Scriva "DELETE" per confermare',
						placeholder: "DELETE",
					},

					cta: "Metti in coda l'eliminazione dell'account",
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
				sections: {
					basics: {
						title: "Informazioni di base",
						description: "Cosa controlla questo monitor e con quale frequenza.",
					},
				},

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
				sections: {
					settings: {
						title: "Impostazioni del monitor",
						description: "A cosa si connette questo monitor e con quale frequenza controlla.",
					},
				},

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
				sectionDescription: "Le azioni in questa sezione non possono essere annullate.",
				warning:
					"Eliminando questo monitor si rimuovono definitivamente i suoi controlli, la cronologia e gli avvisi.",
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

				sections: {
					details: {
						title: "Dettagli della chiave",
						description:
							"Dia un nome alla chiave per riconoscerla in seguito e decida quando deve smettere di funzionare.",
					},
				},

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
				sections: {
					basics: {
						title: "Informazioni di base",
						description: "Come si chiama questo job e cosa fa.",
					},
					schedule: {
						title: "Pianificazione",
						description:
							"Quando ci si aspetta che il job venga eseguito e quanto può ritardare prima di essere considerato mancato.",
					},
					alerting: {
						title: "Avvisi",
						description: "Cosa succede quando un'esecuzione attesa non arriva.",
					},
				},

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
				sections: {
					basics: {
						title: "Informazioni di base",
						description: "Come si chiama questo job e cosa fa.",
					},
					schedule: {
						title: "Pianificazione",
						description:
							"Quando ci si aspetta che il job venga eseguito e quanto può ritardare prima di essere considerato mancato.",
					},
					alerting: {
						title: "Avvisi",
						description: "Cosa succede quando un'esecuzione attesa non arriva.",
					},
				},

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

				description: "Le azioni in questa sezione non possono essere annullate.",
				warning:
					"Eliminando questo cron job si rimuovono definitivamente la cronologia dei ping e i suoi avvisi.",
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
				gracePeriodValue: "{{duration}} di grazia",
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
				snippet: {
					curl: "Da uno script",
					copyCurl: "Copia il comando",
					crontab: "Dalla crontab",
					copyCrontab: "Copia la riga di crontab",
				},
				apiKey: {
					text: "Senza una chiave con quell'ambito il ping viene rifiutato con un 401 e l'esecuzione conta comunque come persa.",
					cta: "Crea una chiave API",
				},
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

	docs: {
		meta: {
			title: "Documentazione - Uptime",
			description:
				"Documentazione del servizio di monitoraggio Uptime. Scopra come usare monitor, avvisi, pagine di stato e altro ancora.",
		},

		header: {
			cta: {
				in: "Apri Dashboard",
				out: "Inizia il Monitoraggio",
			},
		},

		sidebar: {
			title: "Documentazione",
			description: "Guide e riferimento",
			searchPlaceholder: "Cerca...",
			openMenu: "Apri menu",
			closeMenu: "Chiudi menu",
		},

		nav: {
			gettingStarted: "Per iniziare",
			overview: "Panoramica",
			quickstart: "Guida rapida",

			api: "Riferimento API",
			apiOverview: "Panoramica API",
			authentication: "Autenticazione",
			errors: "Errori",

			resources: "Risorse",
			monitors: "Monitor",
			dnsMonitors: "Monitor DNS",
			tcpMonitors: "Monitor TCP",
			cronJobs: "Cron Job",
			alerts: "Avvisi",
			statusPages: "Pagine di stato",
		},

		error: {
			title: "Errore nella documentazione",
			description: "Si è verificato un errore nel caricamento di questa pagina di documentazione.",
			notFoundTitle: "Pagina non trovata",
			notFoundDescription: "La pagina di documentazione che sta cercando non esiste.",
		},

		lastUpdated: "Ultimo aggiornamento: {{date}}",
	},
};
