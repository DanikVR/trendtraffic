# LLM Review: Japanese (ja)

**Model:** gemini-2.5-flash  
**Took:** 134.7s  
**Fixes proposed:** 51 (valid after placeholder-check: 44)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.actions.delete` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `rooms.confirmDelete.confirm` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `common.delete` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `call.muted` | 音が出ない | **ミュート中** | 「ミュート中」は「muted」のより正確な翻訳です。 |
| `call.translatorJoining` | AI翻訳機のローンチ… | **AI翻訳機を起動中…** | 「起動中」はソフトウェアコンポーネントの開始により自然です。 |
| `call.cameraBlocked` | カメラやマイクの使用は禁止されています | **カメラまたはマイクが許可されていません** | システムによる「許可されていない」状態をより正確に表現します。 |
| `coach.tones.empathic` | 共感力のある | **共感的に** | 「トーン」の文脈では形容詞ではなく副詞が適切です。 |
| `sip.danger.deleteInbound` | 着信通話用のSIPアドレスを削除 | **着信用のSIPアドレスを削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `enterprise.common.delete` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `partner.title` | Partner program | **パートナープログラム** | 英語の文字列を日本語に翻訳します。 |
| `partner.subtitle` | Share your link and earn | **リンクを共有して稼ぐ** | 英語の文字列を日本語に翻訳します。 |
| `partner.yourLink` | Your link | **あなたのリンク** | 英語の文字列を日本語に翻訳します。 |
| `partner.copy` | Copy | **コピー** | 英語の文字列を日本語に翻訳します。 |
| `partner.copied` | ✓ Link copied | **✓ リンクがコピーされました** | 英語の文字列を日本語に翻訳します。 |
| `partner.stats.clicks` | Clicks | **クリック数** | 英語の文字列を日本語に翻訳します。 |
| `partner.stats.registrations` | Sign-ups | **登録数** | 英語の文字列を日本語に翻訳します。 |
| `partner.stats.paid` | Payments | **支払い** | 英語の文字列を日本語に翻訳します。 |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}}人 · {{minutes}}分** | 英語の単位を日本語に翻訳します。 |
| `partner.terms` | Program terms | **プログラム規約** | 英語の文字列を日本語に翻訳します。 |
| `partner.contact` | Contact us | **お問い合わせ** | 英語の文字列を日本語に翻訳します。 |
| `partner.termsModalTitle` | Partner program terms | **パートナープログラム規約** | 英語の文字列を日本語に翻訳します。 |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **プログラム規約はまだ設定されていません。SuperAdminにご連絡ください。** | 英語の文字列を日本語に翻訳します。 |
| `partner.loadError` | Failed to load partner data | **パートナーデータを読み込めませんでした** | 英語の文字列を日本語に翻訳します。 |
| `enterprise.gemini.leadPrefix` | 個人用キー | **AI Studioからの個人用キー** | 元のロシア語の文脈を補完します。 |
| `enterprise.gemini.deleteLabel` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `enterprise.gemini.confirmDeleteCta` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `enterprise.gemini.telegram.leadCreatePart1` | ボットを作成するには | **ボットを作成するには、** | 文の流れを改善するために読点を追加します。 |
| `enterprise.prompt.headerLeadPart1` | このセクションは | **このセクションは、** | 文の流れを改善するために読点を追加します。 |
| `enterprise.prompt.extendNoteText` | 独自のルール/スタイル/用語を持つこれらのプロンプトは、上記のデフォルトのプロンプトおよびナレッジベースと組み合わされます。 | **独自のルール/スタイル/用語で補足することができます。それらは上記のデフォルトプロンプトとナレッジベースと組み合わされます。** | 文法と文の流れを改善します。 |
| `enterprise.prompt.kbDeleteTitle` | ナレッジベースを削除する | **ナレッジベースを削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `enterprise.prompt.confirmKbDeleteCta` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `enterprise.questFlow.errDelete` | Delete error | **削除エラー** | 英語の文字列を日本語に翻訳します。 |
| `enterprise.questFlow.deleteTitle` | Delete | **削除** | 英語の文字列を日本語に翻訳します。 |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **キーを削除しますか？** | 英語の文字列を日本語に翻訳します。 |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **キーは復元できません。Quest Flowは機能しなくなります。新しいキーを作成し、フロー内で置き換える必要があります。** | 英語の文字列を日本語に翻訳します。 |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **削除** | 英語の文字列を日本語に翻訳します。 |
| `enterprise.questFlow.promptHeading` | Telegramでの会話を促す | **Telegram対話用プロンプト** | AIの文脈で「プロンプト」という技術用語を使用します。 |
| `enterprise.questFlow.promptLeadBold2` | 記入すると | **ご自身で入力すると** | 文の断片をより自然な表現に改善します。 |
| `enterprise.questFlow.kbLead2` | — AIは企業に関する事実を持たず、一般的な知識に基づいてのみ応答します。 | **— AIは企業に関する事実を持たず、一般的な知識に基づいてのみ応答します。このデータベースは** | 次の文の断片と接続し、文の流れを改善します。 |
| `enterprise.questFlow.kbLead3` | 「ヒント」セクションより（動画文字起こし用）。制限：ファイルサイズ50MB／データベース内の文字数50万文字。 | **「ヒント」セクション（動画文字起こし用）とは別個のものです。制限：ファイルサイズ50MB／データベース内の文字数50万文字。** | 前の文の断片と接続し、「別個の」というニュアンスを明確にします。 |
| `enterprise.questFlow.kbDeleteTitle` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `enterprise.questFlow.confirmKbDeleteCta` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `confirmModal.delete` | 消去 | **削除** | 「削除」はデータやアイテムの削除により一般的です。 |
| `billingPage.featureLearnHub` | AIラーニングハブ ― 独自の言語体系 | **AIラーニングハブ ― 独自の言語モデル** | AIの文脈では「言語モデル」がより適切です。 |

⚠ 7 fix(es) skipped (no-op, missing path, or would break placeholders).
