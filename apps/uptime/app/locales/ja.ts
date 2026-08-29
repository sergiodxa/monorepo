/**
 * Japanese (ja) translation dictionary for the Uptime app. It maps every UI copy key
 * to its Japanese string across the landing page, dashboard, monitors, alerts, teams,
 * domains, status pages, and toast/error messages. It exists so the interface can be
 * rendered in Japanese, mirroring the shape of the English base dictionary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ApiKeyScope } from "~/database/schema";

export default {
	landing: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "開発者向けのシンプルで信頼性の高いUptime監視",
		},

		header: {
			title: "Uptime",

			nav: {
				pricing: "料金",
				features: "機能",
				compare: "比較",
				docs: "ドキュメント",

				cta: {
					in: "ダッシュボードを開く",
					out: "監視を始める",
				},
			},
		},

		try: {
			title: "任意の URL を無料でチェック",
			description:
				"アカウントは不要です。1 回チェックを実行し、モニターが報告する内容をそのままお見せします。",
			label: "URL をチェック",
			placeholder: "https://example.com",
			submit: "チェックを実行",
		},

		hero: {
			pill: "稼働時間監視",
			title: "安心してサービスを<strong>監視</strong>",
			description:
				"ウェブサイトやAPIがダウンした時に即座にアラートを受け取れます。簡単にウェブサイトやAPIを監視できます。",

			cta: {
				in: "ダッシュボードを開く",
				out: "監視を始める",
				pricing: "料金を見る",
				try: "{{days}}日間無料でモニタリング",
			},

			try: {
				label: "URL をチェック",
				placeholder: "https://example.com",
				submit: "チェックを実行",
			},
			screenshot: {
				alt: "Uptimeダッシュボードのスクリーンショット。サイドバーにはHTTP・DNS・TCPモニター、cronジョブ、アラート、メンテナンス、ステータスページが並び、月間ping使用量・全体のUptime率・最も遅いエンドポイントの概要カード、種類ごとの稼働中および停止中のモニター数、そしてレイテンシ推移のスパークラインとステータスバッジを備えたHTTPモニターの一覧表が表示されています",
			},

			trustIndicators: {
				freeToStart: "無料で開始",
				payForAutomation: "自動化に課金",
				cancelAnytime: "いつでもキャンセル可能",
			},
		},

		trustIndicators: {
			monitorTypes: "モニタータイプ",
			globalRegions: "グローバルリージョン",
			daysDataRetention: "日間データ保持",
			minCheckInterval: "最短チェック間隔",
		},

		/**
		 * The three things that stay true however much somebody ends up monitoring. Price
		 * and allowance values are interpolated from `~/app/lib/pricing.ts`, so they move
		 * automatically with pricing; `app/lib/public-claims.ts` enforces that at build time.
		 */
		benefits: {
			badge: "Uptime を選ぶ理由",
			title: "1 つのプランに、すべてのチェック。数える必要はありません",
			description: "どれだけ監視を増やしても変わらない 3 つのことです。",

			list: {
				everythingIncluded: {
					title: "すべて込み",
					description:
						"HTTP、DNS、TCP、SSL のチェック、cron ジョブのハートビート、アラート、ステータスページ。1 つのプランにすべて含まれ、追加オプションとして別売りするものはありません。",
				},
				noMonitorMath: {
					title: "モニター数の計算は不要",
					description:
						"モニターもチームメンバーも無制限です。見守りたいものをすべて追加し、見る必要のある人を全員招待できます。",
				},
				payForUsage: {
					title: "実際に使った分だけお支払い",
					description:
						"月 {{price}} に {{included}} 回のチェックが含まれます。それを超えた分は、実際に実行したチェックの分だけをお支払いいただきます。それ以外の費用はありません。",
				},
			},
		},

		features: {
			title: "シンプルで強力な監視",
			description:
				"サービスをスムーズに稼働させるために必要なすべてを、不必要な複雑さなしに提供します。",
			badge: "機能",
			learnMore: "詳細を見る",

			list: {
				first: {
					title: "Uptimeを監視",
					description:
						"9つのリージョンから、1分間隔で24時間365日サービスを追跡します。詳細なメトリクスとパフォーマンスのインサイトを一目で確認できます。",
				},
				second: {
					title: "どこでもアラートを受信",
					description:
						"サービスがダウンタイムやパフォーマンスの問題を経験した時に、メール、Slack、Discord、またはwebhookを通じて即座に通知を受け取れます。",
				},
				third: {
					title: "使った分だけ支払い",
					description:
						"隠れた料金のない透明な価格設定。必要に応じてスケールアップまたはダウンでき、監視ニーズに合わせて成長するプランです。",
				},
				fourth: {
					title: "ステータスページ",
					description:
						"ユーザーにサービスの可用性とインシデントを通知するための美しい公開ステータスページを作成できます。",
				},
				fifth: {
					title: "SSL監視",
					description:
						"証明書の有効期限を追跡し、SSL証明書が期限切れになる前にアラートを受け取ることで、セキュリティ警告を防ぎます。",
				},
				sixth: {
					title: "DNS監視",
					description:
						"DNSレコードの変更や伝播の問題がユーザーに影響を与える前、またはハイジャックされる前に検出します。",
				},
				seventh: {
					title: "ネイティブ統合",
					description:
						"基本的なwebhookだけでなく、リッチな通知を備えたSlackとDiscordの直接統合を提供します。",
				},
			},
		},

		completeFeatureSet: {
			badge: "完全な機能セット",
			title: "信頼性の高い監視に必要なすべて",
			description: "監視を簡単かつ包括的にする高度な機能。",

			list: {
				maintenanceWindows: {
					title: "メンテナンスウィンドウ",
					description: "計画されたメンテナンス中のダウンタイムをスケジュールし、アラートを抑制",
				},
				contentMonitoring: {
					title: "コンテンツ監視",
					description: "ページに特定のキーワードやコンテンツが表示されているかを確認",
				},
				recoveryAlerts: {
					title: "復旧アラート",
					description: "インシデント後にサービスが復旧した時に通知を受け取る",
				},
				apiAccess: {
					title: "APIアクセス",
					description: "自動化のためのキー管理を備えた完全なREST API",
				},
				alertCooldowns: {
					title: "アラートクールダウン",
					description: "設定可能なクールダウン期間でアラート疲れを防止",
				},
				customHeaders: {
					title: "カスタムヘッダー",
					description: "認証ヘッダーとカスタムリクエストパラメータを追加",
				},
				cronMonitoring: {
					title: "Cronジョブ監視",
					description:
						"スケジュールされたジョブとバックグラウンドタスクをハートビートチェックで監視",
				},
			},
		},

		useCases: {
			badge: "ユースケース",
			title: "あらゆる監視ニーズに対応",
			description: "シンプルなヘルスチェックから複雑な分散システムまで、すべてをカバーします。",
			learnMore: "詳細を見る",
			tailoredFor: "対象ソリューション：",

			list: {
				websiteMonitoring: {
					title: "ウェブサイト監視",
					description:
						"ランディングページ、ブログ、ウェブアプリケーションのアップタイムとパフォーマンスを追跡。",
				},
				apiMonitoring: {
					title: "API監視",
					description: "REST API、GraphQLエンドポイント、webhookの可用性を監視。",
				},
				saas: {
					title: "SaaSアプリケーション",
					description: "プロアクティブな監視と即座のアラートでSaaS製品の信頼性を維持。",
				},
				microservices: {
					title: "マイクロサービス",
					description: "分散システムを監視し、障害がカスケードする前にキャッチ。",
				},
				healthChecks: {
					title: "ヘルスチェック",
					description: "スケジュールされたpingでサービスの状態とデータベース接続を確認。",
				},
				ecommerce: {
					title: "Eコマース",
					description: "チェックアウトフロー、決済API、商品ページを監視して収益を保護。",
				},
			},

			audiences: {
				indieHackers: "インディーハッカー",
				soloDevelopers: "ソロ開発者",
				startups: "スタートアップ",
				agencies: "代理店",
				enterprises: "エンタープライズ",
				devops: "DevOps",
			},
		},

		pricing: {
			badge: "料金",
			title: "シンプルで透明な料金",
			description:
				"単一のサブスクリプション、階層なし。わかりやすい料金モデルで使った分だけお支払い",

			howItWorks: {
				title: "料金の仕組み",

				list: {
					first: {
						title: "基本サブスクリプション",
						description: "月額{{price}}で最初の{{included}}回のpingを含む",
					},

					second: {
						title: "追加ping",
						description: "以降は{{blockSize}}pingごとに{{blockPrice}}（ブロック単位での課金）",
					},

					third: {
						title: "隠れた料金なし",
						description:
							"機能や統合に追加料金はかかりません。使用したpingの分だけお支払いください。",
					},
				},
			},

			calculator: {
				title: "料金計算機",
				description: "監視ニーズに基づいて月額コストを計算",

				add: "モニターを追加",

				monitor: {
					label: "モニターの頻度",
					delete: "削除",
					frequency: {
						lower: "1分",
						upper: "60分",
					},
				},

				stats: {
					pingsPerMonth: "月間ping数：",
					baseSubscription: "基本サブスクリプション",
					includes: "最初の{{amount}}回のpingを含む",
					additionalPings: "追加ping：",
					additionalPingsCost:
						"{{blocks}} × {{blockSize}}pingあたり{{blockPrice}}（超過{{pings}}）",
					totalCost: "月額合計：",
				},
			},
		},

		faq: {
			badge: "FAQ",
			title: "よくある質問",
			description: "Uptimeに関するよくある質問への回答",

			list: {
				first: {
					q: "Uptimeはどのようにサービスを監視しますか？",
					a: "Uptimeはエンドポイントに定期的なHTTPまたはHTTPSリクエストを送信します。レスポンスコードとレスポンス時間をチェックして、サービスが利用可能で応答しているかを判断します。",
				},

				second: {
					q: "障害が検出されるとどうなりますか？",
					a: "Uptimeが障害を検出すると、設定されたチャネルを通じて即座にアラートを送信します。",
				},

				third: {
					q: "内部サービスを監視できますか？",
					a: "はい、内部サービスがインターネットからアクセス可能であれば監視できます。リクエストを認証するためにカスタムヘッダーを設定することもできます。",
				},

				fourth: {
					q: "どのように始めればいいですか？",
					a: "サインアップして、最初のモニターを作成し、アラート設定を行うだけです。1分以内に稼働を開始できます。",
				},

				fifth: {
					q: "無料プランはありますか？",
					a: "はい！無制限のモニターを作成し、手動でpingをトリガーすることが永久に無料でできます。スケジュールされた自動監視にはサブスクリプションが必要です。",
				},

				sixth: {
					q: "pingデータはどのくらいの期間保存されますか？",
					a: "ping結果は365日間保存されます。その後、自動的に削除されます。",
				},

				seventh: {
					q: "認証が必要なサービスを監視できますか？",
					a: "はい。トークンや認証情報を含むカスタムヘッダーを設定してリクエストを認証できます。",
				},

				eighth: {
					q: "複数のURLを監視できますか？",
					a: "はい。各URLに対して別々のモニターを作成するだけです。各モニターは独自のチェック頻度、HTTPメソッド、期待されるステータスコードなどを持つことができます。",
				},

				ninth: {
					q: "APIを監視できますか？",
					a: "もちろんです。UptimeはウェブサイトとAPIの両方を監視するように設計されています。エンドポイント、メソッド、ヘッダー、期待されるレスポンスを設定して、APIを効果的に監視できます。",
				},

				tenth: {
					q: "各pingにタイムアウトを設定できますか？",
					a: "はい。各モニターにタイムアウトを設定できます。レスポンスが予想より長くかかった場合、失敗として扱われます。これにより遅いサービスを検出できます。",
				},

				eleventh: {
					q: "モニターを一時的に停止または無効にできますか？",
					a: "はい。いつでも任意のモニターを個別に一時停止できます。",
				},

				twelfth: {
					q: "モニター作成直後にテストできますか？",
					a: "はい。モニターを作成した直後にpingが自動的にトリガーされます。",
				},

				thirteenth: {
					q: "ステータスページに対応していますか？",
					a: "はい！ユーザーとサービスの状態を共有するためのカスタマイズ可能な公開ステータスページを作成できます。任意のモニターを含め、ブランディングを追加できます。",
				},

				fourteenth: {
					q: "過去のパフォーマンストレンドを見ることができますか？",
					a: "すべての過去の結果を保存しているので、完全な履歴を取得できます。パフォーマンストレンドチャートは将来のリリースで予定されています。",
				},

				fifteenth: {
					q: "どのアラートチャネルに対応していますか？",
					a: "メール、Slack、Discord、webhookに対応しています。ネイティブ統合により、チームが既に使用している場所でアラートを簡単に受け取れます。webhookを使用して他のサービスに接続することもできます。",
				},

				sixteenth: {
					q: "チームや共有モニターに対応していますか？",
					a: "はい！各ユーザーはチームから始まります。異なる役割（オーナー、管理者、メンバー）でチームメンバーを招待できます。ドメイン自動プロビジョニングにより、確認済みの会社メールドメインを持つユーザーが自動的に追加されます。",
				},

				seventeenth: {
					q: "プランの制限を超えるとどうなりますか？",
					a: "サブスクリプションに含まれる{{included}}回を超える利用は、{{blockSize}}pingのブロック単位で1ブロックあたり{{blockPrice}}が課金されます（1回の超過でも1ブロック分）。",
				},

				eighteenth: {
					q: "リクエストやレスポンスのボディを保存していますか？",
					a: "いいえ。ボディデータは一切保存しません。プライバシーと効率性を高めるために、`HEAD`メソッドの使用をお勧めします。",
				},

				nineteenth: {
					q: "どのリージョンからサービスを監視できますか？",
					a: "Uptimeは複数のリージョンからの監視に対応しています：アフリカ、アジア太平洋、東ヨーロッパ、西ヨーロッパ、東北アメリカ、西北アメリカ、中東、オセアニア、南アメリカ。\n\nモニターごとに1つのリージョンを選択できます。リージョンはヒントとして扱われ、実際のpingはそのリージョン内またはその近くのサーバーから発信されます。",
				},
			},
		},

		footer: {
			name: "Uptime",
			description: "ウェブサイトとAPIのためのシンプルで信頼性の高い監視。",
			copyright: "© {{year}} Uptime by Sergio Xalambrí. All rights reserved.",
			sections: {
				product: {
					title: "製品",
					features: "機能",
					pricing: "料金",
					faq: "よくある質問",
				},
				features: {
					title: "機能",
					monitors: "モニター",
					alerts: "アラート",
					statusPages: "ステータスページ",
					ssl: "SSL監視",
					dns: "DNS監視",
					cronJobs: "Cronジョブ監視",
					contentMonitoring: "コンテンツ監視",
					maintenance: "メンテナンスウィンドウ",
					integrations: "インテグレーション",
					teams: "チーム",
					analytics: "分析",
					api: "APIアクセス",
				},
				useCases: {
					title: "ユースケース",
					websiteMonitoring: "ウェブサイト監視",
					apiMonitoring: "API監視",
					saas: "SaaSアプリケーション",
					ecommerce: "Eコマース",
					cronJobs: "Cronジョブ監視",
					microservices: "マイクロサービス",
					healthChecks: "ヘルスチェック",
				},
				solutions: {
					title: "ソリューション",
					indieHackers: "インディーハッカー向け",
					soloDevs: "個人開発者向け",
					startups: "スタートアップ向け",
					agencies: "代理店向け",
					enterprises: "企業向け",
					devops: "DevOps向け",
				},
				compare: {
					title: "比較",
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
					title: "ドキュメント",
					overview: "概要",
					quickstart: "クイックスタート",
					apiReference: "APIリファレンス",
				},
				legal: {
					title: "法的情報",
					terms: "利用規約",
					privacy: "プライバシーポリシー",
				},
			},
		},

		comparison: {
			tableLabel: "Uptime と {{competitor}} の比較",
			tableCategoryHeader: "項目",
			tableProductHeader: "Uptime",
			whyTeamsSwitchTitle: "チームが Uptime に移行する理由",
			gettingStartedTitle: "はじめかた",
			finalCtaTitle: "Uptime に移行する",

			honestTake: {
				badge: "正直な評価",
				title: "{{competitor}} のほうが適している場合",
				description:
					"私たちは透明性を大切にしています。次のような場合は {{competitor}} が適した選択かもしれません。",
			},

			pricing: {
				badge: "料金",
				title: "実際のコスト比較",
				description: "一般的な監視構成でどれだけ節約できるかをご確認ください。",
				tableLabel: "コスト比較: Uptime と {{competitor}}",
				scenarioHeader: "ユースケース",
				savingsHeader: "削減額",
				savingsPerYear: "年間~{{amount}}",
				footnote:
					"一般的な利用パターンに基づく概算です。{{competitor}} の料金は変更される場合があり、実際の費用は構成によって異なります。",
			},
		},

		finalCta: {
			body: "2分以内に最初のモニターを作成できます。開始にクレジットカードは不要です。",
		},

		marketingPage: {
			everythingBadge: "詳しく見る",
			everythingTitle: "必要なすべてを",
			everythingDescription:
				"最初のチェックから届くアラートまで、提供される内容を詳しくご紹介します。",
			howItWorksBadge: "はじめに",
			howItWorksTitle: "仕組み",
			howItWorksDescription:
				"空のダッシュボードから自動で走るチェックまで、3つのステップで完了します。",
			faqBadge: "FAQ",
			faqTitle: "よくある質問",
			faqDescription: "監視を始める前によく寄せられる質問をまとめました。",
			finalCtaTitle: "サービスの監視を始めましょう",
		},
	},

	/**
	 * `/trust` — how the monitoring works and who runs it.
	 */
	trust: {
		meta: {
			title: "信頼性について | Uptime",
			description:
				"Uptime の仕組み：誰が運営しているのか、チェックはどこから実行されるのか、インシデントはどう確定されるのか、そして何を保存し何を保存しないのか。",
		},
		footerLink: "信頼性",
		heading: "信頼性について",
		intro:
			"モニターの価値は、それをどれだけ信じられるかで決まります。このページでは、このサービスが実際にどう動いているのか——誰が運営し、チェックはどこから来て、障害がどうやって通知になり、何を保持しているのか——を、頼るかどうか判断できる程度の詳しさで説明します。ここに書かれているのはすべて、計画ではなく現在実装されているとおりのシステムです。",
		regions: {
			afr: "アフリカ",
			apac: "アジア太平洋",
			eeur: "東ヨーロッパ",
			enam: "北米東部",
			me: "中東",
			oc: "オセアニア",
			sam: "南米",
			weur: "西ヨーロッパ",
			wnam: "北米西部",
		},
		sections: {
			whoRuns: {
				title: "運営者",
				bodyPrefix: "Uptime は",
				founderName: "Sergio Xalambrí",
				bodySuffix:
					"が個人で開発・運営しています。その名前の後ろにサポートの当番表やオンコールチームはありません。1 人がコードを書き、デプロイし、メールに返信しています。",
				second:
					"これは良い面と悪い面の両方で知っておく価値があります。チェックの挙動についての質問は、それを書いた本人に届きます。一方で、その人が眠っている間に起きた問題は、目を覚ますまで待つことになります。",
			},

			/**
			 * Code-available under its own license terms: the repository is visible, so
			 * the claim is only that a reader can check the code.
			 */
			source: {
				title: "コードを読めます",
				bodyPrefix:
					"このサービスを動かしているコードは公開されています。チェックがどう分類されるか、保存される結果に何が含まれるか、通知がいつ送られるか — このページの記述は、信じるしかないものではなく確認できるものです: ",
				linkText: "GitHub の apps/uptime",
				bodySuffix: "。",
				caveat:
					"そこで見えるのはコードであって、今動いているデプロイそのものではありません。ご自身で確認できることが一つ増えるという話で、それ自体が保証ではありません。",
			},
			ownStatus: {
				title: "当サービス自身のステータスページ",
				bodyPrefix:
					"このサービスは、製品として提供しているものと同じ cron ジョブ監視を使って、自身についてのステータスページを公開しています：",
				linkText: "uptime.sergiodxa.com/status/uptime",
				bodySuffix: "。",
				scope:
					"そのページが扱う範囲は、名前から想像されるより狭いので、正確なところをお伝えします。サービスの内部で定期実行される各ジョブ——モニターの巡回、日次統計の夜間集計、保持期間切れデータの削除——は、完了時に報告を送ります。そのためこのページからは、それらの定期処理が予定どおり動いているかが分かります。サービス全体を外部から独立に監視するものではなく、アプリ本体と同じプラットフォーム上で動いているため、アプリを止めるほど広範囲の障害が起きれば、このページの報告も止まり得ます。",
			},
			whereChecksRun: {
				title: "チェックの実行場所",
				intro: "各モニターは、選択したリージョンからチェックされます。次の 9 つが利用できます。",
				hint: "リージョンは目安であり、約束ではありません。チェックは選んだリージョンの近くに配置されたインフラで実行されますが、プラットフォームの都合で別の場所に配置されることもあります。例外はヨーロッパの 2 リージョンで、こちらは EU に固定されており、希望ではなく確実な制約です。",
				timing:
					"チェックで記録される応答時間は、あなたのエンドポイントへのリクエストのみを測っており、その周辺で当社が行う処理は含みません。そのため、その数値はそのリージョンにいる人が体験するものと比較できるままです。",
			},
			incidents: {
				title: "インシデントの確定方法",
				classification:
					"すべてのチェックは 3 つの結果のいずれかで終わります。「停止」は、エンドポイントにまったく到達できなかった、期待したものとは異なるステータスで応答した、または設定したコンテンツチェックに失敗したことを意味します。「劣化」は、正しく応答したものの、設定したしきい値より遅かったことを意味します。「正常」は、すべてが一致したことを意味します。",
				noConfirmation:
					"最初の通知の前に、確認のための 2 回目のチェックは行いません。1 回の失敗したチェックだけで、モニターを停止と判定してアラートを送ります。これは意図的なトレードオフです——確認のための追加チェックを挟めば、本物のアラートがすべて 1 間隔分遅れます——が、その代わりに、たまたま一度ネットワークが不調だっただけでも受信箱に届き得ることを意味します。",
				falsePositivesIntro: "その代わりにノイズを抑えているのは、次の仕組みです。",
				infraFault: {
					label: "当社側の失敗をあなたの失敗にはしません。",
					body: "チェックを実行する当社のインフラ自体が失敗した場合、その結果は記録せず再試行します。当社側の不具合が、あなたの履歴の停止記録や受信箱のアラートになることはありません。",
				},
				yourThresholds: {
					label: "タイムアウトもしきい値もあなたのもの。",
					body: "タイムアウト、期待するステータス、劣化のしきい値はすべてあなたが設定します。そのため、チェックが遅いか失敗かは、あなたが与えた定義によってのみ判断されます。",
				},
				cooldown: {
					label: "再送には間隔があり、復旧の通知は必ず届きます。",
					body: "インシデントの最初のアラートは即座に送信されます。モニターがダウンし続けている間、再送はそのアラートのクールダウン（既定では 1 時間）の間隔で送られるため、長引く障害は沈黙せずに知らせ続けます。復旧すると、その旨をお知らせする通知がもう 1 通届きます。",
				},
				recovery: {
					label: "復旧の通知は、本当に失敗があったときだけ。",
					body: "復旧のメッセージは、モニターがそれ以前に失敗状態だった場合にのみ送られます。モニターの一番最初のチェックが、復旧したと名乗ることはありません。",
				},
				maintenance: {
					label: "メンテナンス期間中はアラートを抑止します。",
					body: "メンテナンス期間がモニターに適用されている間、その通知は完全にスキップされます。そのため、計画された作業で誰かを起こすことはありません。",
				},
				accounting: {
					label: "抑止された通知も報告します。",
					body: "インシデントが終わると、復旧のメッセージが、何件の通知を送り、何件を抑止したかを報告します。そのため、静かなインシデントと、失われたアラートを区別できます。",
				},
			},
			storage: {
				title: "保存するものと、保存しないもの",
				noBodies:
					"レスポンスの本文は一切保存しません。切り詰めても、ハッシュ化しても、サンプリングしてもいません。データベースのどこにも、そのための列自体が存在しません。",
				contentChecks:
					"レスポンスの本文をダウンロードするのは、そのモニターにコンテンツチェックを設定した場合のみです。設定した場合は、チェックの最中にメモリ上であなたのルールと照合し、リクエストの残りとともに破棄します。コンテンツチェックのないモニターは、本文を読むことがありません。",
				storedIntro: "保持しているものと、その期間は次のとおりです。",
				httpResults: {
					label: "個々の HTTP チェックの記録：",
					body: "返されたステータスコード、リクエストにかかった時間、終了した時刻。1 週間保持します。直近の表示と使用量の集計が読むのはこれだけです。",
				},
				dailyStats: {
					label: "日次統計：",
					body: "毎晩、前日のチェックがモニターごとに 1 行へ集計されます。この集計がアプリ内のすべての稼働状況グラフの裏にある長期履歴で、365 日間保持されます。",
				},
				otherResults: {
					label: "DNS と TCP のチェック記録：",
					body: "90 日間保持します。モニターの詳細ページや事後検証が直接読む履歴だからです。",
				},
				alertHistory: {
					label: "アラート履歴：",
					body: "送信した通知、送信に失敗した通知、意図的に抑止した通知のすべてを 90 日間保持します。何が伝えられ、何が伝えられなかったかを確認できます。",
				},
				cronPings: {
					label: "cron ジョブのチェックイン：",
					body: "365 日間保持します。それに付随して記録されるリクエスト元のアドレスとユーザーエージェントは 30 日後に消去され、チェックイン自体は残ります。",
				},
			},
			customerData: {
				title: "アカウントのデータ",
				bodyPrefix:
					"アカウント情報、決済の扱い、Cookie、そしてそれらすべてに対するあなたの権利については、",
				privacyLinkText: "プライバシーポリシー",
				bodySuffix:
					"が定めています。要約を二重に書くのではなく、そちらが正式な文書です。短く言えば、あなたのデータは販売されず、監視データはあなたのチームのものです。",
			},
			ourIncidents: {
				title: "Uptime 自身にインシデントが起きたとき",
				retries:
					"チェックはその場で実行するのではなくキューに入れられ、当社側の不具合で完了できなかったチェックは、記録せずに再試行されます。当社側の問題が、あなたのサービスの障害としてモニターの履歴に書き込まれることはありません。",
				gaps: "問題が長引けば、チェックは遅れるかスキップされます。スキップされたチェックは何も書き込まないため、その期間は、実際にはなかったダウンタイムではなく、データのない空白として履歴に現れます。数値は実際に実行されたチェックから計算されます。",
				missedAlerts:
					"理解しておく価値があるのは、その次にくる失敗の形です。当社の障害中にあなたのエンドポイントが停止した場合、アラートは遅れて届くか、まったく届かないことがあります。監視サービスは自身が停止している間はあなたに知らせられません。このサービスも例外ではありません。",
				noSlaPrefix:
					"当社はサービスレベル契約（SLA）を提供しておらず、自らを縛る可用性の数値も公表していません。",
				termsLinkText: "利用規約",
				noSlaSuffix:
					"にもそのとおり書かれており、このページがそれと違うことをひそかに言うことはありません。代わりにあるのは、上記のステータスページと、メールに返信する人間です。",
			},
		},
	},

	legal: {
		terms: {
			meta: {
				title: "利用規約 | Uptime",
				description: "Sergio Xalambrí が運営する稼働監視サービス Uptime の利用規約です。",
			},

			lastUpdated: "最終更新: 2026年2月11日",
			title: "利用規約",

			sections: {
				introduction: {
					title: "1. はじめに",
					body: "Uptime へようこそ。本利用規約は、Sergio Xalambrí が運営する稼働監視サービスのご利用について定めるものです。Uptime にアクセスまたは利用した時点で、本規約に同意したものとみなされます。",
				},
				serviceDescription: {
					title: "2. サービスの説明",
					body: "Uptime は、稼働監視と定期タスク監視のサービスを提供します。HTTP エンドポイント監視、DNS 監視、TCP ポート監視、SSL 証明書監視、cron ジョブ監視が含まれます。これらのサービスは、あなたのサービスや定期タスクの状態を把握するのに役立ちます。世界各地の複数のリージョンからエンドポイントを監視し、問題を検知したらお知らせします。",
				},
				accountTerms: {
					title: "3. アカウントに関する条件",
					first: "アカウントを作成する際は、正確かつ完全な情報を提供してください。",
					second:
						"アカウントの認証情報を安全に管理する責任、およびアカウントで行われたすべての操作についての責任は、あなたにあります。",
					third:
						"ご利用には、18歳以上であること、または組織を代表して本規約に同意する法的な権限があることが必要です。",
					fourth: "アカウントが不正に利用されていることに気づいた場合は、すぐにご連絡ください。",
				},
				acceptableUse: {
					title: "4. 利用上のルール",
					intro: "Uptime を利用するにあたり、次の行為を行わないことに同意していただきます。",
					first:
						"サービスを濫用したり、過度な負荷をかけたり、妨害したりすること。また、利用上限を回避しようとすること。",
					second:
						"自分が所有していない、または監視する権限のない URL やエンドポイントを監視すること。",
					third:
						"自分が所有していない、または監視する権限のない cron ジョブや定期タスクを監視すること。",
					fourth:
						"cron ジョブの ping エンドポイントを、正当な定期タスク監視以外の目的で使用すること。",
					fifth: "違法な目的、または許可されていない目的でサービスを利用すること。",
					sixth: "当方のシステムや他の利用者のアカウントに不正にアクセスしようとすること。",
					seventh: "書面による同意なくサービスを再販または再配布すること。",
				},
				paymentTerms: {
					title: "5. 支払いについて",
					first:
						"Uptime は従量課金制です。設定したモニターの数とチェック頻度に応じて料金が決まります。",
					second: "サブスクリプションの管理と決済は Polar を通じて行われます。",
					third: "解約した場合、サブスクリプションの未使用分については日割りで返金します。",
					fourth:
						"30日前の通知をもって価格を変更する場合があります。価格変更後も利用を続けた場合は、変更に同意したものとみなされます。",
				},
				dataAndPrivacy: {
					title: "6. データとプライバシー",
					firstPrefix: "Uptime のご利用には、データの収集・利用・保護の方法を説明した",
					firstLinkText: "プライバシーポリシー",
					firstSuffix: "も適用されます。",
					second:
						"監視データは365日間保持されます。この期間を過ぎた履歴データは自動的に削除されます。",
					third:
						"データの削除はいつでもご依頼いただけます。アカウントを解約した場合、データは30日以内に削除されます。",
				},
				serviceAvailability: {
					title: "7. サービスの可用性",
					first:
						"99.9% の可用性を目標としていますが、これはあくまで目標であり、保証ではありません。金銭的な補償を伴うサービスレベル契約 (SLA) は提供していません。",
					second:
						"計画的なメンテナンスは、可能な限り余裕をもって事前にお知らせします。緊急のメンテナンスは予告なく行うことがあります。",
					third:
						"計画の有無にかかわらず、サービスの停止によって生じたダウンタイム、データの消失、損害について、当方は責任を負いません。",
				},
				limitationOfLiability: {
					title: "8. 責任の制限",
					first:
						"Uptime は「現状のまま」「利用可能な範囲で」提供され、明示・黙示を問わずいかなる保証も行いません。",
					second:
						"監視対象のエンドポイントで発生するすべての停止を検知できることは保証できません。監視は、ネットワークの状況など当方が制御できない要因の影響を受けます。",
					third:
						"サービスの利用に起因する請求について当方が負う責任の総額は、その請求より前の12か月間にお支払いいただいた金額を上限とします。",
					fourth:
						"間接的、付随的、特別、結果的、または懲罰的な損害について、当方は責任を負いません。",
				},
				termination: {
					title: "9. 解約と終了",
					first:
						"アカウントはいつでも、アカウント設定から、またはご連絡いただくことで解約できます。",
					second:
						"本規約に違反した場合、またはその他の理由がある場合には、相応の予告をしたうえでアカウントを停止または終了することがあります。",
					third: "終了後はサービスを利用できなくなり、データは30日以内に削除されます。",
				},
				changesToTerms: {
					title: "10. 規約の変更",
					body: "本利用規約は随時更新することがあります。重要な変更がある場合は、メールまたはサービス内でお知らせします。変更の発効後も Uptime の利用を続けた場合は、変更後の規約に同意したものとみなされます。",
				},
				contact: {
					title: "11. お問い合わせ",
					prefix: "本利用規約についてご不明な点がありましたら、次のアドレスまでご連絡ください: ",
					email: "hello@sergiodxa.com",
				},
			},
		},
		privacy: {
			meta: {
				title: "プライバシーポリシー | Uptime",
				description:
					"Uptime のプライバシーポリシー。稼働監視サービスのご利用にあたり、データをどのように収集・利用・保護しているかをご説明します。",
			},

			lastUpdated: "最終更新: 2026年8月2日",
			title: "プライバシーポリシー",

			sections: {
				introduction: {
					title: "1. はじめに",
					first:
						"本プライバシーポリシーでは、Sergio Xalambrí が運営する Uptime (以下「当方」) が、稼働監視サービスのご利用にあたって、あなたの個人情報をどのように収集・利用・保護しているかを説明します。",
					second:
						"本ポリシーは当サービスのすべての利用者に適用され、ウェブサイトおよび監視プラットフォームを通じて収集されるデータを対象とします。",
				},
				dataCollected: {
					title: "2. 収集するデータ",
					accountData: {
						title: "アカウント情報",
						body: "GitHub 認証でサインアップすると、GitHub のプロフィールからメールアドレスと表示名を取得します。",
					},
					monitoringData: {
						title: "監視データ",
						body: "作成したモニターに関するデータを収集します。監視対象として指定した URL、応答時間、HTTP ステータスコード、稼働・停止のイベントなどが含まれます。",
					},
					cronJobData: {
						title: "cron ジョブの監視データ",
						intro: "cron ジョブ (定期タスク) の監視では、次のデータを収集します。",
						first: "ping のタイムスタンプ (定期タスクが完了を報告した時刻)",
						second: "ping リクエストの送信元 IP アドレス",
						third: "ping リクエストのユーザーエージェント文字列",
						fourth: "スケジュールの設定 (cron 式、タイムゾーン、猶予時間)",
						outro:
							"これらのデータは、定期タスクが時間どおりに実行されているかを把握するのに役立ち、想定された ping が届かないときにお知らせするために使われます。",
					},
					usageData: {
						title: "利用データ",
						body: "ページビュー、機能の利用状況、エラーログなど、サービスの使われ方に関する分析データとログを収集します。",
					},
					paymentData: {
						title: "決済情報",
						body: "決済処理は Polar が行います。クレジットカード情報を当方が保存することはありません。Polar からは、サブスクリプションの状態と請求履歴の確認情報のみを受け取ります。",
					},
				},
				dataUsage: {
					title: "3. データの利用目的",
					first: {
						label: "監視サービスを提供するため：",
						body: "指定された URL を監視し、その可用性を記録するためにデータを利用します。",
					},
					second: {
						label: "アラートや通知を送るため：",
						body: "ダウンタイムのアラートやステータスの通知を送るために、メールアドレスを利用します。",
					},
					third: {
						label: "サービスを改善するため：",
						body: "利用状況の傾向を分析し、機能の改善や不具合の修正に役立てます。",
					},
					fourth: {
						label: "ご連絡するため：",
						body: "サービスの更新情報、セキュリティに関するお知らせ、サポートのメッセージをお送りすることがあります。",
					},
				},
				dataSharing: {
					title: "4. データの共有",
					noSell: "個人データを販売することはありません。",
					intro: "Uptime の運営を支える次の外部サービスとデータを共有しています。",
					first: {
						label: "Cloudflare：",
						body: "インフラ、ホスティング、コンテンツ配信、メール配信",
					},
					second: { label: "Polar：", body: "決済処理とサブスクリプションの管理" },
					third: { label: "GitHub：", body: "認証" },
					outro:
						"法令で求められる場合、または当方の権利や利用者の安全を守るために必要な場合には、データを開示することがあります。",
				},
				dataRetention: {
					title: "5. データの保持期間",
					first: { label: "監視データ：", body: "収集から365日間" },
					second: { label: "アカウント情報：", body: "アカウントを削除するまで" },
					third: { label: "ログ：", body: "30日間" },
				},
				rights: {
					title: "6. あなたの権利 (GDPR)",
					intro: "EU 一般データ保護規則 (GDPR) にもとづき、あなたには次の権利があります。",
					first: {
						label: "データへのアクセス：",
						body: "当方が保持しているあなたの個人データの写しを請求できます",
					},
					second: {
						label: "データの訂正：",
						body: "正確でない個人データの訂正を請求できます",
					},
					third: { label: "データの削除：", body: "個人データの削除を請求できます" },
					fourth: { label: "データの持ち出し：", body: "持ち運べる形式でデータを受け取れます" },
					fifth: {
						label: "処理への異議：",
						body: "特定の種類のデータ処理に異議を申し立てられます",
					},
					outro: "これらの権利を行使したい場合は、下記のメールアドレスまでご連絡ください。",
				},
				security: {
					title: "7. セキュリティ",
					intro: "データを守るために、次のような対策を講じています。",
					first: {
						label: "通信の暗号化：",
						body: "すべてのデータは HTTPS/TLS で送信されます",
					},
					second: { label: "保存データの暗号化：", body: "保存したデータは暗号化しています" },
					third: {
						label: "アクセス制御：",
						body: "厳格なアクセス制御により、データに触れられる範囲を限定しています",
					},
					fourth: {
						label: "定期的なセキュリティの見直し：",
						body: "セキュリティ対策を定期的に見直しています",
					},
				},
				cookies: {
					title: "8. Cookie",
					intro: "サービスの動作に必要な最小限の Cookie だけを使用しています。",
					first: {
						label: "セッション Cookie：",
						body: "認証とログイン状態の維持に使用します",
					},
					outro:
						"トラッキング Cookie、第三者の広告 Cookie、マーケティング目的の Cookie は一切使用していません。",
				},
				turnstile: {
					title: "9. ボット対策",
					first:
						"アカウントがなくても誰でも URL を確認できる公開ページは、Cloudflare Turnstile で保護されています。人間とボットを見分けて、無料の確認機能が自動化されたトラフィックで使い果たされないようにするためのものです。",
					second:
						"そのために、Cloudflare はあなたの IP アドレスとブラウザに関する情報を受け取り、確認に成功したことを覚えておくためにブラウザにトークンを保存する場合があります。",
					third:
						"Turnstile が動作するのはその公開ページだけです。ログイン後のアプリでは一切使用していません。",
					referencePrefix: "Cloudflare がそのデータをどのように扱うかについては、Cloudflare の",
					referenceLinkText: "Turnstile プライバシー補遺",
					referenceSuffix: "をご覧ください。",
				},
				childrensPrivacy: {
					title: "10. 子どものプライバシー",
					body: "Uptime は18歳未満の方の利用を想定していません。18歳未満の子どもから個人情報を意図的に収集することはありません。",
				},
				internationalTransfers: {
					title: "11. データの国外移転",
					first:
						"データは Cloudflare のグローバルネットワークを介して処理されることがあります。EU にお住まいの場合、データが米国に移転され、そこで処理されることがあります。",
					second:
						"GDPR の要件に沿ってデータが保護されるよう、Cloudflare の標準契約条項をはじめとする適切な保護措置を利用しています。",
				},
				changesToPolicy: {
					title: "12. 本ポリシーの変更",
					first:
						"本プライバシーポリシーは随時更新することがあります。重要な変更がある場合は、新しいポリシーをこのページに掲載し、「最終更新」の日付を更新してお知らせします。",
					second: "大きな変更については、アカウントをお持ちの方にはメールでもお知らせします。",
				},
				contact: {
					title: "13. お問い合わせ",
					body: "本プライバシーポリシーについてのご質問や、データに関する権利の行使をご希望の場合は、次のアドレスまでご連絡ください。",
					email: "hello+privacy@sergiodxa.com",
				},
			},
		},
	},

	notFound: {
		title: "ページが見つかりません",
		description: "お探しのページは存在しないか、移動された可能性があります。",
		goBackHome: "ホームに戻る",
	},

	errors: {
		backHome: "ホームに戻る",
	},

	app: {
		meta: {
			title: "Uptime by Sergio Xalambrí",
			description: "開発者向けのシンプルで信頼性の高いUptime監視",
		},

		layout: {
			sidebar: {
				teamPicker: { label: "チームを選択" },
				userMenu: { label: "ユーザーメニュー" },
				toggle: "ナビゲーションの表示を切り替えます",

				navigation: {
					items: {
						dashboard: "ダッシュボード",
						alerts: "アラート",
						maintenance: "メンテナンス",
						monitors: "モニター",
						httpMonitors: "HTTPモニター",
						statusPages: "ステータスページ",
						tcpMonitors: "TCPモニター",
						dnsMonitors: "DNSモニター",
						cronJobs: "Cronジョブ",
						settings: "設定",
						billing: "請求",
						domains: "ドメイン",
						members: "メンバー",
						team: "チーム",
						docs: "ドキュメント",
						apiKeys: "APIキー",
					},
				},

				account: {
					title: "アカウント",
					overview: "概要",
					teams: "チーム一覧",
					signOut: "ログアウト",
				},
			},
			breadcrumbs: { label: "パンくずリスト" },
			toasts: {
				region: "通知",
				dismiss: "閉じる",
			},
		},

		errors: {
			notFound: {
				title: "404 見つかりません",
				description: "お探しのチームは存在しません。",
			},
		},
	},

	monitorDetail: {
		header: {
			region: "{{emoji}} {{code}}",
		},
		stats: {
			title: "統計",
			uptime: "Uptime",
			totalChecks: "総チェック数",
			lastCheck: "最終チェック",
			neverRan: "N/A",
		},

		actions: {
			refresh: "更新",
			delete: {
				confirm: "このモニターを削除してもよろしいですか？",
				cta: "モニターを削除",
			},
		},
	},

	monitorList: {
		header: {
			title: "Uptimeモニター",
			cta: "モニターを作成",
			subscribe: "モニターが一時停止されています。監視を続けるにはサブスクリプションが必要です",
		},
	},

	statusPage: {
		banner: {
			operational: "すべてのシステムが正常に稼働中",
			degraded: "部分的なシステム障害",
			down: "重大なシステム障害",
		},
		status: {
			operational: "稼働中",
			degraded: "低下",
			down: "ダウン",
			unknown: "不明",
		},
		uptimeBar: {
			daysAgo: "90日前",
			today: "今日",
			legend: {
				full: "100%",
				partial: "一部",
				down: "ダウン",
				noData: "データなし",
			},
			tooltip: {
				uptime: "{{percentage}}% 稼働率",
				noData: "データなし",
			},
		},
		cronJobs: {
			title: "スケジュールされたジョブ",
			lastPing: "最終Ping",
			never: "なし",
			schedule: "スケジュール",
		},
		empty: {
			description: "このステータスページにはサービスが設定されていません。",
		},
		footer: {
			lastUpdated: "最終更新: {{date}}",
			poweredBy: "Uptime提供",
		},
		error: {
			title: "ステータスページが見つかりません",
			description: "お探しのステータスページは存在しないか、公開されていません。",
			goHome: "ホームページへ",
		},
		dns: {
			coverage: "このドメインで追跡中のすべての DNS レコード",
		},
	},

	contentMonitoring: {
		title: "コンテンツ監視",
		description:
			"特定のキーワードやパターンのレスポンスコンテンツをチェックします。いずれかのチェックが通らない場合、モニターは失敗となります。",
		empty:
			"コンテンツチェックが設定されていません。レスポンス内の特定のキーワードやパターンを監視するためのチェックを追加してください。",
		addButton: "コンテンツチェックを追加",

		form: {
			title: "チェックを追加",
			description: "各チェックはピングごとにレスポンス本文に対して実行されます。",
			checkType: {
				label: "チェックタイプ",
				description: "レスポンスコンテンツのマッチング方法を選択",
				options: {
					contains: "含む",
					notContains: "含まない",
					regex: "正規表現パターン",
				},
			},
			value: {
				label: "値",
				placeholder: "キーワードまたはパターンを入力",
				description: "チェックするテキストまたは正規表現パターン",
			},
			caseSensitive: "大文字小文字を区別",
			cancel: "キャンセル",
			add: "チェックを追加",
		},

		item: {
			type: "タイプ",
			status: "ステータス",
			caseSensitive: "大文字小文字を区別",
			enabled: "有効",
			disabled: "無効",
			yes: "はい",
			no: "いいえ",
			delete: "削除",
			deleteConfirmTitle: "このコンテンツチェックを削除しますか？",
		},

		types: {
			contains: "含む",
			notContains: "含まない",
			regex: "正規表現",
		},
	},

	auth: {
		error: {
			title: "認証エラー",
			errorCode: "エラーコード: {{code}}",
			description: "説明: {{description}}",
			uri: "URI:",
			tryAgain: "もう一度お試しいただくか、問題が解決しない場合はサポートにお問い合わせください。",

			signInFailedTitle: "サインインに失敗しました",
			signInFailedGeneric: "サインインを完了できませんでした。もう一度お試しください。",
			missingIdToken: "IDプロバイダーがIDトークンを返しませんでした。",
		},
	},

	dashboard: {
		header: {
			title: "Uptimeモニター",
			cta: "モニターを作成",
			subscribe: "モニターが一時停止されています。監視を続けるにはサブスクリプションが必要です",
		},

		monitor: {
			stats: {
				title: "統計",
				uptime: "Uptime",
				totalChecks: "総チェック数",
				lastCheck: "最終チェック",
				neverRan: "N/A",
			},

			actions: {
				refresh: "更新",
				delete: {
					confirm: "このモニターを削除してもよろしいですか？",
					cta: "モニターを削除",
				},
			},
		},
	},

	createMonitor: {
		title: "新しいモニターを作成",
		fields: {
			name: {
				label: "モニター名",
				placeholder: "ランディングページ",
				description: "モニターの説明的な名前。",
			},
			url: {
				label: "監視するURL",
				placeholder: "https://example.com/healthcheck",
				description: "監視したいサービスのURL。",
			},
			method: {
				label: "リクエストメソッド",
				placeholder: "HEAD",
				description: "リクエストに使用するHTTPメソッド。",
			},
			status: {
				label: "期待されるステータスコード",
				placeholder: "200",
				description: "受信を期待するHTTPステータスコード。",
			},
			interval: {
				label: "チェック間隔",
				placeholder: "60",
				description: "秒単位の間隔。最小は60秒です。",
			},
			visibility: {
				label: "公開設定",
				description: "公開モニターは誰とでも共有できます。",
				options: { public: "公開", private: "非公開" },
			},
			region: {
				label: "リージョン",
				description: "pingが実行されるリージョン。",
				placeholder: "wnam",
				options: {
					afr: "{{emoji}} アフリカ",
					apac: "{{emoji}} アジア太平洋",
					eeur: "{{emoji}} 東ヨーロッパ",
					enam: "{{emoji}} 東北アメリカ",
					me: "{{emoji}} 中東",
					oc: "{{emoji}} オセアニア",
					sam: "{{emoji}} 南アメリカ",
					weur: "{{emoji}} 西ヨーロッパ",
					wnam: "{{emoji}} 西北アメリカ",
				},
			},
		},
		cta: "モニターを作成",
	},

	emails: {
		accountDeleted: {
			subject: "Uptimeアカウントを削除しました",
			preview: "アカウントとそのデータを削除しました。",
			heading: "アカウントを削除しました",
			body: "Uptimeアカウントの削除をご依頼いただき、削除を完了しました。チーム、モニター、アラート、ステータスページ、各種設定はすべて失われ、あなたが所有していたチームも一緒に削除され、サブスクリプションは解約されました。",
			retained: {
				intro: "削除できなかったものがいくつかありますので、状況を正確にお伝えしておきます：",
				billing:
					"決済プロバイダーが保持している請求書と支払い記録。税法により保管が義務付けられており、データ保護法もその理由での保管を認めています。",
				analytics:
					"分析ストアに保存されたモニターのチェック結果。追記専用のため、レコードを削除する手段はなく、保持期間の満了で消えるのを待つしかありません。",
				logs: "サーバーのリクエストログも同じ理由です。保持期間の満了で消えるまで、前倒しで削除することはできません。",
				identity:
					"サインインに使われるID情報そのもの。これは当サービスではなく、サインインに使用したIDプロバイダーが保持しています。",
			},
			address:
				"このメールアドレスは、このメッセージをお送りするためだけに保存していました。こちらも今削除しました。",
			footer:
				"このメールは、Uptimeアカウントの削除をご依頼いただいたため送信されました。このアドレスに今後メールが送られることはありません。",
		},

		teamDeleted: {
			subject: "Uptimeの{{team}}が削除されました",
			preview: "{{team}}と、そこで監視していたものはすべて存在しなくなりました。",
			heading: "{{team}}が削除されました",
			body: "{{team}}の所有者がUptimeアカウントを削除したため、チームも一緒に削除されました。このチームにはアクセスできなくなりました。",
			lost: "チームに属していたものはすべて失われました。モニター、アラート、ステータスページは存在せず、いずれも復元できません。",
			next: "この監視が今後も必要な場合は、Uptimeでご自身のチームを作成し、あらためて設定できます。",
			footer:
				"このメールは、あなたがUptimeの{{team}}のメンバーだったため送信されました。あなたの側で必要な対応はありません。",
		},

		teamInvite: {
			subject: "Uptimeの{{team}}に招待されました",
			preview: "Uptimeで{{team}}に参加",
			heading: "{{team}}に招待されました",
			body: "{{team}}はUptimeを使ってサービスを監視しています。招待を承認してチームに参加してください。",
			action: "招待を承認",
			footer:
				"このメールは、Uptimeでどなたかがあなたをチームに招待したため送信されました。心当たりがない場合は、このメッセージを無視してください。",
		},

		alert: {
			subject: "[Uptimeアラート] {{monitor}}：{{status}}",
			preview: "{{monitor}}：{{status}}",
			heading: "{{monitor}}：{{status}}",
			action: "ダッシュボードを開く",
			incidentCooldown:
				"このインシデントの通知：{{sent}}件送信、{{suppressed}}件はアラートのクールダウンにより保留されました。",
			footer:
				"このメールは、チームのアラートのいずれかがこのイベントに一致したため送信されました。",

			status: {
				up: "復旧",
				down: "ダウン",
				degraded: "低下",
			},

			fields: {
				monitor: "モニター",
				status: "ステータス",
				time: "時刻",
				url: "URL",
				responseStatus: "応答ステータス",
				responseTime: "応答時間",
				domain: "ドメイン",
				endpoint: "エンドポイント",
				schedule: "スケジュール",
				lastPing: "最終Ping",
				nextExpected: "次回予定",
				hostname: "ホスト名",
				expiresAt: "有効期限",
				records: "レコード",
				findings: "変更点",
			},

			values: {
				none: "—",
				never: "なし",
				monitor: "{{name}}（{{type}}）",
				responseStatus: "{{actual}}（期待値：{{expected}}）",
				milliseconds: "{{value}}ms",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}}（{{timezone}}）",
				dnsRecordCounts: "消失 {{missing}} 件、変更 {{changed}} 件、新規 {{new}} 件",

				/** One finding, written out per outcome so each reads as its own sentence. */
				dnsFinding: {
					missing: "解決しなくなりました：{{name}} {{type}} {{value}}",
					changed: "現在の解決先：{{name}} {{type}} {{value}}",
					new: "新たに確認：{{name}} {{type}} {{value}}",
				},

				dnsMoreFindings: "…ほか {{count}} 件",
			},

			/** Said only where it applies: what a DNS diff means, not what it found. */
			dns: {
				recordSetEditNote:
					"複数の値を持つレコードセットには、DNS 上でレコードごとの識別子がありません。そのため、セット内の値を変更すると「解決しなくなったレコード 1 件」と「新規レコード 1 件」として報告されます。",
				newRecordsNote:
					"新たに確認されたレコードはまだ監視していません。想定どおりのものはモニターを開いて承認するか、DNS を修正してください。",
			},
		},

		teamDigest: {
			action: "ダッシュボードを開く",
			footer: "このメールは、あなたがUptimeの{{team}}のメンバーであるため送信されました。",
			manageAction: "受け取るメールを選ぶ",

			status: {
				up: "正常",
				degraded: "低下",
				down: "ダウン",
				noData: "未チェック",
			},

			types: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cron: "Cronジョブ",
			},

			columns: {
				monitor: "モニター",
				status: "ステータス",
				uptime: "稼働率",
			},

			values: {
				none: "—",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "稼働率{{value}}%",
				legend: {
					up: "正常",
					degraded: "低下",
					down: "ダウン",
					noData: "データなし",
				},
			},

			daily: {
				subject_other: "{{team}}：昨日はモニター{{count}}件中{{up}}件が正常",
				subjectAll_other: "{{team}}：昨日はモニター{{count}}件すべてが正常",
				preview: "{{team}}の直近1日分のチェック結果",
				heading: "昨日の{{team}}",
				summaryAll_other: "{{date}}はモニター{{count}}件すべてが正常でした。",
				summary_other: "{{date}}はモニター{{count}}件中{{up}}件が正常でした。",
			},

			weekly: {
				subject_other: "{{team}}：1週間でモニター{{count}}件中{{up}}件が正常",
				subjectAll_other: "{{team}}：1週間でモニター{{count}}件すべてが正常",
				preview: "{{team}}の過去7日間のチェック結果",
				heading: "過去7日間の{{team}}",
				summaryAll_other: "モニター{{count}}件すべてが毎日正常でした。",
				summary_other: "モニター{{count}}件中{{up}}件が毎日正常でした。",
			},
		},

		trial: {
			stopAction: "配信を停止する",

			/**
			 * The report page every per-target trial report links, shared because the wrap-up and the
			 * repeat-submission answer point at the same page with the same sentence.
			 */
			reportLink: {
				body: "このレポートは、後から開いたり共有したりできるリンクでもご覧いただけます。",
				action: "オンラインで見る",
			},
			stop: "1回のクリックで、監視をご依頼いただいたすべてのURLのチェックを終了し、メールアドレスとデータを削除します。またいつでも当サイトからやり直せます。",

			status: {
				up: "正常",
				degraded: "低下",
				down: "ダウン",
			},

			fields: {
				url: "URL",
				status: "ステータス",
				previousStatus: "以前のステータス",
				responseStatus: "応答ステータス",
				responseTime: "応答時間",
				checkedAt: "チェック時刻",
				changedAt: "変化した時刻",
				checks: "実行したチェック数",
				uptime: "稼働率",
				slowest: "最も遅い応答",
			},

			values: {
				none: "—",
				milliseconds: "{{value}}ms",
				percentage: "{{value}}%",
			},

			bar: {
				uptime: "稼働率{{value}}%",
				legend: {
					up: "正常",
					degraded: "低下",
					down: "ダウン",
					noData: "データなし",
				},
			},

			confirmation: {
				subject: "{{url}}を1時間ごとにチェックしています",
				preview: "{{url}}の1時間ごとのチェックを開始しました",
				heading: "{{url}}を1時間ごとにチェックしています",
				body: "こちらが今実行されたチェックの結果です。{{until}}まで同じチェックを1時間ごとに実行し、結果が変化したらメールでお知らせします。1日1回、まとめもお送りします。",
				footer: "このメールは、当サイトからこのURLのチェックをご依頼いただいたため送信されました。",
			},

			change: {
				subject: "{{url}}：{{status}}",
				preview: "{{url}}：{{status}}",
				heading: "{{url}}：{{status}}",
				body: "{{time}}の定時チェックが、直前のチェックとは異なる結果を返しました。",
				footer: "このメールは、このURLを1週間監視するようご依頼いただいたため送信されました。",
			},

			daily: {
				subject: "日次レポート：{{url}}",
				subjectMany: "日次レポート：{{total}}件のURL",
				preview: "{{url}}の過去24時間のチェック結果",
				previewMany: "{{total}}件のURLの過去24時間のチェック結果",
				heading: "過去24時間の{{url}}",
				headingMany: "過去24時間の{{total}}件のURL",
				summaryAll: "最後のチェックでは{{total}}件すべてが正常でした。",
				summary: "最後のチェックでは{{total}}件中{{up}}件が正常でした。",
				target: "{{url}} — {{status}}",
				rangeStart: "24時間前",
				rangeEnd: "現在",
				footer: "このメールは、当サイトからこれらのチェックをご依頼いただいたため送信されました。",
			},

			weekly: {
				subject: "7日間レポート：{{url}}",
				preview: "{{url}}の1週間分のチェック結果",
				heading: "過去7日間の{{url}}",
				rangeStart: "7日前",
				rangeEnd: "今日",
				closing: "7日目が終わりましたので、{{url}}の無料チェックはここで終了します。",
				action: "このURLのチェックを続ける",
				footer:
					"このメールは、このURLを1週間監視するようご依頼いただいたため送信されました。これが最後のメールです。",
			},

			repeat: {
				subject: "{{url}}のこれまでのチェック結果",
				preview: "{{url}}ですでに実施したチェックの結果",
				heading: "{{url}}はすでにチェック中です",
				intro:
					"{{since}}に{{url}}の監視をご依頼いただきました。これまでのチェックで分かったことをお伝えします。",
				rangeStart: "1日目",
				rangeEnd: "7日目",
				closing:
					"1つのURLにつき無料の1週間は30日ごとに1回のため、今回のお申し込みでは新しく開始していません。{{url}}のチェックを続けるには、お好きな間隔で実行でき、変化があればすぐにお知らせするUptimeをご利用ください。",
				action: "このURLのチェックを続ける",
				footer:
					"このメールは、当サイトでこのURLをお送りいただき、すでにレポートがあったため送信されました。",
			},
		},
	},

	components: {
		copyButton: {
			label: "コピー",
			copied: "コピーしました！",
		},

		selectAll: {
			select: "すべて選択",
			clear: "選択を解除",
		},

		/**
		 * The scope picker, shared by the alert and maintenance-window forms. A monitor type
		 * is named the same wherever it is offered, so the option copy lives here once; the
		 * sentence describing what narrowing does to a given form stays on that form's page.
		 */
		monitorScope: {
			label: "対象範囲",
			teamWide: "チーム全体（すべてのモニター）",
			unknownMonitor: "すでに存在しないモニター",
			types: {
				http: "HTTP モニター",
				dns: "DNS モニター",
				tcp: "TCP モニター",
				cron: "Cron ジョブ",
			},
			allOfType: {
				http: "すべての HTTP モニター",
				dns: "すべての DNS モニター",
				tcp: "すべての TCP モニター",
				cron: "すべての Cron ジョブ",
			},
		},
	},

	cron: {
		error: {
			empty: "cron 式を入力してください。",
			"field-count": "cron 式には「分・時・日・月・曜日」の 5 つのフィールドが必要です。",
			"seconds-not-supported":
				"秒は指定できません。分から始まる 5 フィールド形式を使用してください。",
			"unknown-macro":
				"その省略形は使用できません。@hourly、@daily、@weekly、@monthly、@yearly のいずれかを使用してください。",
			syntax: "いずれかのフィールドが値・範囲・リスト・間隔のいずれでもありません。",
			"unknown-name":
				"月または曜日の名前を認識できません。JAN や MON のような 3 文字の略称を使用してください。",
			"out-of-range": "いずれかの値がそのフィールドで許可された範囲を超えています。",
			"reversed-range": "範囲の開始が終了より後になっています。",
			"invalid-step": "間隔は 0 より大きい整数で指定してください。",
			"impossible-date": "指定された月にその日は存在しません。",
		},
	},

	schedule: {
		interval: {
			minute_other: "{{count}} 分ごと",
			hour_other: "{{count}} 時間ごと",
		},
		hourly: {
			onTheHour: "毎時",
			atMinutes: "毎時 {{minutes}} 分",
		},
		daily: "毎日 {{times}}",
		weekly: "毎週{{days}} {{times}}",
		monthly: "毎月 {{days}} 日 {{times}}",
		yearly: "毎年 {{months}}{{days}} 日 {{times}}",
		expression: "カスタムスケジュール ({{expression}})",
	},

	actions: {
		checks: {
			queued: "「{{name}}」のチェックをキューに追加しました。",
			subscriptionRequired: "チェックを実行するには有効なサブスクリプションが必要です。",
		},

		addDomain: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームにドメインを追加する権限がありません。",
				alreadyExists: "{{hostname}}は{{verifiedAt}}に追加されました。",
			},

			success: {
				accepted: "{{hostname}}は確認待ちの状態です。",
				created: "{{hostname}}が{{team}}に追加されました。確認は保留中です。",
			},
		},

		changeRole: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームで役割を変更する権限がありません。",
				cannotChangeOwner: "チームオーナーの役割は変更できません。",
			},

			success: "{{name}}の役割が{{team}}で{{role}}に変更されました。",
		},

		createAlert: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームでアラートを作成する権限がありません。",
				limitExceeded: "このチームのアラート上限（{{limit}}個）に達しました。",
			},
			success: { created: "{{name}}アラートが作成されました。" },
		},

		createInvite: {
			email: {
				subject: "Uptimeの{{team}}に招待されました",
			},

			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームにメンバーを招待する権限がありません。",
				alreadyAccepted: "このメールアドレスは既に{{team}}のメンバーです。",
			},

			success: "{{email}}が{{team}}に招待されました。",
		},

		createMonitor: {
			errors: {
				generic: "エラーが発生しました。",
			},

			success: "{{name}}モニターが作成されました。",
		},

		/**
		 * A bulk import reports two numbers, and `partial` is the one that matters: a
		 * submission where some lines landed is a success with a to-do list, so it says
		 * how many monitors exist before it says how many lines need fixing.
		 */
		importMonitors: {
			errors: {
				generic: "エラーが発生しました。リストを確認して、もう一度お試しください。",
				none: "そのリストからは何もインポートできませんでした。下記の理由を確認して、もう一度お試しください。",
			},

			success_other: "{{count}}件のモニターが作成されました。",
			partial_other:
				"{{count}}件のモニターが作成されました。残り{{rejected}}件は作成できませんでした。詳細は下記をご覧ください。",
		},

		updateMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このモニターは存在しません。",
			},

			success: "{{name}}モニターが更新されました。",
		},

		updateSsl: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このモニターは存在しません。",
			},

			success: "{{name}}のSSL設定が更新されました。",
		},

		deleteMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームでモニターを削除する権限がありません。",
				notFound: "このモニターは存在しません。",
			},
			success: "{{name}}モニターが削除されました。",
		},

		removeAlert: {
			errors: {
				generic: "エラーが発生しました。",
				forbidden: "このチームでアラートを削除する権限がありません。",
				notFound: "{{name}}は存在しません。",
			},
			success: "{{name}}アラートが削除されました。",
		},

		removeDomain: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームからドメインを削除する権限がありません。",
				notFound: "{{hostname}}は存在しません。",
			},

			success: "{{hostname}}が{{team}}から削除されました。",
		},

		removeMember: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームからメンバーを削除する権限がありません。",
				cannotRemoveOwner: "チームオーナーは削除できません。",
			},

			success: "{{name}}が{{team}}から削除されました。",
		},

		retryDomainVerification: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームでドメイン確認を再試行する権限がありません。",
				notFound: "{{hostname}}は存在しません。",
				workflowFailed:
					"{{hostname}}の確認プロセスを開始できませんでした。後でもう一度お試しください。",
			},

			success: {
				alreadyVerified: "{{hostname}}は既に確認済みです。",
				requested: "{{hostname}}の確認再試行がリクエストされました。",
			},
		},

		revokeInvite: {
			errors: {
				generic: "エラーが発生しました。",
				notAllowed: "このチームで招待を取り消す権限がありません。",
				notFound: "この招待は存在しません。",
				alreadyAccepted: "この招待は既に受け入れられています。",
			},

			success: "{{email}}の{{team}}への招待が取り消されました。",
		},

		updateTeam: {
			errors: {
				generic: "エラーが発生しました。",
				forbidden: "チーム設定を更新する権限がありません。",
			},

			success: {
				updated: "チーム設定が正常に更新されました。",
			},
		},

		deleteTeam: {
			errors: {
				generic: "チームの削除中にエラーが発生しました。",
				forbidden: "チームを削除できるのはチームオーナーのみです。",
				confirmationRequired: "確認のためDELETEと入力してください。",
			},

			success: "{{team}}が削除されました。",
		},

		leaveTeam: {
			errors: {
				generic: "エラーが発生しました。",
				notMember: "あなたはこのチームのメンバーではありません。",
				ownerCannotLeave:
					"チームオーナーはチームを離れることができません。先にオーナー権限を移譲してください。",
				adminCannotLeave:
					"管理者はチームを離れることができません。オーナーに降格を依頼してください。",
			},

			success: "{{team}}を離れました。",
		},

		createStatusPage: {
			errors: {
				generic: "エラーが発生しました。",
				slugTaken: "このスラッグは既に使用されています。",
			},
		},

		updateStatusPage: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このステータスページは存在しません。",
				slugTaken: "このスラッグは既に使用されています。",
			},
		},

		deleteStatusPage: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このステータスページは存在しません。",
			},

			success: "ステータスページが削除されました。",
		},

		createMaintenance: {
			errors: {
				generic: "エラーが発生しました。",
				invalidDates: "終了時刻は開始時刻より後である必要があります。",
			},

			success: {
				created: "メンテナンスウィンドウ「{{name}}」が作成されました。",
			},
		},

		deleteMaintenance: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このメンテナンスウィンドウは存在しません。",
				forbidden: "このメンテナンスウィンドウを削除する権限がありません。",
			},

			success: "メンテナンスウィンドウ「{{name}}」が削除されました。",
		},

		endMaintenance: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このメンテナンスウィンドウは存在しません。",
				forbidden: "このメンテナンスウィンドウを終了する権限がありません。",
			},

			success: "メンテナンスウィンドウ「{{name}}」が早期終了されました。",
		},

		createTeam: {
			errors: {
				generic: "チームの作成中にエラーが発生しました。",
			},

			success: {
				created: "{{name}}チームが正常に作成されました。",
			},
		},

		createDnsMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				limitExceeded: "このチームのDNSモニター上限（{{limit}}個）に達しました。",
			},

			success: {
				created: "{{name}} DNSモニターが作成されました。",
			},
		},

		updateDnsMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このDNSモニターは存在しません。",
				forbidden: "このDNSモニターを更新する権限がありません。",
			},

			success: "{{name}} DNSモニターが更新されました。",
		},

		deleteDnsMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このDNSモニターは存在しません。",
				forbidden: "このDNSモニターを削除する権限がありません。",
			},

			success: "{{name}} DNSモニターが削除されました。",
		},

		checkDnsMonitor: {
			success: { checked: "「{{name}}」をチェックしました。" },
		},

		reviewDnsMonitor: {
			errors: { generic: "監視するレコードを保存できませんでした。もう一度お試しください。" },
			success: {
				saved_one: "{{count}}件のレコードを監視しています。",
				saved_other: "{{count}}件のレコードを監視しています。",
			},
		},

		toggleDnsMonitorRecord: {
			errors: { generic: "このレコードを変更できませんでした。もう一度お試しください。" },
			success: {
				enabled: "{{name}}の監視を開始しました。",
				disabled: "{{name}}の監視を停止しました。",
			},
		},

		importDnsMonitorZoneFile: {
			errors: {
				generic: "このゾーンファイルを読み取れませんでした。もう一度お試しください。",
				tooLarge: "ゾーンファイルは{{limit}}以下である必要があります。",
				tooManyNames:
					"このゾーンには{{limit}}件を超える名前があり、1つのモニターでは処理しきれません。",
			},
			success: {
				imported_one: "ゾーンファイルから{{count}}件の名前をインポートしました。",
				imported_other: "ゾーンファイルから{{count}}件の名前をインポートしました。",
			},
		},

		createTcpMonitor: {
			errors: {
				generic: "TCPモニターの作成中にエラーが発生しました。",
			},
			success: "{{name}} TCPモニターが作成されました。",
		},

		updateTcpMonitor: {
			errors: {
				generic: "TCPモニターの更新中にエラーが発生しました。",
				notFound: "このTCPモニターは存在しません。",
			},
			success: "{{name}} TCPモニターが更新されました。",
		},

		deleteTcpMonitor: {
			errors: {
				generic: "TCPモニターの削除中にエラーが発生しました。",
				notAllowed: "このチームでTCPモニターを削除する権限がありません。",
				notFound: "このTCPモニターは存在しません。",
			},
			success: "{{name}} TCPモニターが削除されました。",
		},

		createApiKey: {
			errors: {
				generic: "APIキーの作成中にエラーが発生しました。",
				limitExceeded: "このチームのAPIキー上限（{{limit}}個）に達しました。",
			},
			success: {
				created: "APIキー「{{name}}」が作成されました。",
			},
		},

		deleteApiKey: {
			errors: {
				generic: "APIキーの削除中にエラーが発生しました。",
				notFound: "このAPIキーは存在しません。",
			},
			success: "APIキー「{{name}}」が削除されました。",
		},

		updateLanguage: {
			errors: {
				generic: "言語設定の更新中にエラーが発生しました。",
			},
			success: "言語設定が正常に更新されました。",
		},

		createCronJob: {
			errors: {
				generic: "エラーが発生しました。",
				limitExceeded: "このチームのCronジョブ上限（{{limit}}個）に達しました。",
			},
			success: "Cronジョブ「{{name}}」が作成されました。",
		},

		updateCronJob: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このCronジョブは存在しません。",
			},
			success: "Cronジョブ「{{name}}」が更新されました。",
		},

		deleteCronJob: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このCronジョブは存在しません。",
				forbidden: "このCronジョブを削除する権限がありません。",
			},
			success: "Cronジョブ「{{name}}」が削除されました。",
		},
	},

	page: {
		dashboard: {
			header: {
				title: "ダッシュボード",
			},

			quickPing: {
				title: "クイックチェック",
				description: "URLを1回チェック。保存もアラートもなし、pingを1回消費します。",
				field: {
					label: "チェックするURL",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "1回チェック",
					/** Names the icon button that opens the bar as a sheet, below the width it is a row at. */
					open: "クイックチェックを開く",
				},
				result: {
					/** Names the toast region a finished check is reported in. */
					label: "チェック結果",
					noResponse: "応答なし",
					status: {
						up: "稼働中",
						degraded: "低下",
						down: "停止中",
					},
				},
				error: {
					invalidUrl: "http:// または https:// から始まる完全なURLを入力してください。",
					subscriptionRequired: "チェックを実行するには有効なサブスクリプションが必要です。",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			empty: {
				title: "モニターがありません",
				description: "最初のモニターを作成してサービスの追跡を開始しましょう。",
				cta: "モニターを作成",
			},

			stats: {
				monitors: {
					label: "月間ping使用量",
					value: "{{consumed}}<small> 使用済み</small>",
					description: "推定{{estimated}}のうち",
					unavailable: "推定値は利用できません",
				},

				uptime: {
					label: "Uptime率",
					description: "システム全体のUptime",
				},

				httpMonitors: {
					label: "HTTPモニター",
					create: "新しいHTTPモニター",
					breakdown: {
						up: "{{up}} 稼働中",
						down: "{{down}} 停止中",
					},
				},
				dnsMonitors: {
					label: "DNSモニター",
					create: "新しいDNSモニター",
					/** One monitor is one domain, so this count is smaller than the work behind it. */
					hint: "1つのモニターがドメイン全体と、そこで追跡しているすべてのレコードを対象とします。",
					breakdown: {
						ok: "{{ok}} 正常",
						changed: "{{changed}} 変更",
						error: "{{error}} エラー",
					},
				},
				tcpMonitors: {
					label: "TCPモニター",
					create: "新しいTCPモニター",
					breakdown: {
						up: "{{up}} 稼働中",
						down: "{{down}} 停止中",
					},
				},
				cronJobs: {
					label: "Cronジョブ",
					create: "新しいCronジョブ",
					breakdown: {
						healthy: "{{healthy}} 正常",
						late: "{{late}} 遅延",
						missed: "{{missed}} 未実行",
					},
				},

				slowestEndpoint: {
					label: {
						default: "最も遅いエンドポイント「<em>{{name}}</em>」",
						noData: "最も遅いエンドポイント",
					},
					value: { noData: "N/A" },
					description: "過去24時間",
				},
			},

			tabs: {
				http: "HTTP",
				dns: "DNS",
				tcp: "TCP",
				cronJobs: "Cronジョブ",
			},

			loading: "読み込み中…",

			panel: {
				tabsLabel: "モニタータイプ",
				tabPanelLabel: "{{tab}}モニター",
				refresh: "更新",
			},

			error: {
				card: {
					label: "エラー",
					value: "-",
					description: "データの読み込みに失敗しました",
				},
				table: {
					message: "モニターの読み込みに失敗しました。もう一度お試しください。",
				},
				analytics: {
					message: "分析データは一時的に利用できません。しばらくしてからもう一度お試しください。",
				},
			},

			table: {
				label: "モニター",

				columns: {
					name: "名前",
					latencyChart: "レイテンシトレンド",
					status: "ステータス",
					lastIncident: "最終インシデント",
					responseTime: "平均レイテンシ",
					actions: "アクション",
				},

				status: {
					up: "稼働中",
					down: "ダウン",
					degraded: "低下",
					unknown: "データなし",
				},

				lastIncident: { never: "-" },
				responseTime: "約{{value}}",

				actions: {
					menu: "アクションメニュー",
					edit: "モニターを編集",
					delete: "モニターを削除",
					play: "モニターを実行",
				},

				confirmation: {
					deleteMonitor: "モニター{{name}}を削除してもよろしいですか？この操作は取り消せません。",
				},
			},
		},

		monitors: {
			header: {
				title: "Uptimeモニター",
				cta: "モニターを作成",
				subscribe: "モニターが一時停止されています。監視を続けるにはサブスクリプションが必要です",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},
		},

		createMonitor: {
			header: {
				title: "モニターを作成",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "ランディングページ",
						description: "モニターの説明的な名前。",
					},
					url: {
						label: "監視するURL",
						placeholder: "https://example.com/healthcheck",
						description: "監視したいサービスのURL。",
					},
					method: {
						label: "リクエストメソッド",
						placeholder: "HEAD",
						description: "リクエストに使用するHTTPメソッド。",
					},
					status: {
						label: "期待されるステータスコード",
						placeholder: "200",
						description: "受信を期待するHTTPステータスコード。",
					},
					interval: {
						label: "チェック間隔",
						placeholder: "60",
						description: "秒単位の間隔。最小は60秒です。",
					},
					visibility: {
						label: "公開設定",
						description: "公開モニターは誰とでも共有できます。",
						options: { public: "公開", private: "非公開" },
					},
					region: {
						label: "リージョン",
						description: "pingが実行されるリージョン。",
						placeholder: "リージョンを選択",
						options: {
							afr: "{{emoji}} アフリカ",
							apac: "{{emoji}} アジア太平洋",
							eeur: "{{emoji}} 東ヨーロッパ",
							enam: "{{emoji}} 東北アメリカ",
							me: "{{emoji}} 中東",
							oc: "{{emoji}} オセアニア",
							sam: "{{emoji}} 南アメリカ",
							weur: "{{emoji}} 西ヨーロッパ",
							wnam: "{{emoji}} 西北アメリカ",
						},
					},
				},

				sections: {
					basics: {
						title: "基本情報",
						description: "このモニターが監視する対象。",
					},
					checks: {
						title: "チェック設定",
						description: "モニターの実行間隔、期待するレスポンス、実行リージョン。",
					},
				},

				cta: "モニターを作成",
			},
		},

		editMonitor: {
			header: {
				title: "モニターを編集",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				fields: {
					name: {
						label: "モニター名",
						placeholder: "ランディングページ",
						description: "モニターの説明的な名前。",
					},
					url: {
						label: "監視するURL",
						placeholder: "https://example.com/healthcheck",
						description: "監視したいサービスのURL。",
					},
					method: {
						label: "リクエストメソッド",
						placeholder: "HEAD",
						description: "リクエストに使用するHTTPメソッド。",
					},
					status: {
						label: "期待されるステータスコード",
						placeholder: "200",
						description: "受信を期待するHTTPステータスコード。",
					},
					interval: {
						label: "チェック間隔",
						placeholder: "60",
						description: "秒単位の間隔。最小は60秒です。",
					},
					visibility: {
						label: "公開設定",
						description: "公開モニターは誰とでも共有できます。",
						options: { public: "公開", private: "非公開" },
					},
					region: {
						label: "リージョン",
						description: "pingが実行されるリージョン。",
						placeholder: "wnam",
						options: {
							afr: "{{emoji}} アフリカ",
							apac: "{{emoji}} アジア太平洋",
							eeur: "{{emoji}} 東ヨーロッパ",
							enam: "{{emoji}} 東北アメリカ",
							me: "{{emoji}} 中東",
							oc: "{{emoji}} オセアニア",
							sam: "{{emoji}} 南アメリカ",
							weur: "{{emoji}} 西ヨーロッパ",
							wnam: "{{emoji}} 西北アメリカ",
						},
					},
					ssl: {
						enabled: {
							label: "SSL監視を有効化",
							description: "SSL証明書の有効期限を監視し、期限切れ前にアラートを受け取ります。",
						},
						expiresAt: {
							label: "証明書の有効期限",
							placeholder: "有効期限を選択",
							description:
								"SSL証明書の有効期限を入力してください。ホスティングプロバイダーのダッシュボードまたはブラウザで証明書の詳細を確認できます。",
						},
						issuer: {
							label: "証明書発行者",
							placeholder: "Let's Encrypt、DigiCertなど",
							description: "SSL証明書を発行した認証局（任意）。",
						},
						warningDays: {
							label: "期限前アラート",
							description: "証明書の有効期限の何日前にアラートを受け取るか。",
						},
					},
				},

				sections: {
					basics: {
						title: "基本情報",
						description: "このモニターが監視する対象。",
					},
					checks: {
						title: "チェック設定",
						description: "モニターの実行間隔、期待するレスポンス、実行リージョン。",
					},
				},

				cancel: "キャンセル",
				cta: "変更を保存",
			},

			ssl: {
				title: "SSL証明書の監視",
				description: "証明書の有効期限を追跡し、訪問者より先に把握できます。",
				cta: "SSL設定を保存",
			},

			dangerZone: {
				title: "危険ゾーン",
				description: "ここでの操作は取り消せません。",
				warning: "このモニターを削除すると、チェック、履歴、アラートが完全に失われます。",
				delete: "モニターを削除",
			},
		},

		monitor: {
			header: {
				title: "モニター「{{name}}」",

				action: {
					play: "モニターを実行",
					running: "実行中…",
					edit: "モニターを編集",
					refresh: "更新",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			stats: {
				monitors: {
					label: "月間ping使用量",
					value: "{{consumed}}<small> 使用済み</small>",
					description: "推定{{estimated}}のうち",
					estimateUnavailable: "見積もりが利用できません",
				},

				uptime: {
					label: "Uptime率",
					description: "過去90日間",
				},

				slowestResult: {
					label: "最も遅い結果",
					description: "過去24時間",
				},

				p99ResponseTime: {
					label: "P99応答時間",
					value: "{{value}} ms",
					description: "p99、過去24時間",
				},
			},

			ssl: {
				title: "SSL証明書",
				status: {
					valid: "有効",
					expiring: "まもなく期限切れ",
					expired: "期限切れ",
					error: "エラー",
					unknown: "未設定",
				},
				expiresAt: "有効期限",
				expiresIn: "{{days}}日",
				issuer: "発行者",
				lastChecked: "最終チェック",
				notConfigured: "このモニターではSSL監視が有効になっていません。",
				configure: "SSL監視を設定",
			},
			run: {
				toast: {
					up: "{{name}} は稼働中です",
					down: "{{name}} はダウンしています",
					degraded: "{{name}} の状態が低下しています",
					changed: "実行したチェックにより、このモニターのステータスが変わりました。",
					notQueued: {
						title: "チェックは実行されませんでした",
						description: "チェックを実行するには有効なサブスクリプションが必要です。",
					},
				},
			},
		},

		billing: {
			header: {
				title: "請求",
			},
			ownerOnly: "このチームの請求情報を閲覧・管理できるのはチームオーナーのみです。",
		},

		members: {
			header: {
				title: "チームメンバー",

				action: {
					invite: "メンバーを招待",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			sections: {
				members: {
					title: "メンバー",
					description: "チームメンバーと役割を管理します。",
				},
			},

			membersTable: {
				label: "現在のメンバー",
				description: "このチームにアクセスできるメンバー。",

				columns: {
					name: "名前",
					role: "チームの役割",
					actions: "アクション",
				},

				role: {
					member: "メンバー",
					admin: "管理者",
					owner: "オーナー",
				},

				actions: {
					menu: "アクションメニュー",
					remove: "チームから削除",
					transfer: "オーナー権限を移譲",
					changeRole: {
						member: "管理者に変更",
						admin: "メンバーに変更",
						owner: "オーナーは変更できません",
					},
				},

				confirmation: {
					removeMember: "{{name}}をチームから削除してもよろしいですか？",
				},
			},

			invitedMembersTable: {
				label: "保留中の招待",
				description: "招待されたがまだ参加していないメンバー。",

				columns: {
					email: "メール",
					actions: "アクション",
				},

				actions: {
					menu: "アクションメニュー",
					copy: "招待リンクをコピー",
					revoke: "招待を取り消し",
				},

				confirmation: {
					revokeInvite: "{{email}}の招待を取り消してもよろしいですか？",
				},
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},

		invite: {
			header: {
				title: "チームメンバーを招待",
				description: "チームへの参加招待を送信します。",
			},

			dialog: {
				close: "ダイアログを閉じる",
			},

			form: {
				fields: {
					email: {
						label: "メールアドレス",
						placeholder: "john.doe@example.com",
						description: "{{team}}に招待したい方のメールアドレス。",
					},
				},

				cancel: "キャンセル",
				cta: "メンバーを招待",
			},
		},

		acceptInvite: {
			errors: {
				pageTitle: "招待は無効です",
				notFound: "この招待は存在しません。",
				gone: "この招待は既に受け入れられています。",
				forbidden: "この招待はあなた宛てではありません。",
				badRequest: "メールアドレスが見つかりません。再度ログインしてください。",
				wrongEmail:
					"この招待は{{email}}宛に送信されました。そのメールアドレスでサインインして承諾してください。",
			},
		},

		domains: {
			header: {
				title: "チームドメイン",
				action: { addDomain: "ドメインを追加" },
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			sections: {
				domains: {
					title: "ドメイン",
					description: "チームの確認済みドメインを管理します。",
				},
			},

			form: {
				fields: {
					hostname: {
						label: "ドメイン",
						placeholder: "example.com",
						description: "{{team}}に追加したいドメイン。",
					},
				},

				cta: "ドメインを追加",
			},

			table: {
				label: "確認済みドメイン",
				description: "チームメンバーの自動プロビジョニングに使用できるドメイン。",

				columns: {
					hostname: "ホスト名",
					id: "確認ID",
					verifiedAt: "確認日時",
					actions: "アクション",
				},

				verifiedAt: {
					pending: "確認待ち",
				},

				actions: {
					menu: "アクションメニュー",
					copy: "確認IDをコピー",
					remove: "ドメインを削除",
					retryVerification: "確認を再試行",
				},

				confirmation: {
					removeDomain: "{{hostname}}をチームから削除してもよろしいですか？",
				},
			},

			instructions: {
				title: "ドメインを確認する方法",

				description: "ドメインを確認するには、DNS設定に以下の`TXT`レコードを追加してください：",

				record: {
					name: {
						label: "名前",
						value: "_ping-verification",
					},
					content: {
						label: "内容",
						value: "VERIFICATION_ID",
					},
				},

				note: "<code>VERIFICATION_ID</code>を上に表示されている実際の確認IDに置き換えてください。",

				disclaimer: "DNS変更の反映には時間がかかる場合があるため、確認が遅れることがあります。",
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},

		alerts: {
			header: {
				title: "アラート",

				action: {
					create: "アラートを作成",
					history: "履歴を表示",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			empty: {
				title: "アラートが設定されていません",
				description: "モニターがダウンした時に通知を受け取るためのアラートを作成してください。",
				cta: "アラートを作成",
			},

			limitReached: "このチームはアラートの上限（{{limit}}件）に達しました。",

			form: {
				fields: {
					name: {
						label: "名前",
						placeholder: "CTOアラート",
						description: "アラートを識別するための名前。",
					},

					/**
					 * The picker's own copy is shared with the maintenance-window form; only this
					 * sentence, which is about alerts, stays here. See `components.monitorScope`.
					 */
					scope: {
						description:
							"このアラートが監視する対象です。チーム全体のままにするか、モニターの種類で絞り込むか、特定の 1 つだけを指定できます。",
					},

					channel: {
						label: "チャンネル",
						description: "アラートに使用するチャンネル。",
						options: {
							webhook: "Webhook",
							email: "メール",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "URL",
								placeholder: "https://example.com/webhook",
								description: "アラートペイロードを送信するURL。",
							},
							secret: {
								label: "署名シークレット（任意）",
								placeholder: "オプションのシークレット",
								description:
									"リクエストヘッダーに含めるオプションのシークレット。このシークレットを使用したペイロードのHMAC SHA256署名が`Webhook-Signature`ヘッダーとして追加されます。",
							},
							signatureNote:
								"設定すると、リクエストに<code>Webhook-Signature: sha256=<hex></code>ヘッダーが付与されます。これはこのシークレットを使用した生のJSONボディのHMAC-SHA256です。",
						},
						email: {
							to: {
								label: "受信者",
								placeholder: "cto@example.com",
								description: "アラートを送信するメールアドレス。",
							},

							subjectPrefix: {
								label: "件名プレフィックス（任意）",
								placeholder: "[Uptimeアラート]",
								description:
									"メール件名に追加するオプションのプレフィックス。受信箱でアラートをフィルタリングするのに便利です。",
							},
						},
						slack: {
							webhookUrl: {
								label: "Webhook URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Slackの受信Webhook URL。api.slack.com/apps > 受信Webhookで作成できます。",
							},
							channel: {
								label: "チャンネルの上書き（任意）",
								placeholder: "#alerts",
								description:
									"Webhookのデフォルトの代わりに投稿するオプションのチャンネル。#プレフィックスを含めてください。",
							},
						},
						discord: {
							webhookUrl: {
								label: "Webhook URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"DiscordのWebhook URL。サーバー設定 > 連携サービス > Webhookで作成できます。",
							},
						},
					},

					notifyOnRecovery: {
						label: "復旧時に通知",
						description:
							"モニターがダウン状態から復旧した時にアラートを送信します。復旧時間とダウンタイムの期間が含まれます。",
					},

					cooldown: {
						label: "アラートクールダウン",
						description:
							"同じタイプのアラート間の最小時間。継続的な障害中のアラート疲れを防ぎます。",
						options: {
							none: "クールダウンなし",
							"5min": "5分",
							"15min": "15分",
							"30min": "30分",
							"1hour": "1時間",
							"2hours": "2時間",
							custom: "カスタム",
						},
						custom: {
							label: "カスタムクールダウン（分）",
							placeholder: "分を入力",
							description: "アラート間の分数を入力してください。",
						},
					},

					cooldownMinutes: {
						label: "クールダウン（分単位）",
						description:
							"モニターがダウンし続けている間、アラートを再送するまでに待つ時間です。インシデントの最初のアラートは常に即座に送信され、復旧の通知も常に送信されます。再送の間隔は、ここで設定した値にかかわらず {{floor}} 分より短くなることはありません。",
					},

					legends: {
						email: "メール設定",
						webhook: "Webhook設定",
						slack: "Slack設定",
						discord: "Discord設定",
					},
				},

				cta: "アラートを作成",
			},

			table: {
				label: "アラート",

				columns: {
					name: "名前",
					scope: "対象範囲",
					strategy: "タイプ",
					notifyOnRecovery: "復旧通知",
					cooldown: "クールダウン",
					actions: "アクション",
				},

				scope: {
					unknownMonitor: "不明なモニター",
					teamWide: "チーム全体",
					allOfType: {
						http: "すべての HTTP モニター",
						dns: "すべての DNS モニター",
						tcp: "すべての TCP モニター",
						cron: "すべての Cron ジョブ",
					},
				},

				cooldown: {
					none: "可能な限り最短",
					minutes: "{{count}}分",
					hours: "{{count}}時間",
				},

				actions: {
					menu: "アクションメニュー",
					edit: "アラートを編集",
					remove: "アラートを削除",
				},

				types: {
					webhook: "Webhook",
					email: "メール",
					slack: "Slack",
					discord: "Discord",
				},

				notifyOnRecovery: {
					enabled: "はい",
					disabled: "いいえ",
				},

				confirmation: {
					deleteAlert: "アラート{{name}}を削除してもよろしいですか？",
				},
			},
		},

		statusPages: {
			header: {
				title: "ステータスページ",

				action: {
					create: "ステータスページを作成",
				},
			},

			empty: {
				title: "ステータスページがありません",
				description:
					"ユーザーとシステムステータスを共有するためのステータスページを作成してください。",
				cta: "ステータスページを作成",
			},

			table: {
				label: "ステータスページ",

				columns: {
					name: "名前",
					slug: "URL",
					services: "サービス",
					monitors: "モニター",
					visibility: "公開設定",
					actions: "アクション",
				},

				visibility: {
					public: "公開",
					private: "非公開",
				},

				actions: {
					menu: "アクションメニュー",
					view: "ページを表示",
					edit: "ページを編集",
					delete: "ページを削除",
				},

				confirmation: {
					delete: "ステータスページ{{name}}を削除してもよろしいですか？",
				},
			},

			form: {
				fields: {
					name: {
						label: "内部名",
						placeholder: "本番ステータス",
						description: "ステータスページを内部で識別するための名前。",
					},
					slug: {
						label: "URLスラッグ",
						placeholder: "production",
						description: "公開ステータスページのURLパス（例：/status/production）。",
					},
					title: {
						label: "公開タイトル",
						placeholder: "Acme Inc. ステータス",
						description: "公開ステータスページに表示されるタイトル。",
					},
					description: {
						label: "説明",
						placeholder: "Acme Inc.サービスの現在のステータス",
						description: "ステータスページのオプションの説明。",
					},
					logoUrl: {
						label: "ロゴURL",
						placeholder: "https://example.com/logo.png",
						description: "ステータスページに表示するオプションのロゴ。",
					},
					isPublic: {
						label: "公開",
						description:
							"リンクを知っている人なら誰でもこのステータスページにアクセスできるようにします。",
					},
					showOverallStatus: {
						label: "全体ステータスを表示",
						description: "ページの上部にシステム全体のステータスバナーを表示します。",
					},
					monitors: {
						label: "含めるモニター",
						description: "このステータスページに表示するモニターを選択してください。",
					},
					cronJobs: {
						label: "含める Cron ジョブ",
						description: "このステータスページに表示する Cron ジョブを選択してください。",
					},
				},

				cta: "ステータスページを作成",
				ctaUpdate: "変更を保存",
			},
		},

		createStatusPage: {
			header: {
				title: "ステータスページを作成",
			},
			form: {
				sections: {
					branding: {
						title: "ブランディング",
						description: "このページの名乗り方です。社内向けにも、訪問者向けにも使われます。",
					},
					visibility: {
						title: "公開設定",
						description: "このページにアクセスできる人と、ひと目でどこまで伝えるかです。",
					},
					services: {
						title: "サービス",
						description: "このページで状況を公開するモニターと Cron ジョブを選びます。",
						empty:
							"モニターや Cron ジョブがまだありません。作成すると、あとでこのページに追加できます。",
					},
				},
			},
		},

		editStatusPage: {
			header: {
				title: "ステータスページを編集",
			},
			form: {
				sections: {
					branding: {
						title: "ブランディング",
						description: "このページの名乗り方です。自分にも訪問者にも表示されます。",
					},
					visibility: {
						title: "公開設定",
						description: "このページにアクセスできる人と、上部に表示する内容です。",
					},
					services: {
						title: "サービス",
						description: "このページで状況を公開するモニターと Cron ジョブを選びます。",
						empty: "追加できるモニターや Cron ジョブがまだありません。",
					},
				},
			},
			dangerZone: {
				title: "危険な操作",
				description: "ここでの操作は元に戻せません。",
				warning: "このステータスページを削除すると、公開 URL は二度と使えなくなります。",
				deleteDescription: "この操作は元に戻せません。",
			},
		},

		monitorsImport: {
			meta: { title: "モニターをインポート" },
			header: { title: "モニターをインポート" },

			form: {
				sections: {
					urls: {
						title: "インポートする対象",
						description: "監視したいアドレスを 1 行に 1 つずつ貼り付けてください。",
					},
					schedule: {
						title: "チェックの頻度",
						description:
							"このインポートで作成されるすべてのモニターに適用されます。あとから個別に変更できます。",
					},
				},

				fields: {
					urls: {
						label: "監視する URL",
						description:
							"1 行に 1 つの URL を、最大 {{limit}} 件まで。example.com のようなホスト名だけの場合は https://example.com になります。空行と同じアドレスの重複はスキップされます。",
						placeholder: "example.com\nhttps://www.example.org/health\nstatus.example.net",
					},
					interval: {
						label: "チェック間隔",
						description: "このリストのすべてのモニターに適用されます。あとから個別に変更できます。",
					},
				},
				cta: "モニターをインポート",
			},

			/**
			 * The rejected lines, shown above the box they get re-pasted into. It leads
			 * with what *was* created, so a partial import reads as progress with a
			 * to-do list.
			 */
			report: {
				section: { title: "前回のインポート" },
				title_other: "{{count}}件のモニターが作成されました。次の行は作成されていません：",
				overflow_other:
					"さらに {{count}} 行が対象外になりました。1 回のインポートで扱えるのは {{limit}} 行までです。残りを貼り付けてインポートしてください。",
				table: {
					label: "インポートされなかった行",
					columns: { line: "行", input: "貼り付けた内容", reason: "理由" },
				},
				reasons: {
					invalidUrl: "チェックできる URL ではありません。",
					duplicate: "前の行と同じアドレスです。",
					tooLong: "URL としては長すぎます。",
				},
			},
		},

		httpMonitors: {
			header: {
				title: "HTTPモニター",
				action: {
					create: "モニターを作成",
					import: "インポート",
				},
			},
			empty: {
				title: "HTTPモニターがありません",
				description: "HTTPモニターを作成してエンドポイントの監視を開始します。",
				cta: "モニターを作成",
			},
			table: {
				label: "HTTPモニター",
				columns: {
					name: "名前",
					url: "URL",
					status: "ステータス",
					responseTime: "応答時間",
					lastChecked: "最終確認",
					actions: "アクション",
				},
				neverChecked: "未確認",
				disabled: "無効",
				actions: {
					menu: "アクションメニュー",
					view: "表示",
					edit: "編集",
					delete: "削除",
				},
				status: {
					up: "稼働中",
					down: "停止中",
					degraded: "低下",
					unknown: "不明",
				},
				confirmation: {
					delete: "モニター {{name}} を削除してもよろしいですか？",
					deleteDescription:
						"コンテンツチェックとチェック結果の履歴も削除されます。この操作は元に戻せません。",
				},
			},
		},

		dnsMonitors: {
			header: {
				title: "DNSモニター",

				action: {
					create: "DNSモニターを作成",
				},
			},

			empty: {
				title: "DNSモニターがありません",
				description: "DNSレコードの変更を追跡するためのDNSモニターを作成してください。",
				cta: "DNSモニターを作成",
			},

			table: {
				label: "DNSモニター",

				columns: {
					name: "名前",
					domain: "ドメイン",
					records: "レコード",
					status: "ステータス",
					lastChecked: "最終チェック",
					actions: "アクション",
				},

				records: "{{total}}件中{{enabled}}件を監視中",
				noRecords: "まだありません",
				disabled: "無効",
				neverChecked: "未実行",
				notChecked: "未確認",

				actions: {
					menu: "アクションメニュー",
					check: "今すぐチェック",
					edit: "編集",
					delete: "削除",
				},

				confirmation: {
					delete: "DNSモニター{{name}}を削除してもよろしいですか？",
				},
			},
		},

		createDnsMonitor: {
			header: {
				title: "DNSモニターを作成",
			},

			form: {
				sections: {
					basics: {
						title: "基本情報",
						description: "このモニターの監視対象です。",
					},
					checks: {
						title: "チェック設定",
						description: "追跡中のすべての名前を解決する頻度です。",
					},
					zoneFile: {
						title: "ゾーンファイル",
						description:
							"サブドメインを監視するには、ゾーンを貼り付けてください。貼り付けない場合、監視できるのはドメインのApexのみです。",
					},
				},

				fields: {
					name: {
						label: "モニター名",
						placeholder: "本番DNS",
						description: "このDNSモニターの説明的な名前。",
					},

					domain: {
						label: "ドメイン",
						placeholder: "example.com",
						description: "DNSレコードを監視するドメイン。",
					},

					zoneFile: {
						label: "ゾーンファイル",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"任意。DNSプロバイダーからエクスポートしたBIND形式のゾーンファイルを貼り付けてください。内容は一度読み取るだけで保存されません。ゾーン内の名前を把握できる唯一の方法です。",
						limits: "テキストは最大 {{size}}、モニターあたり {{limit}} 個の名前までです。",
					},

					interval: {
						label: "チェック間隔",
						description: "追跡中のすべての名前を解決する頻度。",
						options: {
							"5m": "5分",
							"15m": "15分",
							"30m": "30分",
							"1h": "1時間",
							"6h": "6時間",
							"12h": "12時間",
							"24h": "24時間",
						},
					},

					isEnabled: {
						label: "監視を有効化",
						description: "このドメインの監視を直ちに開始します。",
					},
				},

				/** ADR-026 §14: said on the setup screen as well as in the docs. */
				apexOnlyNotice:
					"DNSでは、ゾーン内のレコードを一覧表示することは誰にもできません。ゾーンファイルがない場合、監視できるのはドメインのApexのみで、サブドメインは監視できません。",

				cta: "DNSモニターを作成",
			},
		},

		editDnsMonitor: {
			header: {
				title: "DNSモニターを編集",
			},

			form: {
				sections: {
					basics: {
						title: "基本情報",
						description: "このモニターの監視対象と、チェックの間隔です。",
					},
				},

				fields: {
					name: {
						label: "モニター名",
						placeholder: "本番DNS",
						description: "このDNSモニターの説明的な名前。",
					},

					domain: {
						label: "ドメイン",
						placeholder: "example.com",
						description: "DNSレコードを監視するドメイン。",
					},

					zoneFile: {
						label: "ゾーンファイル",
						placeholder: "example.com.\t1\tIN\tA\t192.0.2.1",
						description:
							"任意。DNSプロバイダーからエクスポートしたBIND形式のゾーンファイルを貼り付けてください。内容は一度読み取るだけで保存されません。ゾーン内の名前を把握できる唯一の方法です。",
					},

					interval: {
						label: "チェック間隔",
						description: "追跡中のすべての名前を解決する頻度。",
						options: {
							"5m": "5分",
							"15m": "15分",
							"30m": "30分",
							"1h": "1時間",
							"6h": "6時間",
							"12h": "12時間",
							"24h": "24時間",
						},
					},

					isEnabled: {
						label: "監視を有効化",
						description: "このドメインを積極的に監視するかどうか。",
					},
				},

				cancel: "キャンセル",
				cta: "変更を保存",
			},

			zoneFileImport: {
				title: "ゾーンファイル",
				description:
					"前回のインポート以降に追加された名前を取り込むには、ゾーンを再度貼り付けてください。テキストは一度読み取るだけで保存されないため、更新のたびにファイルをお願いしています。",
				lastImported: "最終インポート：{{date}}。",
				neverImported:
					"ゾーンファイルはまだインポートされていません。このモニターはApexのみを対象としています。",
				cta: "ゾーンファイルをインポート",
			},

			dangerZone: {
				title: "危険な操作",
				deleteMonitor: "モニターを削除",
				deleteDescription: "レコードとチェック履歴も削除されます。この操作は元に戻せません。",
				description: "ここでの操作は元に戻せません。",
				warning: "このモニターを削除すると、DNS チェック、履歴、アラートが完全に失われます。",
			},
		},

		dnsMonitorDetail: {
			header: {
				title: "DNSモニター「{{name}}」",

				action: {
					check: "今すぐチェック",
					refresh: "更新",
					edit: "編集",
				},
			},

			uptimeHistory: "稼働履歴",
			notChecked: "未確認",

			info: {
				domain: "ドメイン",
				status: "ステータス",
				recordsWatched: "監視中のレコード",
				recordsWatchedValue: "{{total}}件中{{enabled}}件",
				zoneFileImported: "ゾーンファイルのインポート",
				zoneFileNeverImported: "なし — Apexのみ",
			},

			stats: {
				totalChecks: {
					label: "総チェック数",
					description: "実行されたDNSチェックの数",
				},

				successRate: {
					label: "成功率",
					description: "成功したチェックの割合",
				},
			},

			results: {
				title: "チェック履歴",
				empty: "まだチェックが実行されていません。",

				table: {
					columns: {
						checkedAt: "チェック日時",
						status: "ステータス",
						findings: "検出結果",
						responseTime: "最も遅いクエリ",
					},
				},

				findings: "{{changed}}件変更 · {{missing}}件消失 · {{new}}件新規",
				noFindings: "変更なし",
				/** A failed query stays out of the diff, so a partial sweep reads as partial. */
				queriesFailed_one: "{{count}}件のクエリが応答しませんでした",
				queriesFailed_other: "{{count}}件のクエリが応答しませんでした",
			},

			records: {
				title: "追跡中のレコード",
				description:
					"このドメインでこれまでに確認したすべてのレコードです。監視していないレコードも保持されるため、新規レコードとして再び検出されることはありません。",
				empty: "追跡中のレコードはまだありません。",

				table: {
					columns: {
						name: "名前",
						type: "タイプ",
						value: "値",
						source: "取得元",
						state: "状態",
						watched: "監視",
					},
				},

				source: {
					resolver: "解決結果",
					zone_file: "ゾーンファイル",
				},

				state: {
					ok: "正常",
					changed: "変更",
					missing: "消失",
					new: "新規",
					error: "エラー",
				},

				actions: {
					enable: "監視する",
					disable: "監視を停止",
				},
			},
		},

		/**
		 * The review step between creating a domain monitor and monitoring anything with
		 * it, kept as its own page so a reload lands back on the same pending decision.
		 */
		dnsMonitorReview: {
			header: {
				title: "「{{name}}」のレコードを確認",
				description:
					"見つかったレコードは既定ですべて監視します。通知が不要なものはチェックを外してください。いずれの場合もレコードは保持されるため、除外したものが後から新規レコードとして現れることはありません。",
			},

			/** Every line the parser rejects surfaces here, each with its own reason. */
			unparsed: {
				title_one: "{{count}}行はインポートされませんでした",
				title_other: "{{count}}行はインポートされませんでした",
				description:
					"これらの行は読み取り対象の範囲に含まれません。そこで宣言されている内容は監視されません。",
				line: "{{line}}行目：{{reason}}",

				/** One sentence per parser outcome, so each names the fix it points at. */
				reasons: {
					originDirective: "以降の名前がどのゾーンに属するかを変えるため、安全に読み取れません",
					ttlDirective: "TTL は追跡していません",
					includeDirective: "手元になく、取得もしないファイルを指しています",
					generateDirective: "一度に多数の名前へ展開されます",
					unsupportedDirective: "読み取り対象のディレクティブではありません",
					multiLineRecord: "括弧で複数行に分かれています",
					blankOwnerContinuation: "空白で始まり、前の行の名前を引き継いでいます",
					nonInternetClass: "インターネットクラスのレコードではありません",
					unsupportedType: "監視対象の 6 種類のレコードタイプに含まれません",
					outOfZone: "別のドメインに属しています",
					malformed: "レコードとして読み取れませんでした",
				},
			},

			groups: {
				resolving: {
					title: "現在解決できるもの",
					description:
						"既知のすべての名前について、対応するすべてのレコードタイプを解決して見つかりました。",
				},
				discovered: {
					title: "新たに見つかったもの",
					description:
						"現在は解決できますが、前回の確認時にはありませんでした。承認されるまで監視しません。知らないうちに現れたレコードを、こちらの判断で期待値にすることはないためです。",
				},
				declared: {
					title: "宣言されているが解決できないもの",
					description:
						"ゾーンファイルには記載されていますが、現時点では応答がありません。指定がない限り監視しません。貼り付けたゾーンはその時点のスナップショットであり、時間とともに古くなるためです。",
					proxiedNote:
						"プロキシ経由のレコードは自身のゾーンのエクスポートには現れず、代わりにプロキシのアドレスを返します。プロキシを使うゾーンではこれが通常の動作であり、何かが壊れている兆候ではありません。",
				},
			},

			/**
			 * A line repeating a record an earlier line declared. Reported apart from the
			 * rejections, since nothing was lost — the record is already tracked from the
			 * first line that declared it.
			 */
			duplicates: {
				title_one: "{{count}}行は、別の行がすでに宣言しているレコードを宣言していました",
				title_other: "{{count}}行は、別の行がすでに宣言しているレコードを宣言していました",
				description:
					"失われたものはありません。DNS は重複したレコードにも一度だけ応答するため、最初に宣言した行から取り込まれています。",
				line: "{{line}}行目：{{name}} {{type}} は{{firstLine}}行目ですでに宣言されています。",
			},

			/** Said at review, the point where the cap is enforced. */
			namesCap: {
				title: "1 つのモニターで監視できる名前の数を超えています",
				description:
					"このモニターは現在 {{count}} 個の名前を対象としていますが、1 回のチェックで確認できるのは {{limit}} 個までです。すべての名前を引き続きチェックするには、ゾーンを複数のモニターに分けてください。",
			},

			/** Column headings match the monitor's own record list, so both screens read alike. */
			table: {
				columns: {
					watched: "監視",
					name: "名前",
					type: "タイプ",
					value: "値",
				},

				/** Each box names the record it decides, since the heading appears once, above the whole list. */
				watchRecord: "{{name}} の {{type}} レコードを監視します",
			},

			empty: "このドメインでは何も見つかりませんでした。",
			cancel: "キャンセル",
			cta: "レコードを保存",
		},

		maintenance: {
			header: {
				title: "メンテナンスウィンドウ",

				action: {
					create: "メンテナンスをスケジュール",
				},
			},

			empty: {
				title: "メンテナンスウィンドウがありません",
				description:
					"計画されたダウンタイム中にアラートを抑制するためのメンテナンスウィンドウをスケジュールしてください。",
				cta: "メンテナンスをスケジュール",
			},

			tabs: {
				label: "メンテナンスステータス",
				active: "実行中",
				upcoming: "予定",
				past: "過去",
			},

			noActive: "実行中のメンテナンスウィンドウはありません",
			noUpcoming: "予定されたメンテナンスウィンドウはありません",
			noPast: "過去のメンテナンスウィンドウはありません",

			table: {
				columns: {
					name: "名前",
					schedule: "スケジュール",
					monitor: "モニター",
					status: "ステータス",
					actions: "アクション",
					scope: "範囲",
					starts: "開始",
					ends: "終了",
				},

				allMonitors: "すべてのモニター",
				recurring: "繰り返し",
				unknownMonitor: "不明なモニター",
				endedEarly: "早期終了",
				edit: "編集",

				status: {
					active: "実行中",
					upcoming: "予定",
					past: "完了",
				},

				actions: {
					menu: "アクションメニュー",
					end: "今すぐ終了",
					delete: "削除",
				},

				confirmation: {
					endMaintenance: "「{{name}}」メンテナンスを早期終了してもよろしいですか？",
					deleteMaintenance: "「{{name}}」を削除してもよろしいですか？",
				},
			},
		},

		createMaintenance: {
			header: {
				title: "メンテナンスをスケジュール",
			},

			form: {
				sections: {
					coverage: {
						title: "対象範囲",
						description: "このメンテナンス期間に名前を付け、適用するモニターを選びます。",
					},
					schedule: {
						title: "スケジュール",
						description: "メンテナンス期間の開始と終了です。",
					},
					behavior: {
						title: "動作",
						description: "期間中の動作と、繰り返すかどうかです。",
					},
				},

				fields: {
					name: {
						label: "名前",
						placeholder: "データベースアップグレード",
						description: "メンテナンス作業の説明。",
					},

					monitor: {
						label: "モニター",
						description:
							"特定のモニターを選択するか、すべてのモニターの場合は空のままにしてください。",
						all: "すべてのモニター",
					},

					startsAt: {
						label: "開始時刻",
						description: "メンテナンスウィンドウが始まる時刻。",
					},

					duration: {
						label: "期間",
						description: "メンテナンスウィンドウの長さ。",
						options: {
							"15m": "15分",
							"30m": "30分",
							"1h": "1時間",
							"2h": "2時間",
							"4h": "4時間",
							"8h": "8時間",
						},
					},

					suppressAlerts: {
						label: "アラートを抑制",
						description: "このメンテナンスウィンドウ中はアラートを送信しません。",
					},

					showOnStatusPage: {
						label: "ステータスページに表示",
						description: "公開ステータスページにメンテナンス通知を表示します。",
					},

					isRecurring: {
						label: "繰り返し",
						description: "このメンテナンスウィンドウをスケジュールに従って繰り返します。",
					},

					recurringPattern: {
						label: "繰り返しパターン",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"パターン形式：'daily:HH:MM-HH:MM'、'weekly:曜日:HH:MM-HH:MM'、または'monthly:日:HH:MM-HH:MM'",
					},
				},

				preview: {
					label: "メンテナンスウィンドウ",
				},

				cta: "メンテナンスをスケジュール",
			},
		},

		editMaintenance: {
			header: {
				title: "{{name}} を編集",
			},

			form: {
				cta: "変更を保存",
				cancel: "キャンセル",
				sections: {
					coverage: {
						title: "対象範囲",
						description: "このメンテナンス期間に名前を付け、適用するモニターを選びます。",
					},
					schedule: {
						title: "スケジュール",
						description: "メンテナンス期間の開始と終了です。",
					},
					behavior: {
						title: "メンテナンス中",
						description: "期間中のアラートとステータスページの挙動です。",
					},
					recurrence: {
						title: "繰り返し",
						description: "1 回だけでなく、スケジュールに沿ってこの期間を繰り返します。",
					},
				},
			},

			endNow: {
				cta: "メンテナンスを今すぐ終了",
				title: "この期間を終了する",
				description: "この期間は現在進行中です。",
				warning:
					"今すぐ終了すると、アラートが再開され、ステータスページからメンテナンスのお知らせが消えます。期間の設定自体は残ります。",
			},

			danger: {
				title: "危険な操作",

				description: "このメンテナンス期間に対する取り消せない操作です。",
				warning: "このメンテナンス期間の削除は元に戻せません。",
				delete: {
					trigger: "メンテナンスウィンドウを削除",
					confirmTitle: "このメンテナンスウィンドウを削除しますか？",
					confirmDescription: "この操作は元に戻せません。",
					confirm: "削除",
				},
			},
		},

		maintenanceWindows: {
			form: {
				fields: {
					name: {
						label: "名前",
					},

					scope: {
						description:
							"このメンテナンスウィンドウが対象とする範囲です。チーム全体のままにするか、モニターの種類で絞り込むか、特定の 1 つだけを指定できます。",
					},

					startsAt: {
						label: "開始時刻",
					},

					endsAt: {
						label: "終了時刻",
					},

					suppressAlerts: {
						label: "この期間中はアラートを抑制",
					},

					showOnStatusPage: {
						label: "ステータスページに表示",
					},

					recurring: {
						label: "繰り返し",
					},

					recurringPattern: {
						label: "繰り返しパターン（繰り返しの場合）",
						placeholder: "weekly:monday:02:00-04:00",
						description:
							"daily:HH:MM-HH:MM、weekly:<曜日>:HH:MM-HH:MM、または monthly:<日>:HH:MM-HH:MM（UTC）。",
					},
				},
			},
		},

		alertHistory: {
			header: {
				title: "アラート履歴",
			},

			breadcrumbs: {
				alerts: "アラート",
			},

			empty: {
				title: "アラートイベントがありません",
				description:
					"モニターがアラートをトリガーすると、アラートイベントがここに表示されます。アラートを設定して開始してください。",
				cta: "アラートを表示",
			},

			table: {
				label: "アラートイベント",

				columns: {
					alert: "アラート",
					monitor: "モニター",
					eventType: "イベント",
					status: "ステータス",
					sentAt: "時刻",
				},

				unknownAlert: "不明なアラート",
				unknownMonitor: "不明なモニター",

				eventType: {
					down: "ダウン",
					up: "復旧",
					degraded: "低下",
				},

				status: {
					sent: "送信済み",
					skipped_cooldown: "スキップ（クールダウン）",
					skipped_cap: "スキップ（繰り返し上限）",
					skipped: "スキップ",
					failed: "失敗",
				},
			},
		},

		createAlert: {
			header: {
				title: "アラートを作成",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				sections: {
					basics: {
						title: "基本情報",
						description: "このアラートの名前と、監視するモニターです。",
					},
					channel: {
						title: "通知チャンネル",
						description: "通知の送信先です。選んだチャンネルの項目だけが必須です。",
					},
					delivery: {
						title: "配信ルール",
						description:
							"復旧を通知するかどうかと、モニターがダウンしている間に通知を繰り返す間隔です。",
					},
				},

				fields: {
					name: {
						label: "名前",
						placeholder: "CTOアラート",
						description: "アラートを識別するための名前。",
					},

					strategy: {
						label: "戦略",
						description: "アラートに使用する戦略。",
						options: {
							webhook: "Webhook",
							email: "メール",
							slack: "Slack",
							discord: "Discord",
						},
					},

					config: {
						webhook: {
							url: {
								label: "Webhook URL",
								placeholder: "https://example.com/webhook",
								description: "アラートペイロードを送信するURL。",
							},
							secret: {
								label: "シークレット",
								placeholder: "オプションのシークレット",
								description:
									"リクエストヘッダーに含めるオプションのシークレット。このシークレットを使用したペイロードのHMAC SHA256署名が`Webhook-Signature`ヘッダーとして追加されます。",
							},
						},
						email: {
							to: {
								label: "メールアドレス",
								placeholder: "cto@example.com",
								description: "アラートを送信するメールアドレス。",
							},

							subjectPrefix: {
								label: "件名プレフィックス",
								placeholder: "[Uptimeアラート]",
								description:
									"メール件名に追加するオプションのプレフィックス。受信箱でアラートをフィルタリングするのに便利です。",
							},
						},
						slack: {
							webhookUrl: {
								label: "Slack Webhook URL",
								placeholder: "https://hooks.slack.com/services/...",
								description:
									"Slackの受信Webhook URL。api.slack.com/apps > 受信Webhookで作成できます。",
							},
							channel: {
								label: "チャンネルの上書き",
								placeholder: "#alerts",
								description:
									"Webhookのデフォルトの代わりに投稿するオプションのチャンネル。#プレフィックスを含めてください。",
							},
						},
						discord: {
							webhookUrl: {
								label: "Discord Webhook URL",
								placeholder: "https://discord.com/api/webhooks/...",
								description:
									"DiscordのWebhook URL。サーバー設定 > 連携サービス > Webhookで作成できます。",
							},
						},
					},

					notifyOnRecovery: {
						label: "復旧時に通知",
						description:
							"モニターがダウン状態から復旧した時にアラートを送信します。復旧時間とダウンタイムの期間が含まれます。",
					},

					cooldown: {
						label: "アラートクールダウン",
						description:
							"同じタイプのアラート間の最小時間。継続的な障害中のアラート疲れを防ぎます。",
						options: {
							none: "クールダウンなし",
							"5min": "5分",
							"15min": "15分",
							"30min": "30分",
							"1hour": "1時間",
							"2hours": "2時間",
							custom: "カスタム",
						},
						custom: {
							label: "カスタムクールダウン（分）",
							placeholder: "分を入力",
							description: "アラート間の分数を入力してください。",
						},
					},
				},

				cta: "アラートを作成",
			},
		},

		editAlert: {
			header: {
				title: "アラートを編集",
			},

			form: {
				cta: "変更を保存",
				cancel: "キャンセル",
				sections: {
					basics: {
						title: "監視対象",
						description:
							"このアラートに名前を付け、すべてのモニターを対象にするか、1 つだけにするかを選びます。",
					},
					channel: {
						title: "通知方法",
						description: "チャンネルを選び、送信先を入力します。",
					},
					delivery: {
						title: "配信ルール",
						description: "復旧通知と、障害中にアラートを繰り返す間隔を設定します。",
					},
				},
			},

			danger: {
				title: "危険な操作",

				description: "このアラートに対する取り消せない操作です。",
				warning:
					"このアラートを削除すると、送信されるすべての通知が停止します。この操作は元に戻せません。",
				delete: {
					trigger: "アラートを削除",
					confirmTitle: "このアラートを削除しますか？",
					confirmDescription: "この操作は元に戻せません。",
					confirm: "削除",
				},
			},
		},

		logout: {
			title: "ログアウトしてもよろしいですか？",
			cta: "ログアウト",
		},

		trial: {
			/**
			 * The report as its own page, reachable by the watch's token. Every figure is
			 * computed from stored checks, so a watch with no completed check shows an em
			 * dash and wording admitting nothing has been observed yet.
			 */
			report: {
				meta: {
					title: "{{days}} 日間のサイト健全性レポート — Uptime",
					description:
						"無料の 1 週間の監視で、あなたのサイトについて記録した稼働率、チェック回数、インシデントです。",
				},
				eyebrow: "{{days}} 日間の健全性レポート",
				period: "{{start}} 〜 {{end}}（{{zone}}）を監視",
				bar: {
					caption: "{{days}} 日間を 1 日 1 ブロックで、古い順に表示しています。",
					status: {
						up: "終日正常",
						degraded: "1 回以上低速",
						down: "1 回以上停止",
						noData: "この日はチェックなし",
					},
				},
				summary: {
					title: "記録した内容",
					uptime: "稼働率",
					checks: "完了したチェック",
					healthy: "完全に正常だったチェック",
					noChecks:
						"まだ完了したチェックがないため、この URL について報告できることはありません。最初の 1 時間ごとのチェックは、監視の開始から 1 時間後に実行されます。",
				},
				incidents: {
					title: "インシデント",
					unknown:
						"まだ完了したチェックがないため、この URL にインシデントがあったかどうかは分かりません。",
					none_other:
						"インシデントなし：完了した {{count}} 件のチェックはすべて期待どおりに応答しました。",
					summary_other: "{{count}} 件のインシデント。",
					entry_other:
						"最初の失敗を {{started}} に検知——{{count}} 件のチェックが連続して失敗しました。",
				},
				timing: {
					title: "応答時間",
					fastest: "最速",
					average: "平均",
					slowest: "最遅",
					basis_other: "応答した {{count}} 件のチェックを対象に計測しました。",
				},
				cta: {
					title: "月 {{price}} でこのサイトの監視を続ける",
					action: "監視を始める",
					convertible: {
						body: "サインインしていただければ、この URL を実際のモニターに変え、上記の履歴もそのまま引き継ぎます。",
					},
					expired: {
						body: "この無料の 1 週間は引き継ぎ可能な期間を過ぎているため、上記の履歴はここに残ります。とはいえ、この URL の本格的な監視はいつでも始められます。",
					},
					converted: {
						title: "この URL はすでに監視されています",
						body: "この対象はモニターに変換済みのため、現在はあなた自身のスケジュールでチェックされています。",
						action: "ダッシュボードを開く",
					},
				},
			},

			meta: {
				title: "無料の {{days}} 日間ウェブサイト健全性レポート — Uptime",
				description:
					"いますぐあなたのサイトをチェックし、その後 {{days}} 日間 1 時間ごとにチェックして、分かったことをメールでお送りします。アカウントもカードも不要です。",
			},

			heading: "あなたのサイトの無料 {{days}} 日間健全性レポート",
			intro:
				"URL を入力すると、当社ネットワークからいますぐチェックを実行します。有料モニターが実行するものと同じチェックです。そのあとメールアドレスを入力いただければ、{{days}} 日間 1 時間ごとにチェックを続け、最後にレポートをお送りします。",

			form: {
				url: {
					label: "チェックする URL",
					description: "公開インターネット上の http:// または https:// のアドレス。",
					placeholder: "https://example.com",
				},
				submit: "最初のチェックを実行する",
			},

			refusal: {
				title: "チェックは実行されませんでした",
				blockedTarget:
					"そのアドレスは代理でチェックできません。ポート 80 または 443 の公開された http:// もしくは https:// の URL で、ユーザー名とパスワードを含まず、公開インターネット上のアドレスに解決される必要があります。",
				challengeIncomplete: "認証を完了していただければ、チェックを実行できます。",
				failedChallenge:
					"リクエストがブラウザーから送られたことを確認できませんでした。ページを再読み込みしてやり直してください。",
				rateLimited: "1 分後にもう一度チェックできます。",
				rateLimitedFor: "{{seconds}} 秒後にもう一度チェックできます。",
				budgetExhausted:
					"本日分の無料チェックはすべて実行済みです。これは当社側の事情で、あなたの URL の問題ではありません。明日また来ていただくか、監視を始めていただければ 1 分ごとにチェックします。",
				unavailable:
					"当社側の事情でチェックを実行できなかったため、URL について何も分かりませんでした。これは当社側の問題で、お客様の問題ではありません。少し時間をおいてお試しください。",
			},

			result: {
				checkAnother: "別の URL をチェック",
				noResponse: "応答なし",
				httpStatus: "HTTP {{status}}",
				milliseconds: "{{value}} ms",
				checkedAt: "{{time}} に実行",

				redirect: {
					badge: "リダイレクト",
					title: "この URL は別の場所へリダイレクトします",
					description:
						"応答はありましたが、その内容は別のアドレスへの案内でした。そこへは行っていません。入力された URL だけをチェックする方針で、これがこの入力欄を本来届くべきでない場所への踏み台にさせない仕組みです。転送先を指定して調べれば、その実際の結果が得られます。",
					destination: "転送先は {{url}} です",
					action: "そちらをチェックする",
					unknownDestination:
						"転送先は読み取っていません。ブラウザーでこの URL を開いて到達先を確認し、そのアドレスをここでチェックしてください。",
				},

				status: {
					up: "正常",
					degraded: "低速",
					down: "停止",
				},
			},

			lead: {
				title: "無料の {{days}} 日間レポートを受け取る",
				description:
					"いまご覧になったチェックが 1 回目です。メールアドレスを入力いただければチェックを継続し、{{days}} 日間のチェックで分かったことをお伝えします。",
				consent: "Uptime 自体についても、ときどきメールを送ってよい。",
				consentNote: "どちらを選んでもチェックは届きます。",
				promise:
					"すべてのメールに、ワンクリックでチェックを止めてアドレスを削除するリンクが付いています。",
				submit: "無料の {{days}} 日間レポートを開始する",

				/**
				 * What a visitor is agreeing to, placed beside the field so it reads before
				 * submission. Each line matches what the system actually does: the probed
				 * address, the watch's own cadence and length, and the three emails that exist.
				 */
				expectations: {
					target:
						"チェックを続けるのは {{url}} です。いまチェックしたアドレスそのものだけで、それ以外は対象になりません。",
					cadence: "{{days}} 日間、1 時間ごとに 1 回。",
					emails:
						"1 日 1 通のまとめ、ステータスが変化したときのお知らせ、そして最後に完全なレポート。",
					noAccount: "カードもパスワードも不要、作成するアカウントもありません。",
				},

				email: {
					label: "メールアドレス",
					placeholder: "you@example.com",
					error: "メールアドレスの形式ではないようです。",
				},
			},

			monitor: {
				title: "この URL の監視を続ける",
				description:
					"この 1 回のチェックをモニターにしましょう。同じチェックをお好みの間隔で実行し、変化があればすぐにお知らせします。",
				subscribeDescription:
					"この 1 回のチェックをモニターにしましょう。同じチェックをお好みの間隔で実行し、変化があればすぐにお知らせします。サブスクリプションが有効になり次第、実行を開始します。",
				create: "この URL のモニターを作成",
				subscribe: "サブスクリプションを開始",
			},

			watching: {
				title: "監視を開始しました",
				description:
					"{{url}} の最初の 1 時間ごとのチェックは 1 時間後に実行され、{{days}} 日間チェックを続けます。いま実行したチェックの控えはすでに受信箱に届いています。",
			},

			repeated: {
				title: "このURLはすでにチェック済みです",
				description:
					"{{url}} は以前のお申し込みですでに無料レポートをご利用済みです。1 つの URL につき 30 日ごとに 1 回となります。これまでのチェック結果はメールでお送りしましたので、新しい監視は開始していません。",
			},

			benefits: {
				title: "レポートに含まれる内容",
				description:
					"有料モニターがこの URL について教えてくれることをすべて、{{days}} 日間、無料で。",

				list: {
					hourly: {
						title: "1 時間ごとのチェック",
						description: "{{days}} 日間、有料モニターと同じネットワークから。",
					},
					changes: {
						title: "変化したときのメール",
						description:
							"落ちても戻っても分かります。1 日 1 通までなので、不安定なサイトでも受信箱があふれません。",
					},
					digest: {
						title: "1 日 1 通のまとめ",
						description:
							"URL の状態が一目で分かります。最後には {{days}} 日間の全体を 1 通のレポートにまとめます。",
					},
					noAccount: {
						title: "アカウントもカードも不要",
						description: "登録は不要で、ワンクリックで完全に停止できます。",
					},
				},
			},

			more: {
				title: "ウェブサイトだけではありません",
				description:
					"無料レポートは HTTP が対象です。有料アカウントでは、さらに 3 つを見守ります。",

				list: {
					tcp: {
						title: "TCP",
						description:
							"ポートが応答し続けていることが分かります。データベース、メールサーバー、ゲームサーバーなど、ウェブサイト以外にも。",
					},
					dns: {
						title: "DNS",
						description:
							"レコードが本来の宛先を指したままであることが分かります。乗っ取りや設定ミスを見逃しません。",
					},
					cron: {
						title: "cron ジョブ",
						description:
							"夜間バックアップが終わったことが分かり、終わらなかった夜には知らせが届きます。",
					},
				},
			},

			cta: {
				badge: "レポートが終わったあとに",
				title: "月 {{price}} でこのサイトの監視を続ける",
				description:
					"登録すると、この URL は実際のモニターになり、チェック履歴もそのまま引き継がれるので、何もやり直しにはなりません。1 時間ごとではなく 1 分ごとのチェック、好きなだけの URL、普段使っている場所へのアラート、ステータスページ、そして 1 年分の履歴が付きます。",
				action: "このサイトの監視を続ける",
				pricing: "料金を見る",
			},
		},

		unsubscribe: {
			confirm: {
				title: "これらのメールを停止しますか？",
				body: "このアドレスが依頼したチェックをすべて終了し、アドレスとそれに紐づく記録をすべて削除します。何も残らないため元に戻すことはできませんが、いつでも当社サイトからやり直せます。",
				cta: "はい、停止して削除する",
			},

			done: {
				title: "配信を停止しました",
				body: "そのアドレスはリストから外れ、依頼されていたチェックも停止しました。今後そのアドレスへ何かを送ることはありません。いつでも当社サイトからやり直せます。",
				cta: "サイトに戻る",
			},
		},
		splat: {
			notFound: {
				title: "見つかりません",
				description: "お探しのページは存在しません。",
			},
		},

		account: {
			meta: {
				title: "アカウント - Uptime",
				description: "アカウント設定とチームを管理します。",
			},

			header: {
				title: "アカウント",
			},

			form: {
				actions: {
					cancel: "キャンセル",
				},
			},

			profile: {
				title: "プロフィール",
				description: "個人情報。",

				card: {
					title: "プロフィール詳細",
					description: "お名前、メールアドレス、アバター。",
				},
			},

			language: {
				title: "言語設定",
				description: "インターフェースの優先言語を選択してください。",

				card: {
					title: "言語",
					description: "ダッシュボードとメール通知に適用されます。",
				},

				form: {
					fields: {
						language: {
							label: "優先言語",
							description: "優先言語を選択してください。自動検出はブラウザの設定を使用します。",
							options: {
								auto: "自動検出",
								en: "English",
								es: "Español",
								de: "Deutsch",
								ja: "日本語",
								fr: "Français",
								it: "Italiano",
							},
						},
					},

					cta: "言語を保存",
				},
			},

			emails: {
				title: "メール",
				description: "お送りするメールを選択してください。",

				card: {
					title: "メール通知",
					description: "所属しているすべてのチームに適用されます。アラートと招待には影響しません。",
				},

				list: {
					teamDailyDigest: {
						name: "モニターの日次レポート",
						description: "毎朝、チームごとに1通、前日の各モニターの状態をまとめてお送りします。",
					},
					teamWeeklyDigest: {
						name: "モニターの週次レポート",
						description:
							"月曜日に、過去7日間の同じレポートを、1週間の稼働率を日ごとに添えてお送りします。",
					},
				},

				form: {
					cta: "メール設定を保存",
				},
			},

			teams: {
				title: "参加中のチーム",
				description: "あなたがメンバーになっているチームです。",

				actions: {
					createTeam: "チームを作成",
				},

				empty: {
					title: "チームがまだありません",
					description: "チームを作成して、サービスの監視を始めましょう。",
					cta: "チームを作成",
				},

				table: {
					label: "チーム",
					description: "あなたが所属しているすべてのチームです。",

					columns: {
						team: "チーム",
						role: "ロール",
						actions: "操作",
					},

					role: {
						member: "メンバー",
						admin: "管理者",
						owner: "オーナー",
					},

					actions: {
						menu: "アクションメニュー",
						leave: "チームから脱退",
					},

					confirmation: {
						leaveTeam: "{{name}}から脱退してもよろしいですか？",
					},
				},
			},

			dataExport: {
				title: "あなたのデータ",
				description: "このアプリが保持しているあなたに関するすべてをダウンロードできます。",

				card: {
					title: "データをエクスポート",
					description: "JSONファイル1つ。ご依頼をいただいた時点で生成し、保存はしません。",
					includes:
						"プロフィールと各種設定、所属しているすべてのチームとそこでの役割、そして所有しているチームについてはそのモニター、アラート、メンテナンスウィンドウ、ステータスページ、認証済みドメインが含まれます。",
					excludes:
						"持ち出す権利のないものは含まれません：他のメンバーの情報、招待先のアドレス、APIキーのハッシュ、Webhookのシークレット、SlackやDiscordのWebhook URL。チェック履歴も含まれません——上記の設定から生成されるものであり、ファイル内にもそう記載されています。",
				},

				form: {
					cta: "JSONをダウンロード",
				},
			},

			deleteAccount: {
				title: "アカウントを削除",
				description: "アカウントを閉鎖し、その背後にあるデータを削除します。",

				queued: {
					title: "削除を受け付けました",
					description:
						"アカウントは削除の順番待ちに入っており、まだ何も削除されていません。1日以内に実行され、完了したらメールでお知らせします。まだ止められます——実行前であれば、下からいつでも取り消せます。",
					requestedAt: "{{date}}に依頼されました。",
					cta: "削除を取り消す",
				},

				card: {
					title: "アカウントを削除",
					description:
						"アカウントを削除の順番待ちに入れます。このフォームを送信した時点では何も削除されません。",

					whatHappens:
						"ご依頼は順番待ちに入り、あなたはサインアウトされます。1日以内にサブスクリプションを解約し、データを削除し、完了をメールでお知らせします。それまでは何も失われておらず、サインインしなおせば取り消せます。",

					noOwnedTeams:
						"所有しているチームはないため、削除されるのはあなた自身の所属情報と各種設定だけです。所属しているチームは、あなたが抜けたあともそのまま続きます。",

					ownedTeamsIntro:
						"このアプリにチームを他の人へ引き継ぐ手段はないため、所有しているチームはすべて、そのモニター、アラート、ステータスページ、APIキー、メンバーとともにアカウントと一緒に削除されます：",
					ownedTeam_other: "{{name}} — 他の{{count}}名がアクセスを失います。",
					ownedTeamAlone: "{{name}} — 他のメンバーはいません。",

					othersWarning_other:
						"これが実行されると、他の{{count}}名が自分のチームへのアクセスを失います。事前に確認を求められることも、警告されることもありません。",

					retained: {
						intro: "削除できないものもあり、それを隠さずお伝えします：",
						billing:
							"決済プロバイダーが保持している請求書と支払い記録——税法により保管が義務付けられています。",
						analytics:
							"分析ストアに保存されたモニターのチェック結果。追記専用のため、レコードは保持期間の満了で消えるまで、前倒しで削除できません。",
						logs: "サーバーのリクエストログ。これも同じ種類の保持期間で消えます。",
						identity:
							"サインインに使われるID情報。これは当サービスではなく、サインインに使用しているIDプロバイダーに属します。",
					},

					confirmation: {
						label: "確認のため「DELETE」と入力してください",
						placeholder: "DELETE",
					},

					cta: "アカウントの削除を予約する",
				},
			},
		},

		createTeam: {
			header: {
				title: "チームを作成",
				description: "サービスを監視するための新しいチームを作成します。",
			},

			dialog: {
				close: "ダイアログを閉じる",
			},

			form: {
				fields: {
					name: {
						label: "チーム名",
						placeholder: "最高のチーム",
						description: "新しいチームの名前を選択してください。",
					},
				},

				cancel: "キャンセル",
				cta: "チームを作成",
			},
		},

		settings: {
			header: {
				title: "チーム設定",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			sections: {
				general: {
					title: "一般",
					description: "チームの基本情報を管理します。",
				},
			},

			form: {
				card: {
					title: "チームプロフィール",
					description: "チームの名前とロゴを更新します。",
				},

				fields: {
					logo: {
						label: "ロゴURL",
						placeholder: "https://example.com/logo.png",
						description: "チームのロゴ画像のURL。",
					},
					name: {
						label: "チーム名",
						placeholder: "マイチーム",
						description: "チームの名前。",
					},
				},

				actions: {
					cancel: "キャンセル",
					save: "変更を保存",
				},
			},

			members: {
				title: "メンバー",
				description: "チームメンバーと役割を管理します。",

				actions: {
					invite: "メンバーを招待",
				},

				table: {
					label: "現在のメンバー",
					description: "このチームにアクセスできるメンバー。",

					columns: {
						name: "名前",
						role: "役割",
						actions: "アクション",
					},

					role: {
						member: "メンバー",
						admin: "管理者",
						owner: "オーナー",
					},

					actions: {
						menu: "アクションメニュー",
						remove: "チームから削除",
						transfer: "オーナー権限を移譲",
						changeRole: {
							member: "管理者に変更",
							admin: "メンバーに変更",
							owner: "オーナーは変更できません",
						},
					},

					confirmation: {
						removeMember: "{{name}}をチームから削除してもよろしいですか？",
					},
				},

				invitedTable: {
					label: "保留中の招待",
					description: "招待されたがまだ参加していないメンバー。",

					columns: {
						email: "メール",
						expires: "有効期限",
						actions: "アクション",
					},

					expires: {
						expired: "期限切れ",
					},

					actions: {
						menu: "アクションメニュー",
						copy: "招待リンクをコピー",
						revoke: "招待を取り消し",
					},

					confirmation: {
						revokeInvite: "{{email}}の招待を取り消してもよろしいですか？",
					},

					empty: {
						description: "保留中の招待はありません。",
					},
				},
			},

			domains: {
				title: "ドメイン",
				description: "チームの確認済みドメインを管理します。",

				actions: {
					addDomain: "ドメインを追加",
				},

				table: {
					label: "確認済みドメイン",
					description: "チームメンバーの自動プロビジョニングに使用できるドメイン。",

					columns: {
						hostname: "ホスト名",
						id: "確認ID",
						verifiedAt: "確認日時",
						actions: "アクション",
					},

					verifiedAt: {
						pending: "確認待ち",
					},

					actions: {
						menu: "アクションメニュー",
						copy: "確認IDをコピー",
						remove: "ドメインを削除",
						retryVerification: "確認を再試行",
					},

					confirmation: {
						removeDomain: "{{hostname}}をチームから削除してもよろしいですか？",
					},

					empty: {
						description: "確認済みドメインはまだありません。",
					},
				},

				form: {
					title: "ドメインを追加",

					fields: {
						hostname: {
							label: "ドメイン",
							placeholder: "example.com",
							description: "{{team}}に追加したいドメイン。",
						},
					},

					cta: "ドメインを追加",
				},

				instructions: {
					title: "ドメインを確認する方法",
					description: "ドメインを確認するには、DNS設定に以下のTXTレコードを追加してください：",

					record: {
						name: {
							label: "名前",
							value: "_ping-verification",
						},
						content: {
							label: "内容",
							value: "VERIFICATION_ID",
						},
					},

					note: "<code>VERIFICATION_ID</code>を上に表示されている実際の確認IDに置き換えてください。",
					disclaimer: "DNS変更の反映には時間がかかる場合があるため、確認が遅れることがあります。",
				},
			},

			billing: {
				title: "請求",
				description: "サブスクリプションと支払い詳細を管理します。",

				card: {
					title: "サブスクリプションと支払い",
					description: "請求書の確認、支払い方法の更新、サブスクリプションの管理。",
					notice: "請求設定を管理するためにPolarのカスタマーポータルにリダイレクトされます。",
					cta: "請求ポータルを開く",
				},
			},

			danger: {
				title: "危険ゾーン",
				description: "チームに影響を与える取り消し不可能なアクション。",

				card: {
					title: "チームを削除",
					description: "このチームとすべてのデータを完全に削除します。この操作は取り消せません。",
					warning:
						"サブスクリプションがキャンセルされ、すべてのモニター、アラート、ドメイン、メンバー、招待が削除されます。",
					confirmation: {
						label: "確認のためDELETEと入力",
						placeholder: "DELETE",
					},
					cta: "チームを削除",
				},
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},

		tcpMonitors: {
			header: {
				title: "TCPモニター",
				action: {
					create: "TCPモニターを作成",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
				limitation: {
					title: "TCP監視の制限",
					description:
						"TCPポート監視にはソケットサポート付きのCloudflare Workers有料プランが必要です。無料プランでは、TCPチェックは利用不可と表示されます。代替としてHTTP監視の使用をご検討ください。",
				},
			},

			empty: {
				title: "TCPモニターがありません",
				description:
					"ポートが開いていて応答しているかを確認するためのTCPモニターを作成してください。",
				cta: "TCPモニターを作成",
			},

			table: {
				label: "TCPモニター",
				columns: {
					name: "名前",
					endpoint: "ホスト:ポート",
					status: "ステータス",
					lastChecked: "最終チェック",
					responseTime: "応答時間",
					actions: "アクション",
				},
				status: {
					up: "稼働中",
					down: "ダウン",
					timeout: "タイムアウト",
					disabled: "無効",
					pending: "保留中",
				},
				actions: {
					edit: "編集",
					delete: "削除",
					confirmation: {
						delete: "{{name}}を削除してもよろしいですか？",
					},
				},
			},
		},

		createTcpMonitor: {
			header: {
				title: "TCPモニターを作成",
				breadcrumb: {
					tcpMonitors: "TCPモニター",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				sections: {
					basics: {
						title: "基本情報",
						description: "このモニターの監視対象と、チェックの間隔です。",
					},
				},

				fields: {
					name: {
						label: "モニター名",
						placeholder: "データベースサーバー",
						description: "このTCPモニターの説明的な名前。",
					},
					host: {
						label: "ホスト",
						placeholder: "db.example.com",
						description: "監視するホスト名またはIPアドレス。",
					},
					port: {
						label: "ポート",
						placeholder: "5432",
						description: "チェックするTCPポート（1-65535）。",
						decrement: "ポートを減らす",
						increment: "ポートを増やす",
					},
					interval: {
						label: "チェック間隔",
						description: "ポートをチェックする頻度。",
						decrement: "チェック間隔を減らす",
						increment: "チェック間隔を増やす",
					},
					timeout: {
						label: "接続タイムアウト",
						description: "タイムアウトまでに接続を待つ時間。",
						decrement: "接続タイムアウトを減らす",
						increment: "接続タイムアウトを増やす",
					},
				},
				cta: "モニターを作成",
			},
		},

		editTcpMonitor: {
			header: {
				title: "TCPモニターを編集",
				breadcrumb: {
					tcpMonitors: "TCPモニター",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				sections: {
					settings: {
						title: "モニター設定",
						description: "このモニターの接続先と、チェックの間隔です。",
					},
				},

				fields: {
					name: {
						label: "モニター名",
						placeholder: "データベースサーバー",
						description: "このTCPモニターの説明的な名前。",
					},
					host: {
						label: "ホスト",
						placeholder: "db.example.com",
						description: "監視するホスト名またはIPアドレス。",
					},
					port: {
						label: "ポート",
						placeholder: "5432",
						description: "チェックするTCPポート（1-65535）。",
						decrement: "ポートを減らす",
						increment: "ポートを増やす",
					},
					interval: {
						label: "チェック間隔",
						description: "ポートをチェックする頻度。",
						decrement: "チェック間隔を減らす",
						increment: "チェック間隔を増やす",
					},
					timeout: {
						label: "接続タイムアウト",
						description: "タイムアウトまでに接続を待つ時間。",
						decrement: "接続タイムアウトを減らす",
						increment: "接続タイムアウトを増やす",
					},
					isEnabled: {
						label: "監視を有効化",
					},
				},
				cancel: "キャンセル",
				cta: "変更を保存",
			},

			danger: {
				title: "危険ゾーン",
				cta: "モニターを削除",
				description: "これによりチェック結果の履歴も削除されます。この操作は取り消せません。",
				sectionDescription: "ここでの操作は元に戻せません。",
				warning: "このモニターを削除すると、チェック、履歴、アラートが完全に失われます。",
			},
		},

		tcpMonitorDetail: {
			header: {
				breadcrumb: {
					tcpMonitors: "TCPモニター",
				},
				action: {
					edit: "編集",
					checkNow: "今すぐチェック",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			info: {
				title: "モニター設定",
				endpoint: "エンドポイント",
				status: "ステータス",
				interval: "チェック間隔",
				timeout: "タイムアウト",
			},

			stats: {
				uptime: {
					label: "Uptime",
					description: "最近のチェックに基づく",
				},
				avgResponseTime: {
					label: "平均応答時間",
					description: "平均接続時間",
				},
				totalChecks: {
					label: "総チェック数",
					description: "実行されたチェック数",
				},
			},

			history: {
				title: "Uptime履歴",
			},

			results: {
				title: "チェック履歴",
				description: "最近のTCP接続チェック結果",
				label: "結果",
				empty: "まだチェック結果がありません。最初のチェックが実行された後に結果が表示されます。",
				columns: {
					time: "時刻",
					status: "ステータス",
					responseTime: "応答時間",
					error: "エラー",
				},
			},
		},

		apiKeys: {
			header: {
				title: "APIキー",
				action: {
					create: "APIキーを作成",
				},
			},

			docsLink: {
				text: "APIキーの使い方については、こちらの",
				link: "ドキュメント",
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			empty: {
				title: "APIキーがありません",
				description: "Uptime APIにプログラムでアクセスするためのAPIキーを作成してください。",
				cta: "APIキーを作成",
			},

			newKey: {
				title: "APIキー「{{name}}」が作成されました！",
				description:
					"今すぐこのキーをコピーしてください。セキュリティ上の理由から、再度表示することはできません。",
				dismiss: "キーをコピーしました",
				copyLabel: "キーをコピー",
			},

			form: {
				title: "新しいAPIキーを作成",
				description: "APIキーを使用すると、モニターとアラートにプログラムでアクセスできます。",

				sections: {
					details: {
						title: "キーの詳細",
						description:
							"あとで見分けられるようにキーに名前を付け、いつ使えなくなるかを決めてください。",
					},
				},

				fields: {
					name: {
						label: "キー名",
						placeholder: "本番APIキー",
						description: "このAPIキーを識別するための名前。",
					},
					scopes: {
						label: "権限",
						description: "このAPIキーがアクセスできる内容を選択してください。",
						descriptions: {
							"teams:read": "チームの名前とロゴを読み取り、メンバーとその役割を一覧表示します。",
							"teams:write":
								"チームの名前とロゴを変更します。メンバーの追加や削除、チームの削除はできません。",
							"invites:read":
								"保留中と承諾済みの両方を含め、チームの招待を一覧表示します。送信先のメールアドレスも含まれます。",
							"invites:write":
								"メールアドレスをチームに招待し、既存の招待を取り消します。招待を承諾した相手はチームのメンバーになります。",
							"team-domains:read":
								"チームが登録したドメインと、それぞれの検証状況を一覧表示します。",
							"team-domains:write":
								"チームのドメインを登録または削除します。ドメインが検証されると、そのドメインのメールアドレスで登録した人は自動的にチームに参加します。",
							"monitors:read":
								"HTTPモニター、そのチェック結果、稼働率の統計、およびチームの全体ステータスを読み取ります。",
							"monitors:write":
								"HTTPモニターとそのコンテンツチェックを作成・更新・削除します。日次統計の再集計をキューに入れることもできます。",
							"maintenance:read": "チームのメンテナンスウィンドウを一覧表示して読み取ります。",
							"maintenance:write":
								"メンテナンスウィンドウを作成・更新・早期終了・削除します。実行中のウィンドウは、対象モニターのアラートを抑制できます。",
							"dns-monitors:read":
								"DNSモニターと記録された名前解決の結果を一覧表示して読み取ります。",
							"dns-monitors:write": "DNSモニターを作成・更新・削除します。",
							"tcp-monitors:read": "TCPモニターと記録された接続結果を一覧表示して読み取ります。",
							"tcp-monitors:write": "TCPモニターを作成・更新・削除します。",
							"alerts:read":
								"アラートと発生したイベントを一覧表示して読み取ります。WebhookのURLなどチャネルの秘密情報が返されることはありません。",
							"alerts:write":
								"Webhookやチャットの送信先を含め、アラートを作成・更新・削除します。アラートを削除すると、そのアラートによる通知はすべて停止します。",
							"status-pages:read":
								"チームのステータスページと、各ページに紐づくモニターを一覧表示して読み取ります。",
							"status-pages:write":
								"ステータスページを作成・更新・削除し、ページが公開するモニターとCronジョブの組み合わせを差し替えます。",
							"cron-jobs:read": "チームのCronジョブとそのスケジュールを一覧表示して読み取ります。",
							"cron-jobs:write":
								"Cronジョブを作成・更新・削除します。削除すると、そのping URLは受け付けられなくなります。",
							"cron-jobs:ping":
								"CronジョブのpingURLのために用意されていますが、このURLは公開でスコープを確認しません。付与しても、キーの権限は変わりません。",
							"api-keys:read":
								"チームのAPIキーを名前・プレフィックス・スコープ・有効期限とともに一覧表示します。キーの本体が返されることはありません。",
							"api-keys:write":
								"チームのAPIキーを作成・削除します。新しいキーには任意のスコープを与えられるため、この権限があれば他のすべての権限を付与できます。",
							"ping:trigger":
								"モニターを作成せずに、単発のHTTP・DNS・TCPチェックを実行します。1回のチェックにつき1pingとして課金され、有効なサブスクリプションが必要です。",
						} satisfies Record<ApiKeyScope, string>,
					},
					expiresAt: {
						label: "有効期限（任意）",
						description: "有効期限のないキーの場合は空のままにしてください。",
					},
				},

				actions: {
					cancel: "キャンセル",
					create: "APIキーを作成",
				},
			},

			table: {
				label: "APIキー",

				columns: {
					name: "名前",
					prefix: "キー",
					scopes: "権限",
					lastUsed: "最終使用",
					expires: "有効期限",
					actions: "アクション",
				},

				lastUsed: {
					never: "未使用",
				},

				expires: {
					never: "無期限",
				},

				actions: {
					menu: "アクションメニュー",
					delete: "キーを削除",
				},

				confirmation: {
					delete: "APIキー「{{name}}」を削除してもよろしいですか？この操作は取り消せません。",
				},
			},

			error: {
				forbidden: {
					title: "このページにアクセスする権限がありません。",
					description: "チーム管理者にお問い合わせください。",
				},

				unknown: {
					title: "予期しないエラーが発生しました。",
					description: "後でもう一度お試しいただくか、サポートにお問い合わせください。",
				},
			},
		},

		cronJobs: {
			header: {
				title: "Cronジョブ",
				action: {
					create: "Cronジョブを作成",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			empty: {
				title: "Cronジョブがありません",
				description:
					"スケジュールされたタスクを追跡するためのCronジョブモニターを作成してください。",
				cta: "Cronジョブを作成",
			},

			table: {
				label: "Cronジョブモニター",
				columns: {
					name: "名前",
					schedule: "スケジュール",
					status: "ステータス",
					lastPing: "最終Ping",
					nextExpected: "次回予定",
					actions: "アクション",
				},
				status: {
					healthy: "正常",
					late: "遅延",
					missed: "未実行",
					new: "新規",
				},
				disabled: "無効",
				actions: {
					edit: "編集",
					delete: "削除",
					confirmation: {
						delete: "{{name}}を削除してもよろしいですか？",
					},
				},
			},
		},

		createCronJob: {
			header: {
				title: "Cronジョブを作成",
				breadcrumb: {
					cronJobs: "Cronジョブ",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				sections: {
					basics: {
						title: "基本情報",
						description: "このジョブの名前と、その内容です。",
					},
					schedule: {
						title: "スケジュール",
						description: "ジョブの実行予定と、未実行と見なすまでに許容する遅れです。",
					},
					alerting: {
						title: "アラート",
						description: "予定していた実行が届かなかったときの動作です。",
					},
				},

				fields: {
					name: {
						label: "名前",
						placeholder: "日次バックアップ",
						description: "このCronジョブモニターの説明的な名前。",
					},
					description: {
						label: "説明",
						placeholder: "このジョブが何をするかの任意の説明",
						description: "このCronジョブを識別するための任意の説明。",
					},
					cronExpression: {
						label: "Cron式",
						placeholder: "0 * * * *",
						description: "Cronスケジュール式（例：'0 * * * *'は毎時）。",
					},
					gracePeriod: {
						label: "猶予期間",
						description: "遅延とマークする前に予定時刻からどれくらい待つか。",
						decrement: "猶予期間を減らす",
						increment: "猶予期間を増やす",
						unit: {
							minutes: "分",
							seconds: "秒",
						},
					},
					timezone: {
						label: "タイムゾーン",
						description: "Cronスケジュールのタイムゾーン。",
					},
					alertOnLate: {
						label: "遅延時にアラート",
						description: "ジョブが予定時刻に実行されなかった場合にアラートを送信します。",
					},
					enabled: {
						label: "有効",
						description: "このCronジョブの監視をすぐに開始します。",
					},
				},
				cta: "Cronジョブを作成",
			},
		},

		editCronJob: {
			header: {
				title: "Cronジョブを編集",
				breadcrumb: {
					cronJobs: "Cronジョブ",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			form: {
				sections: {
					basics: {
						title: "基本情報",
						description: "このジョブの名前と、その内容です。",
					},
					schedule: {
						title: "スケジュール",
						description: "ジョブの実行予定と、未実行と見なすまでに許容する遅れです。",
					},
					alerting: {
						title: "アラート",
						description: "予定していた実行が届かなかったときの動作です。",
					},
				},

				fields: {
					name: {
						label: "名前",
						placeholder: "日次バックアップ",
						description: "このCronジョブモニターの説明的な名前。",
					},
					description: {
						label: "説明",
						placeholder: "このジョブが何をするかの任意の説明",
						description: "このCronジョブを識別するための任意の説明。",
					},
					cronExpression: {
						label: "Cron式",
						placeholder: "0 * * * *",
						description: "Cronスケジュール式（例：'0 * * * *'は毎時）。",
					},
					gracePeriod: {
						label: "猶予期間",
						description: "遅延とマークする前に予定時刻からどれくらい待つか。",
						decrement: "猶予期間を減らす",
						increment: "猶予期間を増やす",
						unit: {
							minutes: "分",
							seconds: "秒",
						},
					},
					timezone: {
						label: "タイムゾーン",
						description: "Cronスケジュールのタイムゾーン。",
					},
					alertOnLate: {
						label: "遅延時にアラート",
						description: "ジョブが予定時刻に実行されなかった場合にアラートを送信します。",
					},
					enabled: {
						label: "有効",
						description: "このCronジョブを有効に監視するかどうか。",
					},
				},
				cancel: "キャンセル",
				cta: "変更を保存",
			},

			danger: {
				title: "危険な操作",

				description: "ここでの操作は元に戻せません。",
				warning: "この Cron ジョブを削除すると、ping の履歴とアラートが完全に失われます。",
				delete: {
					trigger: "モニターを削除",
					confirmTitle: "このCronジョブモニターを削除しますか？",
					confirmDescription: "Ping履歴も削除されます。この操作は元に戻せません。",
					confirm: "削除",
				},
			},
		},

		cronJobDetail: {
			header: {
				breadcrumb: {
					cronJobs: "Cronジョブ",
				},
				action: {
					edit: "編集",
					delete: "削除",
				},
			},

			alert: {
				subscription: {
					title: "モニターが一時停止されています！",
					description: "自動監視を続けるにはサブスクリプションが必要です。",
					cta: "監視を開始",
				},
			},

			info: {
				title: "Cronジョブ設定",
				schedule: "スケジュール",
				timezone: "タイムゾーン",
				status: "ステータス",
				gracePeriod: "猶予期間",
				gracePeriodValue: "猶予 {{duration}}",
				description: "説明",
			},

			stats: {
				totalPings: {
					label: "総Ping数",
					description: "受信したPingの数",
				},
				onTimeRate: {
					label: "時間通り率",
					description: "時間通りのPingの割合",
				},
				lastPing: {
					label: "最終Ping",
					description: "最後のPingを受信した時刻",
					never: "未受信",
				},
				nextExpected: {
					label: "次回予定",
					description: "次のPingが予定されている時刻",
				},
			},

			ping: {
				title: "このモニターにPingを送信",
				description:
					"ジョブの完了後、`cron-jobs:ping` スコープを持つ API キーを添えて、ここに POST リクエストを送信してください。",
				snippet: {
					curl: "スクリプトから",
					copyCurl: "コマンドをコピー",
					crontab: "crontab から",
					copyCrontab: "crontab の行をコピー",
				},
				apiKey: {
					text: "そのスコープを持つキーがない場合、Ping は 401 で拒否され、その実行は未受信として扱われます。",
					cta: "API キーを作成",
				},
			},

			uptimeHistory: "稼働履歴",

			pings: {
				title: "Ping履歴",
				description: "このCronジョブから受信した最近のPing",
				empty:
					"まだPingを受信していません。ジョブが最初のPingを送信した後、ここにPingが表示されます。",
				label: "Ping",
				columns: {
					time: "時刻",
					status: "ステータス",
					sourceIp: "送信元IP",
				},
				status: {
					onTime: "時間通り",
					late: "遅延",
				},
			},

			integration: {
				title: "統合ガイド",
				description:
					"Cronジョブが完了したら、このエンドポイントにPOSTリクエストを送信してください。",
				endpoint: "Pingエンドポイント",
				curlExample: "cURLの例",
				codeExamples: {
					title: "コード例",
					bash: "Bash / Cron",
					python: "Python",
					nodejs: "Node.js",
				},
				apiKeyNote:
					"'cron-jobs:ping'スコープを持つAPIキーが必要です。APIキー設定で作成してください。",
			},

			delete: {
				confirmation: "{{name}}を削除してもよろしいですか？この操作は取り消せません。",
			},
		},
	},

	docs: {
		meta: {
			title: "ドキュメント - Uptime",
			description:
				"監視サービス Uptime のドキュメントです。モニター、アラート、ステータスページなどの使い方をご紹介します。",
		},

		header: {
			cta: {
				in: "ダッシュボードを開く",
				out: "監視を始める",
			},
		},

		sidebar: {
			title: "ドキュメント",
			description: "ガイドとリファレンス",
			searchPlaceholder: "検索...",
			openMenu: "メニューを開く",
			closeMenu: "メニューを閉じる",
		},

		nav: {
			gettingStarted: "はじめかた",
			overview: "概要",
			quickstart: "クイックスタート",

			api: "APIリファレンス",
			apiOverview: "API概要",
			authentication: "認証",
			errors: "エラー",

			resources: "リソース",
			monitors: "モニター",
			dnsMonitors: "DNSモニター",
			tcpMonitors: "TCPモニター",
			cronJobs: "Cronジョブ",
			alerts: "アラート",
			statusPages: "ステータスページ",
		},

		error: {
			title: "ドキュメントの読み込みエラー",
			description: "このドキュメントページの読み込み中にエラーが発生しました。",
			notFoundTitle: "ページが見つかりません",
			notFoundDescription: "お探しのドキュメントページは存在しません。",
		},

		lastUpdated: "最終更新: {{date}}",
	},
};
