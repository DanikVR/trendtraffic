# LLM Review: Kinyarwanda (rw)

**Model:** gemini-2.5-flash  
**Took:** 219.2s  
**Fixes proposed:** 106 (valid after placeholder-check: 105)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `appTagline` | Ubuhinduzi bw'ubuhanga bwo gukora imibonano mpuzabitsina mu gihe nyacyo | **Ubuhinduzi bwa AI mu gihe nyacyo** | Incorrect translation of 'AI'; should be preserved as 'AI'. |
| `nav.enterpriseSettings` | Igenamiterere ry'ikigo | **Igenamiterere rya Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `nav.admin` | Ubuyobozi bw'ikipe | **Admin Panel** | More accurate and shorter for 'Admin panel', preserving 'Admin'. |
| `rooms.tabs.questFlow` | Urugendo rw'Ibirori | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `balance.minutes` | {{count}} umunota | **{{count}} min** | Preserve 'min' as a unit, consistent with source and other short forms. |
| `balance.minutesShort` | umunota | **min** | Preserve 'min' as a unit, consistent with source and other short forms. |
| `tier.plus` | Byongeye kandi | **Plus** | Preserve 'Plus' as a tier name. |
| `tier.standard` | Igisanzwe | **Standard** | Preserve 'Standard' as a tier name. |
| `tier.standardYearly` | Buri mwaka | **Yearly** | Preserve 'Yearly' as a tier name/modifier. |
| `tier.enterprise` | Ikigo | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `moreSheet.sip.sub` | Gushyiraho ibyuma by'imashini | **Gushyiraho Trunks** | Incorrect word sense for 'trunks'; preserve as technical term. |
| `moreSheet.enterprise.label` | Igenamiterere ry'ikigo | **Igenamiterere rya Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `moreSheet.admin.label` | Ubuyobozi bw'ikipe | **Admin Panel** | More accurate and shorter for 'Admin panel', preserving 'Admin'. |
| `call.aiSubtitles` | Imitwe y'ubuhanga bwo gukora imibonano mpuzabitsina (AI) | **AI Subtitles** | Incorrect translation of 'AI' and 'Subtitles'; preserve 'AI'. |
| `call.autoAI` | Imodoka (AI) | **Auto (AI)** | Incorrect word sense for 'Auto' (automatic, not car). |
| `call.toPlayground` | 🎯 Kujya aho imyanda ijugunywa | **🎯 Kuri ikibuga cy'imyitozo** | Incorrect word sense for 'playground'; use consistent translation. |
| `call.accessDenied` | Kugera kuri interineti birabujijwe | **Kugera birabujijwe** | Too specific, 'internet' not implied in source. |
| `call.roomFull` | 🚫 Icyumba kirimo abantu benshi - hari abantu 2 bamaze kwitabira | **🚫 Icyumba cyuzuye — hari abantu 2 bamaze kwitabira** | More concise and accurate translation for 'room full'. |
| `coach.help` | Igisubizo cy'ubufasha | **Fasha gusubiza** | Incorrect grammar; verb form needed. |
| `coach.tones.empathic` | Umuntu wishyira mu mwanya w'abandi | **Impuhwe** | Incorrect word type (noun phrase instead of adverb/adjective). |
| `coach.tonePrompts.short` | Igisubizo mu nteruro imwe ngufi | **Subiza mu nteruro imwe ngufi** | Incorrect grammar; verb form needed. |
| `billing.lowBalance` | {{n}} iminota yo guhindura irasigaye | **{{n}} min yo guhindura irasigaye** | Preserve 'min' as a unit, consistent with source. |
| `settings.themeDarkSub` | Inyenga Aurora (Icuraburindi) | **Abyss Aurora (Icuraburindi)** | Preserve 'Abyss Aurora' as a brand name. |
| `sip.subtitle` | Gushyiraho trunks zo guhamagara abantu binjira n'abasohoka | **Gushyiraho imiyoboro ya SIP yo guhamagara abantu binjira n'abasohoka** | Consistent translation for 'trunks' as 'imiyoboro ya SIP'. |
| `sip.newTrunk` | Isanduku nshya ya SIP | **Umuyoboro wa SIP mushya** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.editTrunk` | Hindura imiterere y'inyuma | **Hindura imiterere y'umuyoboro wa SIP** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.trunkId` | Indangamuntu y'isanduku | **ID y'umuyoboro wa SIP** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.createTrunk` | Kora icyuma gifata amasasu | **Kora umuyoboro wa SIP** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.outbound.noTrunkTitle` | Ubwa mbere, shyiraho igikoresho cya SIP gisohoka | **Ubwa mbere, shyiraho umuyoboro wa SIP usohoka** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.outbound.configureFirst` | Ubwa mbere, shyiraho icyuma cya SIP gisohoka (ishusho iri hejuru) | **Ubwa mbere, shyiraho umuyoboro wa SIP usohoka (ishusho iri hejuru)** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.toasts.saved` | Igenamiterere rya trunk ya SIP ryabitswe | **Igenamiterere ry'umuyoboro wa SIP ryabitswe** | Consistent translation for 'trunk' as 'umuyoboro wa SIP'. |
| `sip.toasts.saveFailed` | Yananiwe kubika trunk | **Yananiwe kubika umuyoboro wa SIP** | Consistent translation for 'trunk' as 'umuyoboro wa SIP'. |
| `sip.toasts.deleted` | Igitereko cy'inyuma cyasibwe. | **Umuyoboro wa SIP wasibwe.** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.toasts.deleteFailed` | Byananiwe gusiba trunk | **Byananiwe gusiba umuyoboro wa SIP** | Consistent translation for 'trunk' as 'umuyoboro wa SIP'. |
| `sip.tenantOnly.title` | Imitako ya SIP ishyirwaho ku rwego rw'abakodesha | **Imyoboro ya SIP ishyirwaho ku rwego rw'abakodesha** | Incorrect word sense for 'trunks'; use consistent translation. |
| `sip.tenantOnly.hint2` | Injira nk'umukoresha usanzwe ufite rentiantId ye bwite kugira ngo ukore trunk. | **Injira nk'umukoresha usanzwe ufite tenantId ye bwite kugira ngo ukore umuyoboro wa SIP.** | Consistent translation for 'trunk' as 'umuyoboro wa SIP' and preserve 'tenantId'. |
| `sip.connected` | Umubyimba wa SIP ubitswe kandi ugahuzwa na LiveKit | **Umuyoboro wa SIP ubitswe kandi ugahuzwa na LiveKit** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.danger.deleteTrunk` | Siba icyuma gifata | **Siba umuyoboro wa SIP** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.danger.deleteTrunkHint` | Igenamiterere rizasibwa. Guhamagara bizahagarara kugeza igihe wongeye gukora trunk. | **Igenamiterere rizasibwa. Guhamagara bizahagarara kugeza igihe wongeye gukora umuyoboro wa SIP.** | Consistent translation for 'trunk' as 'umuyoboro wa SIP'. |
| `sip.confirm.deleteTrunkTitle` | Siba umufuka wa SIP? | **Siba umuyoboro wa SIP?** | Incorrect word sense for 'trunk'; use consistent translation. |
| `sip.confirm.deleteTrunkBody` | Iki gikorwa ntigisubirwaho. Iyo gisibamye, guhamagara bizahagarara kugeza igihe hakozwe igikoresho gishya. | **Iki gikorwa ntigisubirwaho. Iyo gisibamye, guhamagara bizahagarara kugeza igihe hakozwe umuyoboro wa SIP mushya.** | Incorrect word sense for 'trunk'; use consistent translation. |
| `enterprise.page.title` | Igenamiterere ry'ikigo | **Igenamiterere rya Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `enterprise.page.upsellTitle` | Iki gice kiraboneka kuri gahunda y'ikigo. | **Iki gice kiraboneka kuri gahunda ya Enterprise.** | Preserve 'Enterprise' as a brand/tier name. |
| `enterprise.tabs.questFlow` | Urugendo rw'Ibirori | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.gemini.aiStudioLink` | Studio y'ubuhanga bwo gukora ai | **AI Studio** | Preserve 'AI Studio' as a brand name. |
| `enterprise.gemini.telegram.tokenLabel` | Igipimo cya bot ya Telegram | **Token ya bot ya Telegram** | Incorrect word sense for 'Token'; preserve as technical term. |
| `enterprise.gemini.telegram.errEnterToken` | Shyiramo ikimenyetso cya bot | **Shyiramo Token ya bot** | Consistent translation for 'Token'. |
| `enterprise.gemini.telegram.testingLabel` | Ingofero… | **Turimo kohereza...** | Incorrect word sense for 'Sending...'. |
| `enterprise.prompt.presetsLeadPart1` | Mu kiganiro cya Enterprise Room, ushobora gushyira ahagaragara ubutumwa ubwo aribwo bwose hanyuma ugasaba AI kubusobanura mu ijwi ryatoranijwe. | **Mu kiganiro cya Enterprise Room, ushobora gushyira ahagaragara ubutumwa ubwo aribwo bwose hanyuma ugasaba AI kubusobanura mu ijwi ryatoranijwe. Kanda** | Added 'Kanda' for 'Кнопка' (Button) to complete the sentence. |
| `enterprise.questFlow.heading` | Urugendo rw'Ibirori | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.promptLabel` | Uburyo bwo Gushakisha Uburyo bwo Gukoresha Sisitemu | **Uburyo bwa sisitemu ya Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.kbLabel` | Ishingiro ry'Ubumenyi bw'Umuvuduko w'Ibirori | **Ishingiro ry'Ubumenyi rwa Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.instructionLabel` | Amabwiriza yo gukoresha ubuhanga bwo gukora imibonano mpuzabitsina (AI) | **Amabwiriza ya AI** | Incorrect translation of 'AI'; should be preserved as 'AI'. |
| `enterprise.questFlow.keysHeading` | Imfunguzo za API z'Inzira y'Igerageza | **Imfunguzo za API za Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.keyLabelPlaceholder` | Ikirango (ni ngombwa), urugero: "Prod bot clinic" | **Ikirango (si ngombwa), urugero: "Prod bot clinic"** | Incorrect word sense for 'optional' (ni ngombwa -> si ngombwa). |
| `enterprise.questFlow.errDelete` | Delete error | **Ikosa ryo gusiba** | Translate to Kinyarwanda. |
| `enterprise.questFlow.deleteTitle` | Delete | **Siba** | Translate to Kinyarwanda. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Siba urufunguzo?** | Translate to Kinyarwanda. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Urufunguzo ruzasibwa burundu. Quest Flow izahagarara gukora binyuze kuri urwo rufunguzo — uzakenera gukora urufunguzo rushya no kurusimbuza muri Quest Flow.** | Translate to Kinyarwanda and preserve 'Quest Flow'. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Siba** | Translate to Kinyarwanda. |
| `enterprise.questFlow.successPromptSaved` | Ikibazo cyo gushakisha cyarabitswe. | **Prompt ya Quest Flow yabitswe.** | Preserve 'Prompt' and 'Quest Flow' as technical/brand terms. |
| `enterprise.questFlow.kbHeading` | Ishingiro ry'Ubumenyi ku Inzira y'Ubushake | **Ishingiro ry'Ubumenyi rwa Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.kbLeadBold2` | gutandukana | **itandukanye** | Incorrect word type (verb/noun instead of adjective). |
| `enterprise.chatwoot.tokenFieldLabel` | Ikimenyetso cyo kwinjira ku mukozi (kuva kuri Profile → Ikimenyetso cyo kwinjira) | **Agent Access Token (kuva kuri Profile → Access Token)** | Preserve 'Agent Access Token' as a technical term. |
| `enterprise.chatwoot.tokenPlaceholder` | Ikimenyetso cyo kwinjira ku mukozi | **Agent access token** | Preserve 'Agent access token' as a technical term. |
| `enterprise.chatwoot.successSaved` | Byabitswe. Noneho kanda "Test Connection" kugira ngo urebe. | **Byabitswe. Noneho kanda "Genzura isano" kugira ngo urebe.** | Translate 'Test Connection' to Kinyarwanda for consistency. |
| `chat.enterpriseOnlyHint` | Ibyumba byo kuganira ni umwihariko w'ikigo. Vugurura gahunda yawe mu gice cyitwa "Ibiciro". | **Ibyumba byo kuganira ni umwihariko wa Enterprise. Vugurura gahunda yawe mu gice cyitwa "Ibiciro".** | Preserve 'Enterprise' as a brand/tier name. |
| `insights.summary` | CV | **Incamake** | Incorrect word sense for 'Summary' (CV vs. summary). |
| `insights.sentiment` | Urufunguzo | **Ibyiyumvo** | Incorrect word sense for 'Sentiment' (key vs. feelings). |
| `insights.engagement` | Gusezerana | **Uruhare** | Incorrect word sense for 'Engagement' (marriage engagement vs. involvement). |
| `insights.leadScore` | Amanota y'ubuyobozi | **Lead Score** | Preserve 'Lead Score' as a sales funnel term. |
| `lobby.nameError` | Andika izina ryawe | **Nyamuneka andika izina ryawe** | Added 'Please' for politeness and completeness. |
| `lobby.shareSuccessHint` | ✓ Iyi link yakiriwe. Yohereze kuri telefoni / WhatsApp / Imeli. Ushobora gufunga urupapuro ubu—iyi link ihora ikora. | **✓ Iyi link yakiriwe. Yohereze kuri Telegram / WhatsApp / Imeli. Ushobora gufunga urupapuro ubu—iyi link ihora ikora.** | Preserve 'Telegram' as a brand name. |
| `paywall.buyPlus` | Byongeyeho — €19/ukwezi (iminota 60) | **Plus — €19/ukwezi (iminota 60)** | Preserve 'Plus' as a tier name. |
| `paywall.buyStandard` | Ibisanzwe – €29/ukwezi (iminota 120) | **Standard – €29/ukwezi (iminota 120)** | Preserve 'Standard' as a tier name. |
| `paywall.subscribe` | Igishushanyo | **Kwiyandikisha** | Incorrect word sense for 'Subscribe' (design vs. subscribe). |
| `paywall.featureMinutes` | {{count}} ubuhinduzi bw'iminota | **{{count}} min yo guhindura** | Preserve 'min' as a unit, consistent with source. |
| `paywall.topupPerMin` | €0.17 / umunota | **€0.17 / min** | Preserve 'min' as a unit, consistent with source. |
| `paywall.topupCta` | Gura {{count}} umunota · €{{price}} | **Gura {{count}} min · €{{price}}** | Preserve 'min' as a unit, consistent with source. |
| `paywall.topupNoSubInfo` | ℹ Nta kwiyandikisha ufite. Kandi bizongerwa ku kugura kwawe kuri €19/ukwezi—iminota 60 iri muri gahunda yawe, bityo nta kiguzi cy'inyongera gihari. | **ℹ Nta kwiyandikisha ufite. Kandi bizongerwa ku kugura kwawe kuri Plus €19/ukwezi—iminota 60 iri muri gahunda yawe, bityo nta kiguzi cy'inyongera gihari.** | Preserve 'Plus' as a tier name. |
| `paywall.topupPlusLine` | Inyongera y'amafaranga ({{count}} umunota uriho) | **Gahunda ya Plus ({{count}} min zirimo)** | Incorrect word sense for 'Plus plan'; preserve 'Plus' and 'min'. |
| `paywall.topupFreeLine` | ↳ {{count}} umunota w'ubuntu hamwe n'imisoro | **↳ {{count}} min z'ubuntu hamwe n'imisoro** | Preserve 'min' as a unit, consistent with source. |
| `paywall.topupAddon` | Ibindi bicuruzwa {{count}} umunota × €0.17 | **Kugura byiyongereyeho {{count}} min × €0.17** | Preserve 'min' as a unit and improve clarity. |
| `billingPage.resume` | CV | **Kongera kuvugurura** | Incorrect word sense for 'Resume' (CV vs. renew). |
| `billingPage.resumeTooltip` | Suzuma kuvugurura kwiyandikisha mu buryo bwikora. | **Kongera kuvugurura kwiyandikisha mu buryo bwikora.** | Incorrect word sense for 'Resume' (examine vs. renew). |
| `billingPage.resumed` | Kwiyandikisha byasubitswe | **Kwiyandikisha byasubukuwe** | Incorrect word sense for 'resumed' (postponed vs. restored). |
| `billingPage.promoApply` | Shyiraho umukono | **Koresha** | Incorrect word sense for 'Apply' (sign vs. use/apply). |
| `billingPage.topupCarried` | Byasubitswe | **Byimuwe** | Incorrect word sense for 'Carried over' (postponed vs. transferred). |
| `billingPage.tierPlusName` | Byongeye kandi | **Plus** | Preserve 'Plus' as a tier name. |
| `billingPage.tierStandardName` | Igisanzwe | **Standard** | Preserve 'Standard' as a tier name. |
| `billingPage.tierEnterpriseName` | Ikigo | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `billingPage.tierPlusPrice` | €0.31 / umunota | **€0.31 / min** | Preserve 'min' as a unit, consistent with source. |
| `billingPage.tierStandardPrice` | €0.24 / umunota | **€0.24 / min** | Preserve 'min' as a unit, consistent with source. |
| `billingPage.tierEnterpriseSummary` | Urupapuro rwuzuye rw'ubuhanga bwo gukora imibonano mpuzabitsina (AI) ku bucuruzi | **AI-stack yuzuye ku bucuruzi** | Incorrect translation of 'AI-stack'; preserve 'AI-stack'. |
| `billingPage.featureRollover` | Bikomeza iminota mike mu kwezi gutaha | **Kwimura iminota mu kwezi gutaha** | Incorrect word sense for 'Rollover' (continues vs. transfer). |
| `billingPage.ctaSubscribePlus` | Shaka Plus | **Kwiyandikisha kuri Plus** | Incorrect word sense for 'Subscribe' (get vs. subscribe). |
| `billingPage.ctaSubscribeStandard` | Igipimo ngenderwaho cy'itora | **Kwiyandikisha kuri Standard** | Incorrect word sense for 'Subscribe Standard' (election standard vs. subscribe). |
| `billingPage.languagesCount_few` | {{count}} ururimi | **{{count}} indimi** | Incorrect plural form for 'languages'. |
| `billingPage.faqQ3` | Ni iki ikigo cy’ubucuruzi kirimo? | **Ni iki Enterprise irimo?** | Preserve 'Enterprise' as a brand/tier name. |
| `billingPage.topupSliderMax` | {{max}} iminota (amasaha 10) | **{{max}} min (amasaha 10)** | Preserve 'min' as a unit, consistent with source. |
| `billingPage.autoRenewCancelledHint` | Inyandiko z'igenamigambi ryawe zirakora kugeza kuri iyi tariki; ushobora kugura izindi. Kanda "Subiramo" niba uhinduye igitekerezo. | **Inyandiko z'igenamigambi ryawe zirakora kugeza kuri iyi tariki; ushobora kugura izindi. Kanda "Kongera kuvugurura" niba uhinduye igitekerezo.** | Incorrect word sense for 'Resume' (repeat vs. renew). |
| `postCallInsights.subtitle` | Ikigo · ibitekerezo nyuma yo guhamagara | **Enterprise · ibitekerezo nyuma yo guhamagara** | Preserve 'Enterprise' as a brand/tier name. |
| `postCallInsights.metricEngagement` | Gusezerana | **Uruhare** | Incorrect word sense for 'Engagement' (marriage engagement vs. involvement). |
| `postCallInsights.metricLeadScore` | Amanota y'Umukuru | **Lead Score** | Preserve 'Lead Score' as a sales funnel term. |
| `postCallInsights.summary` | CV | **Incamake** | Incorrect word sense for 'Summary' (CV vs. summary). |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
