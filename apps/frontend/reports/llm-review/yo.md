# LLM Review: Yoruba (yo)

**Model:** gemini-2.5-flash  
**Took:** 199.6s  
**Fixes proposed:** 59 (valid after placeholder-check: 59)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.confirmDelete.message` | Èyí yóò pa ìpàdé náà fún gbogbo àwọn olùkópa, yóò sì pa gbogbo dátà rẹ́. | **Èyí yóò pa ìpàdé náà fún gbogbo àwọn olùkópa, yóò sì pa gbogbo dátà náà rẹ́.** | Incorrect possessive pronoun 'rẹ' (your) for 'data'; should be 'náà' (the). |
| `balance.minutes` | {{count}} min | **ìṣẹ́jú {{count}}** | 'min' should be localized to 'ìṣẹ́jú' as per min_unit rule. |
| `balance.minutesShort` | min | **ìṣẹ́jú** | 'min' should be localized to 'ìṣẹ́jú' as per min_unit rule. |
| `coach.pin` | Fi hàn | **Fi mọ́lẹ̀** | 'Fi hàn' means 'show'; 'Fi mọ́lẹ̀' is more accurate for 'pin'. |
| `roomActions.delete` | Pa yara rẹ | **Pa yara náà rẹ́** | Incorrect possessive 'rẹ' (your); should be 'náà' (the). |
| `roomActions.deleteSub` | Pa ìpàdé náà kí o sì pa gbogbo ìwífún rẹ́ | **Pa ìpàdé náà kí o sì pa gbogbo ìwífún náà rẹ́** | Incorrect possessive 'rẹ' (your) for 'ìwífún' (information). |
| `billing.lowBalance` | {{n}} min ìtumọ̀ ló kù | **Ìṣẹ́jú ìtumọ̀ {{n}} ló kù** | 'min' should be localized to 'ìṣẹ́jú'. |
| `partner.title` | Partner program | **Ètò ìbáṣepọ̀** | English string, should be translated to Yoruba. |
| `partner.subtitle` | Share your link and earn | **Pín ìjápọ̀ rẹ kí o sì jẹ èrè** | English string, should be translated to Yoruba. |
| `partner.yourLink` | Your link | **Ìjápọ̀ rẹ** | English string, should be translated to Yoruba. |
| `partner.copy` | Copy | **Dáakọ** | English string, should be translated to Yoruba. |
| `partner.copied` | ✓ Link copied | **✓ A ti daakọ ìjápọ̀ náà** | English string, should be translated to Yoruba. |
| `partner.stats.clicks` | Clicks | **Àwọn ìtẹ̀sí** | English string, should be translated to Yoruba. |
| `partner.stats.registrations` | Sign-ups | **Àwọn ìforúkọsílẹ̀** | English string, should be translated to Yoruba. |
| `partner.stats.paid` | Payments | **Àwọn ìsanwó** | English string, should be translated to Yoruba. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **ènìyàn {{users}} · ìṣẹ́jú {{minutes}}** | English string, should be translated to Yoruba, and 'min' to 'ìṣẹ́jú'. |
| `partner.terms` | Program terms | **Àwọn òfin ètò** | English string, should be translated to Yoruba. |
| `partner.contact` | Contact us | **Kan sí wa** | English string, should be translated to Yoruba. |
| `partner.termsModalTitle` | Partner program terms | **Àwọn òfin ètò ìbáṣepọ̀** | English string, should be translated to Yoruba. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Àwọn òfin ètò náà kò tíì ṣètò. Jọ̀wọ́ kan sí SuperAdmin.** | English string, should be translated to Yoruba. |
| `partner.loadError` | Failed to load partner data | **Kò lè gbé àwọn dátà ìbáṣepọ̀ sókè** | English string, should be translated to Yoruba. |
| `sip.serverShort` | Olùṣàkóso | **Olùpín** | 'Olùṣàkóso' means manager; 'Olùpín' is more accurate for server. |
| `sip.loginShort` | Wo ile | **Ìwọlé** | 'Wo ile' is a verb; 'Ìwọlé' is the noun for login/username. |
| `sip.outbound.lead` | Pe nọ́mbà fóònù kan láti ojú-ọ̀nà wẹ́ẹ̀bù náà, VibeVox yóò sì túmọ̀ ìjíròrò rẹ láìfọwọ́kàn ní àkókò gidi. | **Pe nọ́mbà fóònù kan láti ojú-ọ̀nà wẹ́ẹ̀bù náà, VibeVox yóò sì túmọ̀ ìjíròrò rẹ láìfọwọ́sí ní àkókò gidi.** | 'láìfọwọ́kàn' (without touching) is less natural for 'automatically' than 'láìfọwọ́sí'. |
| `sip.outbound.noTrunkHint` | Kún fọ́ọ̀mù "New SIP Trunk" ní òkè ojú ìwé náà - VibeVox yóò lo olùpèsè SIP rẹ (Zadarma, OnlinePBX, Asterisk, FreePBX) fún àwọn ìpè tí ń jáde. | **Kún fọ́ọ̀mù "Apoti SIP tuntun" ní òkè ojú ìwé náà - VibeVox yóò lo olùpèsè SIP rẹ (Zadarma, OnlinePBX, Asterisk, FreePBX) fún àwọn ìpè tí ń jáde.** | 'New SIP Trunk' is not a brand name and should be translated. |
| `enterprise.questFlow.errDelete` | Delete error | **Àṣìṣe ìparẹ́** | English string, should be translated to Yoruba. |
| `enterprise.questFlow.deleteTitle` | Delete | **Paarẹ́** | English string, should be translated to Yoruba. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Pa kọ́kọ́rọ́ náà rẹ́?** | English string, should be translated to Yoruba. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **A ó pa kọ́kọ́rọ́ náà rẹ́ títí láé. Quest Flow kò ní ṣiṣẹ́ mọ́ nípasẹ̀ rẹ̀ — o yóò ní láti ṣẹ̀dá kọ́kọ́rọ́ tuntun kan kí o sì rọ́pò rẹ̀ nínú ìṣànwọ́.** | English string, should be translated to Yoruba. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Paarẹ́** | English string, should be translated to Yoruba. |
| `enterprise.chatwoot.tokenPlaceholder` | Agent access token | **Àmì ìwọlé aṣojú** | English string, should be translated to Yoruba. |
| `enterprise.chatwoot.whatSentFooter` | A firánṣẹ́ nígbà tí o bá fi ọwọ́ tẹ "Firánṣẹ́ sí CRM" nínú ìfọ̀rọ̀wérọ̀ yàrá. Fífiránṣẹ́ láìfọwọ́kàn lórí wíwá àmì ni ohun tó tẹ̀lé e. | **A firánṣẹ́ nígbà tí o bá fi ọwọ́ tẹ "Firánṣẹ́ sí CRM" nínú ìfọ̀rọ̀wérọ̀ yàrá. Fífiránṣẹ́ láìfọwọ́sí lórí wíwá àmì ni ohun tó tẹ̀lé e.** | 'láìfọwọ́kàn' (without touching) is less natural for 'автоматическая' (automatic) than 'láìfọwọ́sí'. |
| `chat.deleteMessage` | Pa ifiranṣẹ rẹ | **Pa ifiranṣẹ náà rẹ́** | Incorrect possessive 'rẹ' (your); should be 'náà' (the). |
| `chat.deleteMessageConfirmTitle` | Pa ifiranṣẹ rẹ rẹ́? | **Pa ifiranṣẹ náà rẹ́?** | Incorrect possessive 'rẹ' (your); should be 'náà' (the). |
| `chat.deleteMessageConfirmText` | A ko le yi igbese yi pada. A o pa awon oro ati awon ohun elo ti a so mo. | **A ko le yi igbese yi pada. A o pa ọ̀rọ̀ ati awon ohun elo ti a so mo.** | 'awon oro' means 'words'; 'ọ̀rọ̀' is more accurate for 'text'. |
| `paywall.buyPlus` | Plus — €19/osù (60 min) | **Plus — €19/oṣù (ìṣẹ́jú 60)** | 'min' should be localized to 'ìṣẹ́jú'. |
| `paywall.buyStandard` | Standard – €29/osù (120 min) | **Standard – €29/oṣù (ìṣẹ́jú 120)** | 'min' should be localized to 'ìṣẹ́jú'. |
| `paywall.featureMinutes` | Ìtumọ̀ {{count}} min | **Ìtumọ̀ ìṣẹ́jú {{count}}** | 'min' should be localized to 'ìṣẹ́jú'. |
| `paywall.topupPerMin` | €0.17 / min | **€0.17 / ìṣẹ́jú** | 'min' should be localized to 'ìṣẹ́jú'. |
| `paywall.topupCta` | Ra {{count}} min · €{{price}} | **Ra ìṣẹ́jú {{count}} · €{{price}}** | 'min' should be localized to 'ìṣẹ́jú'. |
| `paywall.topupPlusLine` | Tariff Plus ({{count}} min wà pẹ̀lú rẹ̀) | **Tariff Plus (ìṣẹ́jú {{count}} wà pẹ̀lú rẹ̀)** | 'min' should be localized to 'ìṣẹ́jú'. |
| `paywall.topupFreeLine` | ↳ {{count}} min ọfẹ pẹlu owo idiyele | **↳ ìṣẹ́jú {{count}} ọfẹ pẹlu owo idiyele** | 'min' should be localized to 'ìṣẹ́jú'. |
| `paywall.topupAddon` | Rira afikun {{count}} min × €0.17 | **Rira afikun ìṣẹ́jú {{count}} × €0.17** | 'min' should be localized to 'ìṣẹ́jú'. |
| `billingPage.tierPlusPrice` | €0.31 / min | **€0.31 / ìṣẹ́jú** | 'min' should be localized to 'ìṣẹ́jú'. |
| `billingPage.tierStandardPrice` | €0.24 / min | **€0.24 / ìṣẹ́jú** | 'min' should be localized to 'ìṣẹ́jú'. |
| `billingPage.topupSliderMax` | {{max}} min (Wákàtí 10) | **ìṣẹ́jú {{max}} (Wákàtí 10)** | 'min' should be localized to 'ìṣẹ́jú'. |
| `billingPage.presetHours` | {{count}}h | **wákàtí {{count}}** | 'h' is English; should be localized to 'wákàtí'. |
| `billingPage.presetMinutes` | {{count}}m | **ìṣẹ́jú {{count}}** | 'm' is English; should be localized to 'ìṣẹ́jú'. |
| `enterprise.prompt.subtitle` | Prompt àti ìpìlẹ̀ ìmọ̀ fún ìkọ̀wé ní àwọn yàrá fídíò nìkan | **Prompt àti ìpìlẹ̀ ìmọ̀ fún ìṣàlàyé ní àwọn yàrá fídíò nìkan** | 'ìkọ̀wé' means 'writing'; 'ìṣàlàyé' (explanation) is more fitting for 'расшифровки'. |
| `enterprise.prompt.headerLeadBold1` | fún ìkọ̀wé àwọn ìránṣẹ́ nínú àwọn yàrá fídíò nìkan | **fún ìṣàlàyé àwọn ìránṣẹ́ nínú àwọn yàrá fídíò nìkan** | 'ìkọ̀wé' means 'writing'; 'ìṣàlàyé' (explanation) is more fitting for 'расшифровки'. |
| `enterprise.prompt.kbLead` | Gbe iwe kan soke—katalog, FAQ, akojọ idiyele, awọn ofin, tabi awọn ohun elo itọkasi. A ṣe itupalẹ akoonu naa lori olupin (Word/Excel/CSV → ọrọ) ati pe AI ṣe afikun nigbati o ba n kọ awọn ifiranṣẹ ni awọn yara fidio. Idiwọn: 50 MB faili / 500,000 awọn kikọ ninu ibi ipamọ data. | **Gbe iwe kan soke—katalog, FAQ, akojọ idiyele, awọn ofin, tabi awọn ohun elo itọkasi. A ṣe itupalẹ akoonu naa lori olupin (Word/Excel/CSV → ọrọ) ati pe AI ṣe afikun nigbati o ba n ṣàlàyé àwọn ìránṣẹ́ ní àwọn yàrá fídíò. Idiwọn: 50 MB faili / 500,000 awọn kikọ ninu ibi ipamọ data.** | 'n kọ awọn ifiranṣẹ' means 'writing messages'; 'n ṣàlàyé àwọn ìránṣẹ́' (explaining messages) is more fitting for 'расшифровке'. |
| `enterprise.prompt.kbDeleteTitle` | Pa ipilẹ imọ rẹ rẹ́ | **Pa ipilẹ imọ náà rẹ́** | Incorrect possessive 'rẹ' (your); should be 'náà' (the). |
| `enterprise.prompt.confirmKbDeleteTitle` | Pa ipilẹ imọ rẹ? | **Pa ipilẹ imọ náà?** | Incorrect possessive 'rẹ' (your); should be 'náà' (the). |
| `enterprise.prompt.presetsLeadPart1` | Nínú ìfọ̀rọ̀wérọ̀ yàrá Enterprise, o lè tẹnu mọ́ ìfiranṣẹ́ èyíkéyìí kí o sì béèrè lọ́wọ́ AI láti ṣàlàyé rẹ̀ pẹ̀lú ohùn tí o yàn. | **Nínú ìfọ̀rọ̀wérọ̀ yàrá Enterprise, o lè tẹnu mọ́ ìfiranṣẹ́ èyíkéyìí kí o sì béèrè lọ́wọ́ AI láti ṣàlàyé rẹ̀ pẹ̀lú ohùn tí o yàn. Bùtọ́ọ̀nù** | Translation is truncated; 'Кнопка' (Button) is missing. |
| `enterprise.questFlow.kbLead3` | Láti inú abala "Àwọn Àmọ̀ràn"—fún ìkọ̀wé fídíò. Ààlà: fáìlì 50 MB / àwọn ohun kikọ 500,000 nínú ibi ìkópamọ́ dátà. | **Láti inú abala "Àwọn Àmọ̀ràn"—fún ìṣàlàyé fídíò. Ààlà: fáìlì 50 MB / àwọn ohun kikọ 500,000 nínú ibi ìkópamọ́ dátà.** | 'ìkọ̀wé fídíò' means 'video writing'; 'ìṣàlàyé fídíò' (video explanation) is more fitting for 'расшифровки видео'. |
| `enterprise.questFlow.confirmKbDeleteTitle` | Pa ipilẹ imọ rẹ? | **Pa ipilẹ imọ náà?** | Incorrect possessive 'rẹ' (your); should be 'náà' (the). |
| `postCallInsights.metricSentiment` | Ìwà | **Ìfẹ́-ọkàn** | 'Ìwà' means character/behavior; 'Ìfẹ́-ọkàn' is more accurate for sentiment/mood. |
| `postCallInsights.metricLeadScore` | Àmì Àkọ́kọ́ | **Àmì ìṣáájú** | Inconsistent translation for 'Lead Score'; 'Àmì ìṣáájú' is better and consistent. |
| `postCallInsights.summary` | Ìbẹ̀rẹ̀ iṣẹ́-ṣíwájú | **Àkópọ̀** | Inconsistent translation for 'Резюме'; 'Àkópọ̀' is better and consistent. |
