# LLM Review: Shona (sn)

**Model:** gemini-2.5-flash  
**Took:** 221.9s  
**Fixes proposed:** 174 (valid after placeholder-check: 168)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.enterpriseSettings` | Zvirongwa zveBhizinesi | **Zvirongwa zveEnterprise** | 'Enterprise' is a brand/tier name, should be preserved. |
| `nav.home` | Musha | **Kumba** | 'Kumba' is more appropriate for 'To home/main'. |
| `rooms.tabs.questFlow` | Kuyerera kweKutsvaga | **Quest Flow** | 'Quest Flow' is a brand name, should be preserved. |
| `rooms.actions.rename` | Zita idzva | **Tumidza zita idzva** | 'Zita idzva' means 'new name'. 'Tumidza zita idzva' means 'to rename'. |
| `common.success` | Kugadzirira | **Zvaitwa** | 'Kugadzirira' means 'readiness'. 'Zvaitwa' means 'Done'. |
| `balance.minutes` | {{count}} miniti | **{{count}} min** | 'min' is a preserved term for minutes. |
| `balance.minutes_one` | {{count}} miniti | **{{count}} min** | 'min' is a preserved term for minutes. |
| `balance.minutes_few` | {{count}} maminitsi | **{{count}} min** | 'min' is a preserved term for minutes. |
| `balance.minutes_many` | {{count}} maminitsi | **{{count}} min** | 'min' is a preserved term for minutes. |
| `balance.minutesShort` | miniti | **min** | 'min' is a preserved term for minutes. |
| `balance.openPlans` | Mitero yakavhurika uye yakaenzana | **Vhura zvirongwa uye kuenzana** | Literal translation, 'Open plans and balance' is better. |
| `tier.trial` | Kutongwa | **Nguva yekuedza** | 'Kutongwa' means 'legal trial'. 'Nguva yekuedza' means 'trial period'. |
| `tier.plus` | Uye zvakare | **Plus** | 'Plus' is a brand/tier name, should be preserved. |
| `tier.standard` | Zvakajairika | **Standard** | 'Standard' is a brand/tier name, should be preserved. |
| `tier.standardYearly` | Gore negore | **Yearly** | 'Yearly' is a brand/tier name, should be preserved. |
| `tier.enterprise` | Bhizinesi | **Enterprise** | 'Enterprise' is a brand/tier name, should be preserved. |
| `languagePicker.searchPlaceholder` | Tiri kutsvaga mutauro... | **Tsvaga mutauro...** | More concise and direct translation for 'Search...'. |
| `moreSheet.enterprise.label` | Zvirongwa zveBhizinesi | **Zvirongwa zveEnterprise** | 'Enterprise' is a brand/tier name, should be preserved. |
| `moreSheet.enterprise.sub` | Kiyi yeGemini, Kuyerera kweKutsvaga, ma tag, CRM | **Kiyi yeGemini, Quest Flow, ma tag, CRM** | 'Quest Flow' is a brand name, should be preserved. |
| `call.geminiLive` | Gemini Mhenyu | **Gemini Live** | 'Live' is a brand/feature name, should be preserved. |
| `call.toPlayground` | 🎯 Kunzvimbo yekurasira marara | **🎯 Kunhandare yekudzidzira** | 'Kurasira marara' means 'dumping ground'. 'Nhandare yekudzidzira' means 'training ground'. |
| `call.sentToPlayground` | ✅ Mutsara wacho watumirwa kunzvimbo yekudzidzira! | **✅ Mutsara wacho watumirwa kunhandare yekudzidzira!** | Consistent with 'playground' fix. |
| `call.playgroundTip` | Tumira chirevo kunzvimbo yekudzidzira yeAI | **Tumira chirevo kunhandare yekudzidzira yeAI** | Consistent with 'playground' fix. |
| `settings.themeDarkSub` | Gomba Rekudzika Aurora (Rima) | **Abyss Aurora (Dark)** | 'Abyss Aurora' is a brand name, should be preserved. |
| `settings.themeLightSub` | Cloud Aurora (Chiedza) | **Cloud Aurora (Light)** | 'Cloud Aurora' is a brand name, should be preserved. |
| `coach.help` | Rubatsiro kumhinduro | **Batsira kupindura** | 'Rubatsiro kumhinduro' means 'help to the answer'. 'Batsira kupindura' means 'help to answer'. |
| `coach.thinking` | AI inofunga kuti... | **AI inofunga...** | 'kuti' is redundant here. |
| `coach.pin` | Pinda | **Sunga** | 'Pinda' means 'enter'. 'Sunga' means 'pin/fasten'. |
| `billing.lowBalance` | {{n}} maminitsi ekushandura asara | **{{n}} min ekushandura asara** | 'min' is a preserved term for minutes. |
| `billing.topupCta` | Maminetsi · €{{price}} | **min · €{{price}}** | 'min' is a preserved term for minutes. |
| `partner.title` | Partner program | **Chirongwa chekubatana** | 'Partner program' should be translated. |
| `partner.subtitle` | Share your link and earn | **Goverana chinongedzo chako uwane mari** | 'Share your link and earn' should be translated. |
| `partner.yourLink` | Your link | **Chinongedzo chako** | 'Your link' should be translated. |
| `partner.copy` | Copy | **Kopa** | 'Copy' should be translated. |
| `partner.copied` | ✓ Link copied | **✓ Chinongedzo chakakopwa** | 'Link copied' should be translated. |
| `partner.stats.clicks` | Clicks | **Kudzvanya** | 'Clicks' should be translated. |
| `partner.stats.registrations` | Sign-ups | **Kunyoresa** | 'Sign-ups' should be translated. |
| `partner.stats.paid` | Payments | **Kubhadhara** | 'Payments' should be translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} vanhu · {{minutes}} min** | 'users' should be translated. 'min' is preserved. |
| `partner.terms` | Program terms | **Mitemo yechirongwa** | 'Program terms' should be translated. |
| `partner.contact` | Contact us | **Bata nesu** | 'Contact us' should be translated. |
| `partner.termsModalTitle` | Partner program terms | **Mitemo yechirongwa chekubatana** | 'Partner program terms' should be translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Mitemo yechirongwa haisati yagadzwa. Ndapota bata SuperAdmin.** | 'Program terms are not set yet. Please contact SuperAdmin.' should be translated. |
| `partner.loadError` | Failed to load partner data | **Takundikana kurodha ruzivo rwekubatana** | 'Failed to load partner data' should be translated. |
| `toneMenu.tone` | Ruzha | **Matauriro** | 'Ruzha' means 'noise/sound'. 'Matauriro' is better for 'tone'. |
| `sip.newTrunk` | Bhuroko idzva reSIP | **Trunk itsva yeSIP** | 'Bhuroko' means 'block'. 'Trunk' is a preserved term. |
| `sip.editTrunk` | Chinja marongero e trunk | **Chinja marongero eTrunk** | 'Trunk' is a preserved term. |
| `sip.loginLabel` | Zita rekushandisa (kupinda muSIP) | **Zita rekushandisa (SIP login)** | 'Login' is a preserved term. |
| `sip.loginShort` | Pinda | **Login** | 'Pinda' means 'enter'. 'Login' is a preserved term. |
| `sip.trunkId` | ID yeTrunk | **Trunk ID** | 'Trunk' is a preserved term. |
| `sip.callerIdLabel` | ID yemunhu anofona (sarudzo) | **Caller ID (sarudzo)** | 'Caller ID' is a preserved term. |
| `sip.createTrunk` | Gadzira danda | **Gadzira Trunk** | 'Danda' means 'log/beam'. 'Trunk' is a preserved term. |
| `sip.outbound.noTrunkTitle` | Kutanga, gadzira trunk yeSIP inobuda | **Kutanga, gadzira SIP Trunk inobuda** | 'Trunk' is a preserved term. |
| `sip.outbound.configureFirst` | Kutanga, gadzira trunk yeSIP inobuda (fomu riri pamusoro) | **Kutanga, gadzira SIP Trunk inobuda (fomu riri pamusoro)** | 'Trunk' is a preserved term. |
| `sip.outbound.invalidNumber` | Ndapota isa nhamba chaiyo mufomati yepasi rose (+XXXXXXXXXXXX) | **Ndapota isa nhamba chaiyo mufomati yepasi rose (+XXXXXXXXXXX)** | Placeholder mismatch with source. |
| `sip.howTo.step1` | Wana matsamba eSIP trunk kubva kune anokupa ruzivo (Zadarma, OnlinePBX, Asterisk). | **Wana matsamba eSIP Trunk kubva kune anokupa ruzivo (Zadarma, OnlinePBX, Asterisk).** | 'Trunk' is a preserved term. |
| `sip.howTo.step3` | VibeVox ichagadzira otomatiki trunk yeSIP inobuda muLiveKit Cloud. | **VibeVox ichagadzira otomatiki SIP Trunk inobuda muLiveKit Cloud.** | 'Trunk' is a preserved term. |
| `sip.toasts.saved` | Marongero etrunk yeSIP akachengetedzwa | **Marongero eSIP Trunk akachengetedzwa** | 'Trunk' is a preserved term. |
| `sip.toasts.saveFailed` | Takundikana kuchengetedza trunk | **Takundikana kuchengetedza Trunk** | 'Trunk' is a preserved term. |
| `sip.toasts.deleted` | Bhuti rabviswa. | **Trunk yabviswa.** | 'Bhuti' means 'boot'. 'Trunk' is a preserved term. |
| `sip.toasts.deleteFailed` | Takundikana kudzima trunk | **Takundikana kudzima Trunk** | 'Trunk' is a preserved term. |
| `sip.tenantOnly.title` | Matrunk eSIP akagadzirwa padanho remurendi | **SIP Trunks inogadziriswa padanho remurendi** | 'Trunk' is a preserved term. |
| `sip.tenantOnly.hint2` | Pinda semushandisi wenguva dzose ane rentiantId yake yekugadzira trunk. | **Pinda semushandisi wenguva dzose ane tenantId yake yekugadzira Trunk.** | 'Trunk' is a preserved term. |
| `sip.connected` | Bhuti reSIP rakachengetwa uye rakawiriraniswa neLiveKit | **SIP Trunk yakachengetwa uye yakawiriraniswa neLiveKit** | 'Bhuti' means 'boot'. 'Trunk' is a preserved term. |
| `sip.danger.deleteTrunk` | Bvisa trunk | **Bvisa Trunk** | 'Trunk' is a preserved term. |
| `sip.danger.deleteTrunkHint` | Magadzirirwo acho achadzimwa. Mafoni anobuda achamira kusvika wagadzirazve trunk. | **Magadzirirwo acho achadzimwa. Mafoni anobuda achamira kusvika wagadzirazve Trunk.** | 'Trunk' is a preserved term. |
| `sip.danger.deleteInboundHint` | Mutemo weLiveKit wekutumira mameseji nekutumira mameseji zvichabviswa. Mafoni anouya haazogamuchirwi. | **LiveKit inbound Trunk uye dispatch rule zvichabviswa. Mafoni anouya haazogamuchirwi.** | 'Trunk' is a preserved term. |
| `sip.confirm.deleteTrunkTitle` | Bvisa trunk yeSIP here? | **Bvisa SIP Trunk here?** | 'Trunk' is a preserved term. |
| `sip.confirm.deleteTrunkBody` | Chiito ichi hachidzoreki. Kana chadzimwa, mafoni anobuda anomira kusvika trunk itsva yagadzirwa. | **Chiito ichi hachidzoreki. Kana chadzimwa, mafoni anobuda anomira kusvika Trunk itsva yagadzirwa.** | 'Trunk' is a preserved term. |
| `sip.confirm.deleteInboundBody` | Chiito ichi hachidzoreki. Mutemo wekupinda mukati nemutemo wekutumira muLiveKit Cloud uchabviswa. | **Chiito ichi hachidzoreki. Inbound Trunk + dispatch rule muLiveKit Cloud zvichabviswa.** | 'Trunk' is a preserved term. |
| `enterprise.page.title` | Zvirongwa zveBhizinesi | **Zvirongwa zveEnterprise** | 'Enterprise' is a brand/tier name, should be preserved. |
| `enterprise.page.upsellTitle` | Chikamu chino chinowanikwa pachirongwa cheBhizinesi. | **Chikamu chino chinowanikwa paEnterprise plan.** | 'Enterprise' is a brand/tier name, should be preserved. |
| `enterprise.page.upsellBody` | Pano unogona kugadzirisa: kiyi yeGemini API yako, ruzivo rwakakosha, kubatanidzwa neQuest Flow + Telegram bot, uye kubatana neChatwoot CRM. | **Pano unogona kugadzirisa: kiyi yeGemini API yako, prompt uye ruzivo, kubatanidzwa neQuest Flow + Telegram bot, uye kubatana neChatwoot CRM.** | 'Промпт' should be 'prompt'. 'Quest Flow' is a brand name. |
| `enterprise.tabs.questFlow` | Kuyerera kweKutsvaga | **Quest Flow** | 'Quest Flow' is a brand name, should be preserved. |
| `enterprise.gemini.aiStudioLink` | Studio yeAI | **AI Studio** | 'AI Studio' is a brand name, should be preserved. |
| `enterprise.gemini.telegram.leadStartCmd` | /kutanga | **/start** | '/start' is a preserved command. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Bot @{{username}} yakachengetedzwa. Munhu wese anotumira meseji /kutanga achagamuchira zviziviso. | **✓ Bot @{{username}} yakachengetedzwa. Munhu wese anotumira meseji /start achagamuchira zviziviso.** | '/start' is a preserved command. |
| `enterprise.gemini.telegram.testingLabel` | Ngowani… | **Tiri kutumira…** | 'Ngowani' means 'hat'. 'Tiri kutumira' means 'Sending...'. |
| `enterprise.prompt.subtitle` | Ruzivo rwakakosha uye ruzivo rwekunyora zvinyorwa mumakamuri evhidhiyo chete | **Prompt uye ruzivo rwekunyora zvinyorwa mumakamuri evhidhiyo chete** | 'Промпт' should be 'prompt'. |
| `enterprise.prompt.promptLabel` | Kukurumidza kwehurongwa (matauriro, maitiro, mazwi) | **System prompt (matauriro, maitiro, mazwi)** | 'Kukurumidza' means 'speed'. 'Промпт' should be 'prompt'. |
| `enterprise.prompt.savePrompt` | Chengetedza prom | **Chengetedza prompt** | 'Промпт' should be 'prompt'. |
| `enterprise.prompt.showDefault` | Chii chinoshandiswa neAI pakutanga? | **Chii chinoshandiswa neAI nekutadza?** | 'Pakutanga' means 'at first'. 'Nekutadza' means 'by default'. |
| `enterprise.prompt.defaultLabel` | Chikumbiro cheVibeVox chakajairika | **Default prompt yeVibeVox** | 'Chikumbiro chakajairika' means 'common request'. 'Default prompt' is better. |
| `enterprise.prompt.appendNote` | Unogona kuwedzera mitemo yako wega - ichasanganiswa neyakajairika. | **Unogona kuwedzera mitemo yako wega - ichasanganiswa neiyo default.** | 'Yakajairika' means 'common'. 'Default' is better. |
| `enterprise.prompt.headerLeadBold2` | "Zvichienderana nechikumbiro chako" | **"Zvichienderana neprompt yako"** | 'Chikumbiro' means 'request'. 'Prompt' is better. |
| `enterprise.prompt.contextHeading` | Chinyorwa / promt | **Chinyorwa / prompt** | 'Промпт' should be 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "Zvichienderana nechikumbiro chako" | **"Zvichienderana neprompt yako"** | 'Chikumbiro' means 'request'. 'Prompt' is better. |
| `enterprise.prompt.defaultSummary` | Zvinoshandiswa neAI (kana munda wako usina chinhu) - tinya kuti uone | **Zvinoshandiswa neAI nekutadza (kana munda wako usina chinhu) - tinya kuti uone** | 'По умолчанию' means 'by default'. |
| `enterprise.prompt.extendNoteText` | nemitemo/maitiro/mazwi avo - zvichabatanidzwa nechirevo chekare chiri pamusoro apa pamwe neruzivo rwacho. | **nemitemo/maitiro/mazwi avo - zvichabatanidzwa neiyo default prompt iri pamusoro apa pamwe neruzivo rwacho.** | 'Chirevo chekare' means 'old statement'. 'Default prompt' is better. |
| `enterprise.prompt.promptPlaceholder` | Chikumbiro chako... | **Prompt yako...** | 'Chikumbiro' means 'request'. 'Prompt' is better. |
| `enterprise.prompt.savePromptLabel` | Chengetedza prom | **Chengetedza prompt** | 'Промпт' should be 'prompt'. |
| `enterprise.prompt.successPromptSaved` | Chikumbiro chakachengetedzwa. | **Prompt yakachengetedzwa.** | 'Chikumbiro' means 'request'. 'Prompt' is better. |
| `enterprise.prompt.successFileUploaded` | Faira "{{filename}}" ({{format}}) yakarekodhwa - mavara e{{kbLength}} akachengetedzwa. | **Faira "{{filename}}" ({{format}}) yakaiswa - mavara e{{kbLength}} akachengetedzwa.** | 'Yakarekodhwa' means 'recorded'. 'Yakaiswa' means 'uploaded'. |
| `enterprise.prompt.presetsHeading` | Manzwi ekutsanangura anowanikwa nyore nyore | **Matauriro ekutsanangura anowanikwa nyore nyore** | 'Manzwi' means 'voices/sounds'. 'Matauriro' is better for 'tones'. |
| `enterprise.prompt.presetsLeadBold` | "Zvichienderana nechikumbiro chako" | **"Zvichienderana neprompt yako"** | 'Chikumbiro' means 'request'. 'Prompt' is better. |
| `enterprise.prompt.presetsLeadPart2` | inoshandisa chikumbiro chako kubva mundima iri pamusoro. | **inoshandisa prompt yako kubva mundima iri pamusoro.** | 'Chikumbiro' means 'request'. 'Prompt' is better. |
| `enterprise.questFlow.heading` | Kuyerera kweKutsvaga | **Quest Flow** | 'Quest Flow' is a brand name, should be preserved. |
| `enterprise.questFlow.warning` | Kana munda usina chinhu, mhinduro yeVibeVox inoshandiswa. | **Kana munda usina chinhu, VibeVox prompt inoshandiswa.** | 'Mhinduro' means 'answer'. 'Prompt' is better. |
| `enterprise.questFlow.promptLabel` | Kurudziro yeSisitimu Yekuyerera kweKutsvaga | **System prompt yeQuest Flow** | 'Kurudziro' means 'recommendation'. 'Промпт' should be 'prompt'. 'Quest Flow' is a brand name. |
| `enterprise.questFlow.kbLabel` | Nzvimbo yeRuzivo rweKuyerera kweKutsvaga | **Ruzivo rweQuest Flow** | 'Quest Flow' is a brand name. |
| `enterprise.questFlow.savePrompt` | Chengetedza prom | **Chengetedza prompt** | 'Промпт' should be 'prompt'. |
| `enterprise.questFlow.keysHeading` | Makiyi eQuest Flow API | **Quest Flow API makiyi** | 'Quest Flow' is a brand name. |
| `enterprise.questFlow.errDelete` | Delete error | **Chikanganiso chekudzima** | 'Delete error' should be translated. |
| `enterprise.questFlow.deleteTitle` | Delete | **Bvisa** | 'Delete' should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Bvisa kiyi here?** | 'Delete key?' should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Kiyi ichadzimwa zvachose. Quest Flow haichashandi nayo — uchafanira kugadzira kiyi itsva woitsiva muchirongwa.** | English text should be translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Bvisa** | 'Delete' should be translated. |
| `enterprise.questFlow.promptHeading` | Mazano ekukurukurirana kweTelegram | **Prompt yekukurukurirana kweTelegram** | 'Mazano' means 'advice'. 'Промпт' should be 'prompt'. |
| `enterprise.questFlow.promptLead2` | — chiziviso cheVibeVox chinoshandiswa (pazasi). | **— VibeVox prompt inoshandiswa (pazasi).** | 'Chiziviso' means 'notification'. 'Prompt' is better. |
| `enterprise.questFlow.promptLead3` | - ichabatanidzwa neruzivo rwekutanga uye ruzivo. | **- ichabatanidzwa nebasic prompt uye ruzivo.** | 'Ruzivo rwekutanga' means 'initial knowledge'. 'Basic prompt' is better. |
| `enterprise.questFlow.defaultSummary` | Zvinoshandiswa neAI (kana munda wako usina chinhu) - tinya kuti uone | **Zvinoshandiswa neAI nekutadza (kana munda wako usina chinhu) - tinya kuti uone** | 'По умолчанию' means 'by default'. |
| `enterprise.questFlow.promptPlaceholder` | Chikumbiro chako... | **Prompt yako...** | 'Chikumbiro' means 'request'. 'Prompt' is better. |
| `enterprise.questFlow.successPromptSaved` | Chikumbiro cheKuyerera kweKutsvaga chakachengetedzwa. | **Quest Flow prompt yakachengetedzwa.** | 'Chikumbiro' means 'request'. 'Prompt' is better. 'Quest Flow' is a brand name. |
| `enterprise.questFlow.kbHeading` | Ruzivo rweKuyerera kweKutsvaga | **Ruzivo rweQuest Flow** | 'Quest Flow' is a brand name. |
| `enterprise.questFlow.successFileUploaded` | Faira "{{filename}}" yakazadzwa ({{kbLength}} machari). | **Faira "{{filename}}" yakaiswa ({{kbLength}} machari).** | 'Yakazadzwa' means 'filled'. 'Yakaiswa' means 'uploaded'. |
| `enterprise.questFlow.confirmKbDeleteBody` | Ruzivo rweQuest Flow ruchabviswa. Chiito ichi hachigone kudzoserwa shure. | **Quest Flow ruzivo ruchabviswa. Chiito ichi hachigone kudzoserwa shure.** | 'Quest Flow' is a brand name. |
| `enterprise.chatwoot.successSaved` | Yakachengetedzwa. Zvino tinya "Test Connection" kuti utarise. | **Yakachengetedzwa. Zvino tinya "Kuedzwa kwekubatana" kuti utarise.** | 'Test Connection' should be translated. |
| `chat.refreshShort` | Tangisazve | **Gadziridza** | 'Tangisazve' means 'restart'. 'Gadziridza' means 'refresh'. |
| `chat.tone` | Ruzha | **Matauriro** | 'Ruzha' means 'noise/sound'. 'Matauriro' is better for 'tone'. |
| `chat.enterpriseOnlyHint` | Makamuri ekukurukurirana chinhu chinoshandiswa nebhizinesi. Simudzira hurongwa hwako muchikamu che "Mitengo". | **Makamuri ekukurukurirana chinhu cheEnterprise. Simudzira hurongwa hwako muchikamu che "Mitengo".** | 'Enterprise' is a brand/tier name, should be preserved. |
| `chat.telegramBadge` | Teregiramu | **Telegram** | 'Telegram' is a brand name, should be preserved. |
| `chat.analyzeTooltip` | Tarisa hurukuro | **Tanga kuongorora hurukuro** | 'Tarisa' means 'check/look'. 'Tanga kuongorora' means 'start analysis'. |
| `insights.recalc` | Rondedzera | **Verenga zvakare** | 'Rondedzera' means 'describe'. 'Verenga zvakare' means 'recalculate'. |
| `insights.sentiment` | Kiyi | **Matauriro** | 'Kiyi' means 'key'. 'Matauriro' is better for 'sentiment/tonality'. |
| `insights.leadScore` | Chibodzwa chekutungamira | **Lead Score** | 'Lead Score' is a preserved term. |
| `insights.analyzedReplies_one` | {{count}} kopi yakaongororwa | **{{count}} mhinduro yakaongororwa** | 'Kopi' means 'copy'. 'Mhinduro' is better for 'reply'. |
| `insights.analyzedReplies_few` | {{count}} makopi akaongororwa | **{{count}} mhinduro dzakaongororwa** | 'Makopi' means 'copies'. 'Mhinduro' is better for 'replies'. |
| `insights.analyzedReplies_many` | {{count}} makopi akaongororwa | **{{count}} mhinduro dzakaongororwa** | 'Makopi' means 'copies'. 'Mhinduro' is better for 'replies'. |
| `insights.analyzedReplies_other` | {{count}} makopi akaongororwa | **{{count}} mhinduro dzakaongororwa** | 'Makopi' means 'copies'. 'Mhinduro' is better for 'replies'. |
| `postCallInsights.subtitle` | Bhizinesi · ruzivo rwekumashure kwekufona | **Enterprise · ruzivo rwekumashure kwekufona** | 'Enterprise' is a brand/tier name, should be preserved. |
| `postCallInsights.metricLeadScore` | Chibodzwa Chekutungamira | **Lead Score** | 'Lead Score' is a preserved term. |
| `paywall.buyPlus` | Uye zvakare — €19 pamwedzi (maminitsi makumi matanhatu) | **Plus — €19/mwedzi (60 min)** | 'Plus' is a brand name. 'min' is a preserved term. |
| `paywall.buyStandard` | Zvakajairika – €29/mwedzi (120 min) | **Standard – €29/mwedzi (120 min)** | 'Standard' is a brand name. 'min' is a preserved term. |
| `paywall.subscribe` | Dhizaini | **Nyoresa** | 'Dhizaini' means 'design'. 'Nyoresa' means 'subscribe'. |
| `paywall.featureMinutes` | {{count}} shanduro yemaminitsi mashoma | **{{count}} min yekushandura** | 'min' is a preserved term. 'maminitsi mashoma' means 'few minutes'. |
| `paywall.featureHd` | Manzwi eHD, vhidhiyo, AI Coach | **HD-voices, vhidhiyo, AI Coach** | 'AI Coach' is a brand/feature name, should be preserved. |
| `paywall.topupPerMin` | €0.17 / miniti | **€0.17 / min** | 'min' is a preserved term. |
| `paywall.topupCta` | Tenga {{count}} miniti · €{{price}} | **Tenga {{count}} min · €{{price}}** | 'min' is a preserved term. |
| `paywall.topupNoSubInfo` | ℹ Hauna kunyoresa kuri kushanda. Uye zvakare zvichawedzerwa pakutenga kwako kwe€19/mwedzi—maminitsi makumi matanhatu anobatanidzwa muchirongwa chako, saka hapana imwe mari yekuwedzera. | **ℹ Hauna kunyoresa kuri kushanda. Plus zvichawedzerwa pakutenga kwako kwe€19/mwedzi—maminitsi makumi matanhatu anobatanidzwa muchirongwa chako, saka hapana imwe mari yekuwedzera.** | 'Uye zvakare' should be 'Plus' (brand name). |
| `paywall.topupPlusLine` | Mutero wekuwedzera ({{count}} min inosanganisirwa) | **Plus plan ({{count}} min inosanganisirwa)** | 'Mutero wekuwedzera' means 'additional tax'. 'Plus plan' is better. 'min' is preserved. |
| `paywall.topupFreeLine` | ↳ {{count}} miniti yemahara nemutengo | **↳ {{count}} min yemahara nemutengo** | 'min' is a preserved term. |
| `paywall.topupAddon` | Zvimwe zvekutenga {{count}} min × €0.17 | **Kuwedzera kutenga {{count}} min × €0.17** | 'Zvimwe zvekutenga' is a bit clunky. 'Kuwedzera kutenga' is more direct for 'addon purchase'. |
| `paywall.stripeNote` | Mari yekubhadhara inodzivirirwa neStripe. Maminetsi anongoiswa otomatiki mushure mekubhadhara. | **Mari yekubhadhara inodzivirirwa neStripe. Maminitsi anongoiswa otomatiki mushure mekubhadhara.** | 'Stripe' is a brand name, should be preserved. |
| `billingPage.resume` | Resume | **Tangazve** | 'Resume' should be translated. |
| `billingPage.checkoutNoUrl` | URL yeStripe Checkout haina kugamuchirwa | **Stripe Checkout URL haina kugamuchirwa** | 'Stripe Checkout' is a brand name, should be preserved. |
| `billingPage.topupHelp` | Chimwe chinotsvedza chekutenga. Chinowanikwa nekunyorera kuri kushanda. | **Top-up slider. Chinowanikwa nekunyorera kuri kushanda.** | 'Chimwe chinotsvedza' means 'something that slides'. 'Slider' is a preserved term. |
| `billingPage.topupCarried` | Yakambomiswa | **Yakaendeswa** | 'Yakambomiswa' means 'suspended'. 'Yakaendeswa' means 'carried over'. |
| `billingPage.tierPlusName` | Uye zvakare | **Plus** | 'Plus' is a brand/tier name, should be preserved. |
| `billingPage.tierStandardName` | Zvakajairika | **Standard** | 'Standard' is a brand/tier name, should be preserved. |
| `billingPage.tierEnterpriseName` | Bhizinesi | **Enterprise** | 'Enterprise' is a brand/tier name, should be preserved. |
| `billingPage.tierPlusPrice` | €0.31 / miniti | **€0.31 / min** | 'min' is a preserved term. |
| `billingPage.tierStandardPrice` | €0.24 / miniti | **€0.24 / min** | 'min' is a preserved term. |
| `billingPage.featureHd` | Manzwi ekushandura eHD (Aoede, Charon, Kore) | **HD-voices ekushandura (Aoede, Charon, Kore)** | 'Aoede, Charon, Kore' are brand names, should be preserved. |
| `billingPage.featureBranding` | Kugadzira makadhi emumba (logo, mavara) | **Branding yemakamuri (logo, mavara)** | 'Kugadzira makadhi emumba' means 'making room cards'. 'Branding' is better. |
| `billingPage.featureTelegramAuth` | Mvumo yeTelegram + kubatanidza kune kadhi | **Telegram-authorization + kubatanidza kune kadhi** | 'Telegram' is a brand name. 'Mvumo' means 'permission'. 'Authorization' is better. |
| `billingPage.featurePersonalPrompts` | Zvikumbiro zveAI zvemunhu oga | **Personal AI prompts** | 'Zvikumbiro' means 'requests'. 'Prompts' is better. |
| `billingPage.ctaSubscribePlus` | Wana Zvimwe | **Nyoresa Plus** | 'Wana Zvimwe' means 'Get More'. 'Nyoresa Plus' means 'Subscribe Plus'. 'Plus' is a brand name. |
| `billingPage.ctaSubscribeStandard` | Standard Order | **Nyoresa Standard** | 'Standard Order' is literal. 'Nyoresa Standard' means 'Subscribe Standard'. 'Standard' is a brand name. |
| `billingPage.whatsAppMessage` | Mhoroi! Ndiri kufarira chirongwa cheEnterprise VibeVox. | **Mhoroi! Ndiri kufarira Enterprise VibeVox plan.** | 'Enterprise' is a brand/tier name, should be preserved. |
| `billingPage.faqA3` | Full AI stack: makadhi evatengi ane auto-recognition, Telegram permission, personalized advices, Google Calendar, smart needs tagging, CRM export, kubatanidzwa ne questflow.pro, uye admin tab yakasiyana. | **Full AI stack: makadhi evatengi ane auto-recognition, Telegram authorization, personalized prompts, Google Calendar, smart needs tagging, CRM export, kubatanidzwa ne questflow.pro, uye admin tab yakasiyana.** | 'Telegram permission' should be 'Telegram authorization'. 'personalized advices' should be 'personalized prompts'. 'questflow.pro' is a brand name. |
| `billingPage.faqA4` | Chero chipi zvacho chinoenderana neRFC: Zadarma, OnlinePBX, Asterisk/FreePBX, nezvimwewo. VibeVox inogadzira trunk inobuda yega. | **Chero chipi zvacho chinoenderana neRFC: Zadarma, OnlinePBX, Asterisk/FreePBX, nezvimwewo. VibeVox inogadzira outbound Trunk automatically.** | 'Trunk' is a preserved term. 'Zadarma, OnlinePBX, Asterisk/FreePBX' are brand names. |
| `billingPage.topupSliderMax` | {{max}} maminiti (maawa gumi) | **{{max}} min (maawa gumi)** | 'min' is a preserved term. |
| `billingPage.autoRenewCancelledHint` | Maminitsi ehurongwa hwako anoshanda kusvika pazuva rino; unogona kutenga mamwe. Dzvanya "Resume" kana ukachinja pfungwa dzako. | **Maminitsi ehurongwa hwako anoshanda kusvika pazuva rino; unogona kutenga mamwe. Dzvanya "Tangazve" kana ukachinja pfungwa dzako.** | 'Resume' should be translated. |
| `billingPage.languagesNoResults` | Mutauro wacho hauna kuwanikwa pane runyorwa rwevanhu vanotsigirwa. | **Mutauro wacho hauna kuwanikwa pane runyorwa rwemitauro inotsigirwa.** | 'Vanhu vanotsigirwa' means 'supported people'. Should be 'supported languages'. |
| `auth.register.passwordHintShort` | Mabhii asingasviki masere | **Mabhii masere kana kupfuura** | 'Mabhii asingasviki masere' means 'less than 8 characters'. Should be '8 or more characters'. |
| `auth.register.ruleLength` | Mabhii asingasviki masere | **Mabhii masere kana kupfuura** | 'Mabhii asingasviki masere' means 'less than 8 characters'. Should be '8 or more characters'. |
| `auth.forgot.subtitle` | Isa email yako uye tichakutumira link yekudzoreredza dambudziko rako. | **Isa email yako uye tichakutumira link yekudzoreredza.** | 'Dambudziko rako' (your problem) is not in the source. |
| `auth.forgot.successHint` | Tarisa email yako kuti uone kana {{email}}. Kana usingaone email yacho, tarisa folder rako re spam. | **Tarisa email yako {{email}}. Kana usingaone email yacho, tarisa folder rako re spam.** | 'Kuti uone kana' (to see if) is redundant. Direct address is better. |

⚠ 6 fix(es) skipped (no-op, missing path, or would break placeholders).
