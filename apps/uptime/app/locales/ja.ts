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
			uptimeSla: "Uptime SLA",
			globalRegions: "グローバルリージョン",
			daysDataRetention: "日間データ保持",
			alertLatency: "アラート遅延",
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
						"99.9%の監視信頼性で24時間365日サービスを追跡します。詳細なメトリクスとパフォーマンスのインサイトを一目で確認できます。",
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
					first: { label: "Cloudflare：", body: "インフラ、ホスティング、コンテンツ配信" },
					second: { label: "Polar：", body: "決済処理とサブスクリプションの管理" },
					third: { label: "Resend：", body: "アラートや通知のメール配信" },
					fourth: { label: "GitHub：", body: "認証" },
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
					email: "privacy@sergiodxa.com",
				},
			},
		},
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
				},
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
	},

	contentMonitoring: {
		title: "コンテンツ監視",
		description:
			"特定のキーワードやパターンのレスポンスコンテンツをチェックします。いずれかのチェックが通らない場合、モニターは失敗となります。",
		empty:
			"コンテンツチェックが設定されていません。レスポンス内の特定のキーワードやパターンを監視するためのチェックを追加してください。",
		addButton: "コンテンツチェックを追加",

		form: {
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

	toasts: {
		refreshMonitor: {
			pending: "{{name}}をpingしています...",
			success: "{{name}}のpingが完了しました。",
			failure: "モニターの実行中にエラーが発生しました。",
		},

		deleteMonitor: {
			success: "{{name}}が削除されました。",
			failure: "{{name}}を削除できませんでした。もう一度お試しください。",
		},

		createMonitor: {
			pending: "モニター{{name}}を作成しています...",
			success: "{{name}}が作成されました。",
			failure: "{{name}}を作成できませんでした。もう一度お試しください。",
		},
	},

	emails: {
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
			incident:
				"このインシデントの通知：{{sent}}件送信、{{suppressed}}件はクールダウンとインシデントあたり{{cap}}件の上限により抑制されました。",
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
				resolvedValue: "解決された値",
				endpoint: "エンドポイント",
				schedule: "スケジュール",
				lastPing: "最終Ping",
				nextExpected: "次回予定",
				hostname: "ホスト名",
				expiresAt: "有効期限",
			},

			values: {
				none: "—",
				never: "なし",
				monitor: "{{name}}（{{type}}）",
				responseStatus: "{{actual}}（期待値：{{expected}}）",
				milliseconds: "{{value}}ms",
				domain: "{{domain}}（{{recordType}}）",
				endpoint: "{{host}}:{{port}}",
				schedule: "{{expression}}（{{timezone}}）",
			},
		},

		trial: {
			stopAction: "配信を停止する",
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
		},
	},

	components: {
		heatmap: {
			tooltip: "{{date}}\n成功率：{{successRate}}\nチェック数：{{checks}}",
			legend: {
				success: "成功",
				failure: "失敗",
				mixed: "混合",
				noData: "データなし",
			},
		},
		copyButton: {
			label: "コピー",
			copied: "コピーしました！",
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

		playMonitor: {
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このモニターは存在しません。",
			},

			pending: "{{name}}をpingしています...",
			success: "{{name}}のpingが完了しました。",
			failure: "モニターの実行中にエラーが発生しました。",
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
			errors: {
				generic: "エラーが発生しました。",
				notFound: "このDNSモニターは存在しません。",
				forbidden: "このDNSモニターをチェックする権限がありません。",
			},

			success: "{{name}}のDNSチェックが完了しました。",
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
				action: {
					create: "モニターを作成",
					refresh: "更新",
				},
			},

			quickPing: {
				title: "クイックチェック",
				description: "URLを1回チェック。保存もアラートもなし、pingを1回消費します。",
				field: {
					label: "URL",
					placeholder: "https://example.com/healthcheck",
				},
				action: {
					submit: "チェックを実行",
				},
				result: {
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
					description: "{{up}} 稼働中 / {{down}} 停止中",
				},
				dnsMonitors: {
					label: "DNSモニター",
					description: "{{ok}} 正常 / {{changed}} 変更 / {{error}} エラー",
				},
				tcpMonitors: {
					label: "TCPモニター",
					description: "{{up}} 稼働中 / {{down}} 停止中",
				},
				cronJobs: {
					label: "Cronジョブ",
					description: "{{healthy}} 正常 / {{late}} 遅延 / {{missed}} 未実行",
				},

				slowestEndpoint: {
					label: {
						default: "最も遅いエンドポイント「<em>{{name}}</em>」",
						noData: "最も遅いエンドポイント",
					},
					value: { noData: "N/A" },
					description: "過去24時間",
				},

				sslMonitors: {
					label: "SSLモニター",
					description: "{{valid}} 有効、{{expiring}} 期限間近、{{expired}} 期限切れ",
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

				cancel: "キャンセル",
				cta: "変更を保存",
			},

			ssl: {
				title: "SSL証明書の監視",
				cta: "SSL設定を保存",
			},

			dangerZone: {
				title: "危険ゾーン",
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
					description: "モニター全体のUptime",
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

			heatmap: {
				tooltip: "{{date}}\n成功率：{{successRate}}\nチェック数：{{checks}}",
				legend: {
					success: "成功",
					failure: "失敗",
					mixed: "混合",
					noData: "データなし",
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

					scope: {
						label: "対象範囲",
						teamWide: "チーム全体（すべてのモニター）",
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
						label: "クールダウン（分単位、0 = クールダウンなし）",
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
				},

				cooldown: {
					none: "なし",
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
				},

				cta: "ステータスページを作成",
				ctaUpdate: "変更を保存",
			},
		},

		createStatusPage: {
			header: {
				title: "ステータスページを作成",
			},
		},

		editStatusPage: {
			header: {
				title: "ステータスページを編集",
			},
		},

		httpMonitors: {
			header: {
				title: "HTTPモニター",
				action: {
					create: "モニターを作成",
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
					recordType: "タイプ",
					status: "ステータス",
					lastChecked: "最終チェック",
					actions: "アクション",
				},

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

					recordType: {
						label: "レコードタイプ",
						description: "チェックするDNSレコードのタイプ。",
					},

					expectedValue: {
						label: "期待値",
						placeholder: "192.168.1.1",
						description:
							"任意。解決された値が一致しない場合にアラートします。変更を追跡するには空のままにしてください。",
					},

					interval: {
						label: "チェック間隔",
						description: "DNSレコードをチェックする頻度。",
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
						description: "このDNSレコードの監視を直ちに開始します。",
					},
				},

				cta: "DNSモニターを作成",
			},
		},

		editDnsMonitor: {
			header: {
				title: "DNSモニターを編集",
			},

			form: {
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

					recordType: {
						label: "レコードタイプ",
						description: "チェックするDNSレコードのタイプ。",
					},

					expectedValue: {
						label: "期待値",
						placeholder: "192.168.1.1",
						description:
							"任意。解決された値が一致しない場合にアラートします。変更を追跡するには空のままにしてください。",
					},

					interval: {
						label: "チェック間隔",
						description: "DNSレコードをチェックする頻度。",
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
						description: "このDNSレコードを積極的に監視するかどうか。",
					},
				},

				cancel: "キャンセル",
				cta: "変更を保存",
			},

			dangerZone: {
				title: "危険な操作",
				deleteMonitor: "モニターを削除",
				deleteDescription: "チェック結果の履歴も削除されます。この操作は元に戻せません。",
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
				recordType: "レコードタイプ",
				status: "ステータス",
				expectedValue: "期待値",
				currentValue: "現在の値",
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

				avgResponseTime: {
					label: "平均応答時間",
					description: "平均DNS解決時間",
				},
			},

			results: {
				title: "チェック履歴",
				empty: "まだチェックが実行されていません。",

				table: {
					columns: {
						checkedAt: "チェック日時",
						status: "ステータス",
						value: "値",
						responseTime: "応答時間",
					},
				},
			},
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
			},

			endNow: {
				cta: "メンテナンスを今すぐ終了",
			},

			danger: {
				title: "危険な操作",

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
						label: "範囲",
						allMonitors: "すべてのモニター",
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
			},

			danger: {
				title: "危険な操作",

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
			meta: {
				title: "URL をチェック — Uptime",
				description:
					"アカウントなしで、任意の URL に対して当社ネットワークから実際のチェックを 1 回実行します。そのまま 1 週間の監視も可能です。",
			},

			heading: "いますぐ URL をチェック",
			intro:
				"URL を入力すると、当社ネットワークから実際のチェックを 1 回実行します。有料モニターが実行するものと同じチェックです。続行を依頼しない限り、何も保存されず、何も課金されません。",

			form: {
				url: {
					label: "チェックする URL",
					description: "公開インターネット上の http:// または https:// のアドレス。",
					placeholder: "https://example.com",
				},
				submit: "チェックを実行する",
			},

			refusal: {
				title: "チェックは実行されませんでした",
				blockedTarget:
					"そのアドレスは代理でチェックできません。ポート 80 または 443 の公開された http:// もしくは https:// の URL で、ユーザー名とパスワードを含まず、公開インターネット上のアドレスに解決される必要があります。",
				failedChallenge:
					"リクエストがブラウザーから送られたことを確認できませんでした。ページを再読み込みしてやり直してください。",
				rateLimited: "1 分後にもう一度チェックできます。",
				rateLimitedFor: "{{seconds}} 秒後にもう一度チェックできます。",
				budgetExhausted:
					"本日分の無料チェックはすべて実行済みです。これは当社側の事情で、あなたの URL の問題ではありません。明日また来ていただくか、監視を始めていただければ 1 分ごとにチェックします。",
				unavailable:
					"当社のプローブが応答しなかったため、URL について何も分かりませんでした。これは当社側の問題です。少し時間をおいてお試しください。",
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
				title: "変化があったらメールで通知",
				description:
					"メールアドレスを入力いただければ、同じチェックを 7 日間 1 時間ごとに実行し、1 日 1 回のまとめをお送りします。アカウントもカードも不要です。",
				consent: "Uptime 自体についても、ときどきメールを送ってよい。",
				consentNote: "どちらを選んでもチェックは届きます。",
				promise:
					"すべてのメールに、ワンクリックでチェックを止めてアドレスを削除するリンクが付いています。",
				submit: "この URL を 1 週間監視する",

				email: {
					label: "メールアドレス",
					placeholder: "you@example.com",
					error: "メールアドレスの形式ではないようです。",
				},
			},

			watching: {
				title: "監視を開始しました",
				description:
					"{{url}} の最初の 1 時間ごとのチェックは 1 時間後に実行されます。いま実行したチェックの控えはすでに受信箱に届いています。",
			},

			benefits: {
				title: "この 1 週間でできること",
				description: "有料モニターが教えてくれることを、この URL について 7 日間、無料で。",

				list: {
					hourly: {
						title: "1 時間ごとのチェック",
						description: "7 日間、有料モニターと同じネットワークから。",
					},
					changes: {
						title: "変化したときのメール",
						description:
							"落ちても戻っても分かります。1 日 1 通までなので、不安定なサイトでも受信箱があふれません。",
					},
					digest: {
						title: "1 日 1 通のまとめ",
						description: "URL の 1 日の状態が一目で分かります。",
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
					"無料の 1 週間は HTTP が対象です。有料アカウントでは、さらに 3 つを見守ります。",

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
				badge: "1 週間のあとに",
				title: "チェックはそのまま、残りを追加",
				description:
					"1 時間ごとではなく 1 分ごとに、URL は好きなだけ、通知は普段使っている場所へ。ステータスページと 1 年分の履歴も付いて月 {{price}} です。",
				action: "監視を始める",
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

			teams: {
				title: "チーム一覧",
				description: "所属しているチーム。",

				actions: {
					createTeam: "チームを作成",
				},

				empty: {
					title: "チームがありません",
					description: "サービスの監視を開始するためにチームを作成してください。",
					cta: "チームを作成",
				},

				table: {
					label: "チーム",
					description: "所属しているすべてのチーム。",

					columns: {
						team: "チーム",
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
						leave: "チームを離れる",
					},

					confirmation: {
						leaveTeam: "{{name}}を離れてもよろしいですか？",
					},
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
						placeholder: "タイムゾーンを選択",
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
						placeholder: "タイムゾーンを選択",
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
};
