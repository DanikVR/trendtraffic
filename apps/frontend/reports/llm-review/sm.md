# LLM Review: Samoan (sm)

**Model:** gemini-2.5-flash  
**Took:** 179.5s  
**Fixes proposed:** 97 (valid after placeholder-check: 93)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Fa'atulagaga a le Kamupani | **Fa'atulagaga Enterprise** | Preserve brand name 'Enterprise'. |
| `nav.billing` | Tau o Fefa'ataua'iga | **Fuafuaga** | Wrong word sense: 'Tariffs/Plans' not 'Trade prices'. |
| `rooms.tabs.questFlow` | Tafega o Sailiga | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `balance.minutes` | {{count}} minute | **{{count}} min** | Use short form 'min' as per instructions. |
| `balance.minutes_one` | {{count}} minute | **{{count}} min** | Use short form 'min' as per instructions. |
| `balance.minutes_few` | {{count}} minute | **{{count}} min** | Use short form 'min' as per instructions. |
| `balance.minutes_many` | {{count}} minute | **{{count}} min** | Use short form 'min' as per instructions. |
| `balance.minutesShort` | minute | **min** | Use short form 'min' as per instructions. |
| `balance.openPlans` | Tatala lafoga ma paleni | **Tatala fuafuaga ma paleni** | Wrong word sense: 'Tariffs/Plans' not 'taxes'. |
| `balance.tariffs` | Tau o Fefa'ataua'iga | **Fuafuaga** | Wrong word sense: 'Tariffs/Plans' not 'Trade prices'. |
| `tier.trial` | Faamasinoga | **Fa'ata'ita'iga** | Wrong word sense: 'Trial' (subscription) not 'court trial'. |
| `tier.plus` | Fa'aopoopo | **Plus** | Preserve brand name 'Plus'. |
| `tier.standard` | Tulaga Masani | **Standard** | Preserve brand name 'Standard'. |
| `tier.standardYearly` | Tausaga ta'itasi | **Yearly** | Preserve brand name 'Yearly'. |
| `tier.enterprise` | Pisinisi | **Enterprise** | Preserve brand name 'Enterprise'. |
| `moreSheet.enterprise.label` | Fa'atulagaga a le Kamupani | **Fa'atulagaga Enterprise** | Preserve brand name 'Enterprise'. |
| `moreSheet.enterprise.sub` | Ki Gemini, Tafe o le Sailiga, pine, CRM | **Ki Gemini, Quest Flow, pine, CRM** | Preserve brand name 'Quest Flow'. |
| `call.toPlayground` | 🎯 I le fanua lafoa'i otaota | **🎯 I le malae a'oa'oga** | Wrong word sense: 'proving ground' not 'dump'. |
| `coach.pin` | Fa'apipi'i i le pine | **Fa'apipi'i** | Button label too long, simplify 'Pin'. |
| `roomActions.translation.disableSub` | O le a le toe fa'aleaogaina minute | **O le a le toe toesea minute** | Wrong word sense: 'debited/charged' not 'canceled'. |
| `billing.lowBalance` | {{n}} minute o le faaliliuga o totoe | **{{n}} min o le faaliliuga o totoe** | Use short form 'min' as per instructions. |
| `billing.topupCta` | Minute · €{{price}} | **Min · €{{price}}** | Use short form 'min' as per instructions. |
| `sip.newTrunk` | Ogaumu SIP fou | **SIP Trunk fou** | Wrong word sense: 'trunk' not 'oven'. Preserve 'Trunk'. |
| `sip.passwordLabel` | Numera e le iloa e sesi | **Upu faataga** | Wrong word sense: 'password' not 'number unknown to others'. |
| `sip.incoming.emptyHint` | Fausia se SIP URI tulaga ese + upu faataga/upu faalilolilo ina ia mafai e tagata faatau ona valaau atu ia te oe mai soo se telefoni, ona otometi lava lea ona faaliliuina e VibeVox lou leo i le taimi moni. | **Fausia se SIP URI tulaga ese + login/upu faataga ina ia mafai e tagata faatau ona valaau atu ia te oe mai soo se telefoni, ona otometi lava lea ona faaliliuina e VibeVox lou leo i le taimi moni.** | Preserve 'login' as per instructions. |
| `sip.incoming.pausedHint` | Fa'agaoioi le feso'ota'iga ina ia mafai ai e le VibeVox ona fa'aliliuina telefoni o lo'o o'o mai. | **Fa'agaoioi le taliaina ina ia mafai ai e le VibeVox ona fa'aliliuina telefoni o lo'o o'o mai.** | Wrong word sense: 'reception' not 'connection'. |
| `sip.incoming.toggleFailed` | Ua le manuia le suiina o le avanoa e tali ai fesili | **Ua le manuia le suiina o le taliaina** | Wrong word sense: 'reception' not 'opportunity to answer questions'. |
| `sip.outbound.noTrunkTitle` | Muamua, fa'atulaga se pusa SIP e alu ese atu | **Muamua, fa'atulaga se SIP Trunk e alu ese atu** | Wrong word sense: 'trunk' not 'box'. Preserve 'Trunk'. |
| `sip.howTo.step1` | Ia maua fa'amaoniga o le SIP trunk mai lau tautua (Zadarma, OnlinePBX, Asterisk). | **Ia maua fa'amaoniga o le SIP Trunk mai lau tautua (Zadarma, OnlinePBX, Asterisk).** | Preserve 'SIP Trunk' as per instructions. |
| `sip.howTo.step3` | O le a otometi lava ona fatuina e VibeVox se pusa SIP e alu ese atu i le LiveKit Cloud. | **O le a otometi lava ona fatuina e VibeVox se SIP Trunk e alu ese atu i le LiveKit Cloud.** | Wrong word sense: 'trunk' not 'box'. Preserve 'Trunk'. |
| `sip.toasts.saved` | Ua sefeina fa'atulagaga o le SIP trunk | **Ua sefeina fa'atulagaga o le SIP Trunk** | Preserve 'SIP Trunk' as per instructions. |
| `sip.toasts.saveFailed` | Ua le mafai ona sefe le pusa | **Ua le mafai ona sefe le Trunk** | Wrong word sense: 'trunk' not 'box'. Preserve 'Trunk'. |
| `sip.toasts.deleted` | Ua tapeina le pusa. | **Ua tapeina le Trunk.** | Wrong word sense: 'trunk' not 'box'. Preserve 'Trunk'. |
| `sip.tenantOnly.title` | O lo'o fa'atulagaina o'oga SIP i le tulaga o le tenant | **O lo'o fa'atulagaina SIP Trunk i le tulaga o le tenant** | Wrong word sense: 'trunk' not 'school'. Preserve 'Trunk'. |
| `sip.connected` | Ua sefe ma fa'amaopoopoina le pusa SIP ma le LiveKit | **Ua sefe ma fa'amaopoopoina le SIP Trunk ma le LiveKit** | Wrong word sense: 'trunk' not 'box'. Preserve 'Trunk'. |
| `sip.danger.deleteTrunk` | Tape le pusa | **Tape le Trunk** | Wrong word sense: 'trunk' not 'box'. Preserve 'Trunk'. |
| `sip.danger.reissueHint` | Toe tu'uina atu le upu fa'alilolilo ma le upu fa'alilolilo mo le tuatusi SIP. O fa'amatalaga tuai o le a le toe aoga. | **Toe tu'uina atu le login ma le upu faataga mo le tuatusi SIP. O fa'amatalaga tuai o le a le toe aoga.** | Preserve 'login' and use correct 'password' translation. |
| `sip.confirm.deleteTrunkTitle` | Tape le pusa o le SIP? | **Tape le SIP Trunk?** | Wrong word sense: 'trunk' not 'box'. Preserve 'Trunk'. |
| `enterprise.page.title` | Fa'atulagaga a le Kamupani | **Fa'atulagaga Enterprise** | Preserve brand name 'Enterprise'. |
| `enterprise.page.upsellTitle` | O lo'o maua lenei vaega i le fuafuaga a le Enterprise. | **O lo'o maua lenei vaega i le fuafuaga Enterprise.** | Preserve brand name 'Enterprise'. |
| `enterprise.page.upsellCta` | Alu i lafoga | **Alu i fuafuaga** | Wrong word sense: 'tariffs/plans' not 'taxes'. |
| `enterprise.tabs.questFlow` | Tafega o Sailiga | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.gemini.telegram.leadStartCmd` | /amata | **/start** | Preserve command '/start' exactly. |
| `enterprise.gemini.telegram.testingLabel` | puloutau… | **O lo'o auina atu…** | Wrong word sense: 'sending' not 'hat/helmet'. |
| `enterprise.questFlow.heading` | Tafega o Sailiga | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.promptLabel` | Fa'aosofiaga o le Faiga o le Tafe o le Sailiga | **Fa'aosofiaga o le Faiga Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.kbLabel` | Fa'avae o le Malamalama i le Tafe o Sailiga | **Fa'avae o le Malamalama Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.keysHeading` | Ki o le Quest Flow API | **Ki Quest Flow API** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.errDelete` | Delete error | **Sese o le tapeina** | Translate 'Delete error' to Samoan. |
| `enterprise.questFlow.deleteTitle` | Delete | **Tape ese** | Translate 'Delete' to Samoan. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Tape le ki?** | Translate 'Delete key?' to Samoan. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **O le a tapeina le ki e faavavau. O le a le toe galue le Quest Flow e ala i ai — e tatau ona e fatuina se ki fou ma sui i le tafe.** | Translate English text to Samoan. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Tape ese** | Translate 'Delete' to Samoan. |
| `enterprise.questFlow.successPromptSaved` | Ua sefe le fa'amatalaga o le Quest Flow. | **Ua sefe le fa'amatalaga Quest Flow.** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.kbHeading` | Fa'avae o le Malamalama mo le Tafe o le Sailiga | **Fa'avae o le Malamalama mo Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.confirmKbDeleteBody` | O le a fa'amamāina le fa'avae o le malamalama o le Quest Flow. E le mafai ona toe fa'aleaogaina lenei gaioiga. | **O le a fa'amamāina le fa'avae o le malamalama Quest Flow. E le mafai ona toe fa'aleaogaina lenei gaioiga.** | Preserve brand name 'Quest Flow'. |
| `enterprise.chatwoot.successSaved` | Ua sefe. Kiliki nei le "Test Connection" e siaki ai. | **Ua sefe. Kiliki nei le "Su'ega Feso'ota'iga" e siaki ai.** | Translate 'Test Connection' to Samoan. |
| `chat.enterpriseOnlyHint` | O potu talatalanoaga o se vaega fa'apisinisi. Fa'aleleia lau fuafuaga i le vaega "Tau". | **O potu talatalanoaga o se vaega Enterprise. Fa'aleleia lau fuafuaga i le vaega "Fuafuaga".** | Preserve brand name 'Enterprise' and correct 'Tariffs/Plans' translation. |
| `insights.summary` | Amataga | **Aotelega** | Wrong word sense: 'Summary' not 'Beginning'. |
| `insights.sentiment` | Ki | **Lagona** | Wrong word sense: 'Sentiment' not 'Key'. |
| `insights.engagement` | Fa'amauga | **Fa'aaofia** | Wrong word sense: 'Engagement' not 'Fastening'. |
| `insights.leadScore` | Sikoa ta'ita'i | **Lead Score** | Preserve brand name 'Lead Score'. |
| `insights.analyzedReplies_one` | {{count}} kopi na iloiloina | **{{count}} tali na iloiloina** | Wrong word sense: 'reply' not 'copy'. |
| `insights.analyzedReplies_few` | {{count}} kopi na iloiloina | **{{count}} tali na iloiloina** | Wrong word sense: 'reply' not 'copy'. |
| `insights.analyzedReplies_many` | {{count}} kopi na iloiloina | **{{count}} tali na iloiloina** | Wrong word sense: 'reply' not 'copy'. |
| `insights.analyzedReplies_other` | {{count}} kopi na iloiloina | **{{count}} tali na iloiloina** | Wrong word sense: 'reply' not 'copy'. |
| `postCallInsights.subtitle` | Fa'alapotopotoga · va'aiga pe a uma le vala'au | **Enterprise · va'aiga pe a uma le vala'au** | Preserve brand name 'Enterprise'. |
| `postCallInsights.metricEngagement` | Fa'amauga | **Fa'aaofia** | Wrong word sense: 'Engagement' not 'Fastening'. |
| `postCallInsights.metricLeadScore` | Sikoa o le Ta'ita'i | **Lead Score** | Preserve brand name 'Lead Score'. |
| `postCallInsights.summary` | Amataga | **Aotelega** | Wrong word sense: 'Summary' not 'Beginning'. |
| `billingPage.title` | Tau ma totogi | **Fuafuaga ma totogi** | Wrong word sense: 'Tariffs/Plans' not 'Prices'. |
| `billingPage.balanceMinutes` | minute | **min** | Use short form 'min' as per instructions for short labels. |
| `billingPage.tierLabel` | Fua faatatau | **Fuafuaga** | Wrong word sense: 'Tariff/Plan' not 'Rate/Ratio'. |
| `billingPage.resume` | Amataga | **Toe fa'aauau** | Wrong word sense: 'Resume' not 'Beginning'. |
| `paywall.buyPlus` | Fa'aopoopo — €19/masina (60 minute) | **Plus — €19/masina (60 min)** | Preserve brand name 'Plus' and use short form 'min'. |
| `paywall.buyStandard` | Masani – €29/masina (120 minute) | **Standard – €29/masina (120 min)** | Preserve brand name 'Standard' and use short form 'min'. |
| `paywall.subscribe` | Fuafuaga | **Lesitala** | Wrong word sense: 'Subscribe' (verb) not 'Plan' (noun). |
| `paywall.featureMinutes` | {{count}} faaliliuga minute | **{{count}} min faaliliuga** | Use short form 'min' as per instructions. |
| `paywall.topupPerMin` | €0.17 / minute | **€0.17 / min** | Use short form 'min' as per instructions. |
| `paywall.topupFreeLine` | ↳ {{count}} minute e leai se totogi ma le tau | **↳ {{count}} min e leai se totogi ma le tau** | Use short form 'min' as per instructions. |
| `paywall.topupAddon` | Fa'atauga fa'aopoopo {{count}} la'ititi × €0.17 | **Fa'atauga fa'aopoopo {{count}} min × €0.17** | Wrong word sense: 'min' not 'small'. Use short form 'min'. |
| `billingPage.topupSliderMax` | {{max}} minute (10 itula) | **{{max}} min (10 itula)** | Use short form 'min' as per instructions. |
| `billingPage.minutesTimesPrice` | {{count}} minute × €{{price}} | **{{count}} min × €{{price}}** | Use short form 'min' as per instructions. |
| `billingPage.renewsOn` | fa'aopoopoga {{date}} | **fa'afouina {{date}}** | More accurate translation for 'renewal'. |
| `billingPage.minutesShort` | minute | **min** | Use short form 'min' as per instructions. |
| `billingPage.tierPlusName` | Fa'aopoopo | **Plus** | Preserve brand name 'Plus'. |
| `billingPage.tierPlusPrice` | €0.31 / minute | **€0.31 / min** | Use short form 'min' as per instructions. |
| `billingPage.tierStandardName` | Tulaga Masani | **Standard** | Preserve brand name 'Standard'. |
| `billingPage.tierStandardPrice` | €0.24 / minute | **€0.24 / min** | Use short form 'min' as per instructions. |
| `billingPage.tierEnterpriseName` | Pisinisi | **Enterprise** | Preserve brand name 'Enterprise'. |
| `billingPage.ctaSubscribePlus` | Maua le Plus | **Lesitala Plus** | More appropriate verb for 'Subscribe' and preserve 'Plus'. |
| `billingPage.ctaSubscribeStandard` | Poloaiga Masani | **Lesitala Standard** | More appropriate verb for 'Subscribe' and preserve 'Standard'. |
| `auth.common.passwordLabel` | Numera e le iloa e sesi | **Upu faataga** | Wrong word sense: 'password' not 'number unknown to others'. |

⚠ 4 fix(es) skipped (no-op, missing path, or would break placeholders).
