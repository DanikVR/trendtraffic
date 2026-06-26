# LLM Review: Icelandic (is)

**Model:** gemini-2.5-flash  
**Took:** 404.6s  
**Fixes proposed:** 126 (valid after placeholder-check: 124)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.billing` | Tollar | **Gjaldskrár** | Tollar means customs duties. Gjaldskrár is correct for pricing plans/rates. |
| `rooms.subtitle` | Virkar samtímis túlkunarlotur þínar | **Virkar samtímis þýðingarlotur þínar** | Túlkunarlotur implies human interpretation. Þýðingarlotur is better for AI translation. |
| `rooms.actions.open` | Innskráning | **Fara inn** | Innskráning means login. Fara inn (enter) is more appropriate for entering a room. |
| `common.open` | Opið | **Opna** | Opið is an adjective. Opna is the verb 'to open'. |
| `common.edit` | Breyting | **Breyta** | Breyting is a noun (change). Breyta is the verb 'to edit'. |
| `common.success` | Tilbúinn | **Lokið** | Tilbúinn means ready (masculine). Lokið (finished/done) is better for success. |
| `balance.openPlans` | Opin gjaldskrá og jafnvægi | **Opna gjaldskrár og jafnvægi** | Opin is an adjective. Opna is the verb 'to open'. Gjaldskrár is better than tollar. |
| `balance.tariffs` | Tollar | **Gjaldskrár** | Tollar means customs duties. Gjaldskrár is correct for pricing plans/rates. |
| `tier.trial` | Réttarhöld | **Prófunaráskrift** | Wrong word sense: Réttarhöld means court trial. Prófunaráskrift means trial subscription. |
| `settings.themeDarkSub` | Djúpnáttúruljós (Dökk) | **Abyss Aurora (Dökk)** | Preserve brand name 'Abyss Aurora'. |
| `settings.themeLightSub` | Skýjaljós (ljós) | **Cloud Aurora (ljós)** | Preserve brand name 'Cloud Aurora'. |
| `partner.title` | Partner program | **Samstarfsáætlun** | Translate 'Partner program' to Icelandic. |
| `partner.subtitle` | Share your link and earn | **Deildu tenglinum þínum og græddu** | Translate 'Share your link and earn' to Icelandic. |
| `partner.yourLink` | Your link | **Tengillinn þinn** | Translate 'Your link' to Icelandic. |
| `partner.copy` | Copy | **Afrita** | Translate 'Copy' to Icelandic. |
| `partner.copied` | ✓ Link copied | **✓ Tengill afritaður** | Translate 'Link copied' to Icelandic. |
| `partner.stats.clicks` | Clicks | **Smellir** | Translate 'Clicks' to Icelandic. |
| `partner.stats.registrations` | Sign-ups | **Skráningar** | Translate 'Sign-ups' to Icelandic. |
| `partner.stats.paid` | Payments | **Greiðslur** | Translate 'Payments' to Icelandic. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} notendur · {{minutes}} mín** | Translate 'users' and 'min' to Icelandic. |
| `partner.terms` | Program terms | **Skilmálar samstarfsáætlunar** | Translate 'Program terms' to Icelandic. |
| `partner.contact` | Contact us | **Hafðu samband** | Translate 'Contact us' to Icelandic. |
| `partner.termsModalTitle` | Partner program terms | **Skilmálar samstarfsáætlunar** | Translate 'Partner program terms' to Icelandic. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Skilmálar áætlunarinnar hafa ekki verið settir enn. Vinsamlegast hafðu samband við SuperAdmin.** | Translate 'Program terms are not set yet. Please contact SuperAdmin.' to Icelandic. |
| `partner.loadError` | Failed to load partner data | **Mistókst að hlaða samstarfsgögnum** | Translate 'Failed to load partner data' to Icelandic. |
| `call.geminiLive` | Tvíburarnir í beinni | **Gemini Live** | Preserve brand name 'Gemini'. |
| `call.toPlayground` | 🎯 Á urðunarstaðinn | **🎯 Á æfingasvæðið** | Urðunarstaðinn means landfill. Æfingasvæðið (training ground) is better for 'playground' in AI context. |
| `call.more` | Að auki | **Meira** | Að auki means in addition. Meira is more appropriate for 'more' (button label). |
| `coach.thinking` | Gervigreind heldur... | **Gervigreind hugsar...** | Heldur means holds/believes. Hugsar means thinks (processes thoughts). |
| `coach.pin` | Festa það | **Festa** | The pronoun 'það' (it) is redundant here. |
| `coach.tones.neutral` | Hlutlaus | **Hlutlaust** | Hlutlaus is masculine. Hlutlaust is neuter, matching the implied noun 'tónn' (tone) or general adverbial use. |
| `coach.tones.empathic` | Samúðarfullur | **Samúðarfullt** | Samúðarfullur is masculine. Samúðarfullt is neuter, matching the implied noun 'tónn' (tone) or general adverbial use. |
| `roomActions.translation.disableSub` | Fundargerðir verða ekki lengur afskrifaðar | **Mínútur verða ekki lengur afskrifaðar** | Fundargerðir means minutes of a meeting. Mínútur is correct for time units. |
| `sip.subtitle` | Uppsetning á tengikerfum fyrir innhringingar og úthringingar | **Uppsetning SIP-trunks fyrir innhringingar og úthringingar** | Preserve 'SIP-trunks' as a technical term, consistent with other uses. |
| `sip.newTrunk` | Nýr SIP-trunk | **Nýr SIP-trunkur** | Correct grammatical form for 'trunk' as a noun in Icelandic. |
| `sip.editTrunk` | Breyta stillingum fyrir skottið | **Breyta stillingum fyrir SIP-trunkinn** | Skottið means the tail/trunk of an animal. Preserve 'SIP-trunk' as a technical term. |
| `sip.trunkId` | Auðkenni stofns | **Auðkenni SIP-trunks** | Stofns means of a stem/trunk (tree). Preserve 'SIP-trunk' as a technical term. |
| `sip.createTrunk` | Búa til skott | **Búa til SIP-trunk** | Skott means tail/trunk (animal). Preserve 'SIP-trunk' as a technical term. |
| `sip.deletingShort` | Eyðir… | **Eyði…** | Eyðir is 3rd person singular. Eyði is 1st person plural (we are deleting). |
| `sip.incoming.pausedHint` | Virkjaðu móttökuna til að láta VibeVox byrja að áframsenda innhringingar. | **Virkjaðu móttökuna til að láta VibeVox byrja að þýða innhringingar.** | Áframsenda means forward. Þýða (translate) is the correct action here. |
| `sip.outbound.heading` | Símtal í gangi | **Úthringing** | Símtal í gangi means call in progress. Úthringing is outbound call. |
| `sip.outbound.lead` | Hringdu í símanúmer úr vefviðmótinu og VibeVox mun sjálfkrafa flytja samtalið þitt í rauntíma. | **Hringdu í símanúmer úr vefviðmótinu og VibeVox mun sjálfkrafa þýða samtalið þitt í rauntíma.** | Flytja means transfer/move. Þýða (translate) is the correct action here. |
| `sip.toasts.saveFailed` | Mistókst að vista skottið | **Mistókst að vista SIP-trunkinn** | Skottið means the tail/trunk of an animal. Preserve 'SIP-trunk' as a technical term. |
| `sip.toasts.deleted` | Skotthólfinu hefur verið eytt. | **SIP-trunk hefur verið eytt.** | Skotthólfinu means the trunk compartment (of a car). Preserve 'SIP-trunk' as a technical term. |
| `sip.toasts.deleteFailed` | Mistókst að eyða skottinu | **Mistókst að eyða SIP-trunknum** | Skottinu means the tail/trunk of an animal. Preserve 'SIP-trunk' as a technical term. |
| `sip.danger.deleteTrunk` | Eyða skottinu | **Eyða SIP-trunk** | Skottinu means the tail/trunk of an animal. Preserve 'SIP-trunk' as a technical term. |
| `sip.danger.deleteTrunkHint` | Stillingunni verður eytt. Símtölum verður hætt þar til þú endurskapar stofninn. | **Stillingunni verður eytt. Símtölum verður hætt þar til þú endurskapar SIP-trunkinn.** | Stofninn means the stem/trunk (tree). Preserve 'SIP-trunk' as a technical term. |
| `sip.danger.deleteInboundHint` | Reglan fyrir innhringingar og afgreiðslu LiveKit verður fjarlægð. Símtölum verður ekki lengur móttekið. | **LiveKit inbound trunk og afgreiðslureglan verður fjarlægð. Símtölum verður ekki lengur móttekið.** | Preserve 'LiveKit inbound trunk' as a technical term. |
| `sip.confirm.deleteTrunkBody` | Þessi aðgerð er óafturkræf. Þegar henni hefur verið eytt munu úthringingar stöðvast þar til nýr stofn hefur verið búinn til. | **Þessi aðgerð er óafturkræf. Þegar henni hefur verið eytt munu úthringingar stöðvast þar til nýr SIP-trunk hefur verið búinn til.** | Stofn means stem/trunk (tree). Preserve 'SIP-trunk' as a technical term. |
| `sip.confirm.deleteInboundBody` | Þessi aðgerð er óafturkræf. Reglan um inntaksflutning og sendingu í LiveKit Cloud verður eytt. | **Þessi aðgerð er óafturkræf. Inbound trunk og dispatch rule í LiveKit Cloud verður eytt.** | Preserve 'inbound trunk' and 'dispatch rule' as technical terms. |
| `enterprise.gemini.leadSuffix` | Notað í stað alþjóðlega kóðans fyrir öll Gemini-símtöl á reikningnum þínum. | **Notað í stað alþjóðlega lykilsins fyrir öll Gemini-símtöl á reikningnum þínum.** | Kóðans means the code. Lykilsins (the key) is more accurate for API key. |
| `enterprise.gemini.statusQuotaExceeded` | Kvótanum hefur verið framyfirborðað | **Kvóti yfirskredinn** | Framyfirborðað is not a standard word. Kvóti yfirskredinn (quota exceeded) is better. |
| `enterprise.gemini.successSavedWithIssue` | Vistað, en staðfest: {{error}} | **Vistað, en villuprófun: {{error}}** | Staðfest means confirmed. Villuprófun (error check/validation) is more accurate. |
| `enterprise.gemini.telegram.heading` | Telegram spjallþjónn fyrir tilkynningar | **Telegram-bot fyrir tilkynningar** | Preserve 'bot' as a brand/technical name. Spjallþjónn means chatbot. |
| `enterprise.gemini.telegram.lead` | Búðu til spjallþjón með @BotFather og settu inn táknið hans. Allir sem senda þessum spjallþjóni skilaboð með /start munu fá tilkynningar: nýja viðskiptavini, merki, samþættingarvillur. Þú getur skráð marga starfsmenn eða bætt spjallþjóninum við hóp eða rás — tilkynningarnar verða sendar sjálfkrafa til allra. | **Búðu til bot með @BotFather og settu inn táknið hans. Allir sem senda þessum bot skilaboð með /start munu fá tilkynningar: nýja viðskiptavini, merki, samþættingarvillur. Þú getur skráð marga starfsmenn eða bætt botnum við hóp eða rás — tilkynningarnar verða sendar sjálfkrafa til allra.** | Preserve 'bot' as a brand/technical name. Spjallþjónn means chatbot. |
| `enterprise.gemini.telegram.leadCreatePart1` | Búa til spjallþjón á | **Búa til bot á** | Preserve 'bot' as a brand/technical name. Spjallþjónn means chatbot. |
| `enterprise.gemini.telegram.leadCreatePart2` | og líma táknið þess. | **og setja inn táknið þess.** | Líma means to glue. Setja inn (insert/paste) is more appropriate. |
| `enterprise.gemini.telegram.leadAllWhoStart` | Allir sem skrifa til þessa vélmennis | **Allir sem skrifa til þessa bots** | Vélmennis means robot. Preserve 'bot' as a brand/technical name. |
| `enterprise.gemini.telegram.leadAfterStart` | , mun fá tilkynningar um nýja viðskiptavini, merki og samþættingarvillur. Þú getur skráð marga starfsmenn eða bætt spjallþjóninum við hóp eða rás — allir munu fá tilkynninguna sjálfkrafa. | **, mun fá tilkynningar um nýja viðskiptavini, merki og samþættingarvillur. Þú getur skráð marga starfsmenn eða bætt botnum við hóp eða rás — allir munu fá tilkynninguna sjálfkrafa.** | Preserve 'bot' as a brand/technical name. Spjallþjóninum means chatbot. |
| `enterprise.gemini.telegram.botUnlink` | Aftengja spjallþjóninn | **Aftengja botinn** | Preserve 'bot' as a brand/technical name. Spjallþjóninn means chatbot. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Vélmennið @{{username}} vistað. Kveðja send til {{sent}} áskrifenda. | **✓ Botinn @{{username}} vistað. Kveðja send til {{sent}} áskrifenda.** | Vélmennið means robot. Preserve 'bot' as a brand/technical name. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Vélmennið @{{username}} hefur verið vistað. Allir sem senda SMS með /start fá tilkynningar. | **✓ Botinn @{{username}} hefur verið vistað. Allir sem senda SMS með /start fá tilkynningar.** | Vélmennið means robot. Preserve 'bot' as a brand/technical name. |
| `enterprise.gemini.telegram.successUnlinked` | Botinn er laus. | **Botinn er aftengdur.** | Laus means loose/free. Aftengdur (disconnected) is more accurate. |
| `enterprise.gemini.telegram.testingLabel` | Hjálmur… | **Sendi…** | Hjálmur means helmet. Sendi (sending) is correct. |
| `enterprise.gemini.telegram.testTooltip` | Senda prufutilkynningu í gegnum spjallþjón | **Senda prufutilkynningu í gegnum bot** | Preserve 'bot' as a brand/technical name. Spjallþjón means chatbot. |
| `enterprise.gemini.telegram.confirmUnlinkTitle` | Aftengja spjallþjóninn? | **Aftengja botinn?** | Preserve 'bot' as a brand/technical name. Spjallþjóninn means chatbot. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Leysa | **Aftengja** | Leysa means to solve/release. Aftengja (disconnect) is more accurate. |
| `enterprise.prompt.savePrompt` | Vista tilkynningu | **Vista fyrirmæli** | Tilkynningu means notification. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.prompt.defaultLabel` | Sjálfgefin fyrirspurn í VibeVox | **Sjálfgefin fyrirmæli í VibeVox** | Fyrirspurn means query. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.prompt.headerLeadBold1` | aðeins til að afkóða skilaboð í myndbandsherbergjum | **aðeins til að umrita skilaboð í myndbandsherbergjum** | Afkóða means decode. Umrita (transcribe) is more accurate for messages. |
| `enterprise.prompt.headerLeadBold2` | „Samkvæmt beiðni þinni“ | **„Samkvæmt fyrirmæli þínu“** | Beiðni means request. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.prompt.contextHeading` | Samhengi / hvati | **Samhengi / fyrirmæli** | Hvati means incentive/stimulus. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.prompt.contextLeadBold` | „Samkvæmt beiðni þinni“ | **„Samkvæmt fyrirmæli þínu“** | Beiðni means request. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.prompt.extendNoteText` | með sínum eigin reglum/stíl/hugtökum - þær verða sameinaðar sjálfgefna fyrirspurninni hér að ofan og þekkingargrunninum. | **með sínum eigin reglum/stíl/hugtökum - þær verða sameinaðar sjálfgefnum fyrirmælum hér að ofan og þekkingargrunninum.** | Fyrirspurn means query. Fyrirmælum (prompt/instruction) is better. |
| `enterprise.prompt.promptPlaceholder` | Þín boð... | **Þín fyrirmæli...** | Boð means invitation/offer. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.prompt.savePromptLabel` | Vista tilkynningu | **Vista fyrirmæli** | Tilkynningu means notification. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.prompt.presetsLeadBold` | „Samkvæmt beiðni þinni“ | **„Samkvæmt fyrirmæli þínu“** | Beiðni means request. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.questFlow.warning` | Ef reiturinn er tómur er almenna VibeVox-kvaðningin notuð. | **Ef reiturinn er tómur eru almennu VibeVox-fyrirmælin notuð.** | Kvaðningin means query/invocation. Fyrirmælin (the prompt/instruction) is better. |
| `enterprise.questFlow.tagsLabel` | Þarfnast merkja | **Þarfamerki** | Þarfnast means needs (verb). Þarfamerki (needs tags) is more appropriate. |
| `enterprise.questFlow.savePrompt` | Vista tilkynningu | **Vista fyrirmæli** | Tilkynningu means notification. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.questFlow.headerLead` | Gervigreind talar við hvern viðskiptavin fyrir sig í gegnum Telegram-þjón sem er tengdur Quest Flow. | **Gervigreind talar við hvern viðskiptavin fyrir sig í gegnum Telegram-bot sem er tengdur Quest Flow.** | Preserve 'bot' as a brand/technical name. Þjón means server/servant. |
| `enterprise.questFlow.keyLabelPlaceholder` | Merki (valfrjálst), til dæmis: „Prod bot clinic“ | **Merki (valfrjálst), til dæmis: „Framleiðslubotn heilsugæslustöðvar“** | Translate 'Prod bot clinic' to Icelandic. |
| `enterprise.questFlow.errDelete` | Delete error | **Villa við eyðingu** | Translate 'Delete error' to Icelandic. |
| `enterprise.questFlow.usedOn` | notaði {{date}} | **notaður {{date}}** | Notaði is past tense singular (he/she/it used). Notaður (used, masculine singular) is better for 'key'. |
| `enterprise.questFlow.deleteTitle` | Delete | **Eyða** | Translate 'Delete' to Icelandic. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Eyða lykli?** | Translate 'Delete key?' to Icelandic. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Lykillinn verður eytt varanlega. Quest Flow mun hætta að virka í gegnum hann — þú þarft að búa til nýjan lykil og skipta honum út í flæðinu.** | Translate to Icelandic. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Eyða** | Translate 'Delete' to Icelandic. |
| `enterprise.questFlow.promptHeading` | Kveðja um Telegram samræður | **Fyrirmæli fyrir Telegram samræður** | Kveðja means greeting. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.questFlow.promptLead2` | — almenna VibeVox-kvaðningin er notuð (hér að neðan). | **— almennu VibeVox-fyrirmælin eru notuð (hér að neðan).** | Kvaðningin means query/invocation. Fyrirmælin (the prompt/instruction) is better. |
| `enterprise.questFlow.promptLead3` | - það verður sameinað grunnfyrirspurninni og þekkingargrunninum. | **- það verður sameinað grunnfyrirmælum og þekkingargrunninum.** | Fyrirspurn means query. Fyrirmælum (prompt/instruction) is better. |
| `enterprise.questFlow.promptPlaceholder` | Þín boð... | **Þín fyrirmæli...** | Boð means invitation/offer. Fyrirmæli (prompt/instruction) is better. |
| `enterprise.questFlow.kbLeadBold2` | aðskilja | **aðskilin** | Aðskilja is a verb. Aðskilin is the correct feminine adjective for 'grunnur' (base). |
| `enterprise.questFlow.kbLead3` | Úr hlutanum „Vísbendingar“ — fyrir myndbandsuppskrift. Takmörkun: 50 MB skrá / 500.000 stafir í gagnagrunninum. | **er aðskilin frá hlutanum „Ráðleggingar“ — fyrir myndbandsuppskrift. Takmörkun: 50 MB skrá / 500.000 stafir í gagnagrunninum.** | Clarify that this knowledge base is separate from the 'Prompts' section. |
| `enterprise.questFlow.tagsHeading` | Þarfnast merkja | **Þarfamerki** | Þarfnast means needs (verb). Þarfamerki (needs tags) is more appropriate. |
| `insights.summary` | Ferilskrá | **Samantekt** | Ferilskrá means CV/resume. Samantekt (summary) is more appropriate. |
| `insights.sentiment` | Lykill | **Tónn** | Lykill means key (physical or musical). Tónn (tone) or Viðhorf (sentiment) is better. |
| `insights.analyzedReplies_one` | {{count}} eftirlíking greind | **{{count}} svar greint** | Eftirlíking means imitation/replica. Svar (reply) is more appropriate. |
| `insights.analyzedReplies_few` | {{count}} eftirlíkingar greindar | **{{count}} svör greind** | Eftirlíkingar means imitations/replicas. Svör (replies) is more appropriate. |
| `insights.analyzedReplies_many` | {{count}} eftirlíkingar greindar | **{{count}} svör greind** | Eftirlíkingar means imitations/replicas. Svör (replies) is more appropriate. |
| `insights.analyzedReplies_other` | {{count}} eftirlíkingar greindar | **{{count}} svör greind** | Eftirlíkingar means imitations/replicas. Svör (replies) is more appropriate. |
| `insights.sentimentValues.neutral` | Hlutlaus | **Hlutlaust** | Hlutlaus is masculine. Hlutlaust is neuter, matching the implied noun 'tónn' (tone) or general adverbial use. |
| `lobby.tosAgree` | Með því að gerast meðlimur samþykkir þú | **Með því að taka þátt samþykkir þú** | Gerast meðlimur means become a member. Taka þátt (participate/join) is more accurate for joining a call. |
| `paywall.buyPlus` | Auk þess — 19 evrur/mánuði (60 mín.) | **Plus — 19 evrur/mánuði (60 mín.)** | Preserve 'Plus' as a brand name. Auk þess means in addition. |
| `paywall.buyStandard` | Staðlað – 29 evrur/mánuði (120 mín.) | **Standard – 29 evrur/mánuði (120 mín.)** | Preserve 'Standard' as a brand name. Staðlað means standard (neuter adjective). |
| `paywall.subscribe` | Hönnun | **Skrá sig** | Hönnun means design. Skrá sig (subscribe) is more appropriate. |
| `paywall.topupNoSubInfo` | Þú ert ekki með virka áskrift. Aukagjald bætist við kaupin þín fyrir 19 evrur á mánuði — 60 mínútur eru innifaldar í áskriftinni þinni, þannig að það er enginn aukakostnaður. | **Þú ert ekki með virka áskrift. Plus áskrift bætist við kaupin þín fyrir 19 evrur á mánuði — 60 mínútur eru innifaldar í áskriftinni þinni, þannig að það er enginn aukakostnaður.** | Aukagjald means surcharge. Áskrift (subscription) is correct. Preserve 'Plus'. |
| `paywall.topupPlusLine` | Plús gjaldskrá ({{count}} lám innifalin) | **Plus gjaldskrá ({{count}} mín innifalin)** | Preserve 'Plus' as a brand name. 'lám' is not a word, should be 'mín' (minutes). |
| `paywall.topupAddon` | Viðbótarkaup {{count}} lám × €0,17 | **Viðbótarkaup {{count}} mín × €0,17** | 'lám' is not a word, should be 'mín' (minutes). |
| `billingPage.tierLabel` | Gefðu einkunn | **Gjaldskrá** | Gefðu einkunn means rate/give a grade. Gjaldskrá (pricing plan) is more appropriate. |
| `billingPage.resume` | Ferilskrá | **Halda áfram** | Ferilskrá means CV/resume. Halda áfram (resume) is more appropriate. |
| `billingPage.topupCarried` | Frestað | **Yfirfært** | Frestað means postponed. Yfirfært (carried over/transferred) is more accurate. |
| `billingPage.tierPlusName` | Plús | **Plus** | Preserve 'Plus' as a brand name. |
| `billingPage.tierStandardName` | Staðall | **Standard** | Preserve 'Standard' as a brand name. |
| `billingPage.featurePersonalPrompts` | Persónulegar gervigreindarleiðbeiningar | **Persónuleg gervigreindarfyrirmæli** | Leiðbeiningar means instructions. Fyrirmæli (prompts) is better. |
| `billingPage.featureCalendar` | Google dagatal - Viðskiptavinatímar | **Google dagatal - Bókun viðskiptavina** | Viðskiptavinatímar means customer times. Bókun viðskiptavina (customer booking) is more accurate. |
| `billingPage.ctaSubscribePlus` | Fáðu plús | **Skrá sig í Plus** | Fáðu plús means get plus. Skrá sig í Plus (subscribe to Plus) is more appropriate. |
| `billingPage.ctaSubscribeStandard` | Pöntunarstaðall | **Skrá sig í Standard** | Pöntunarstaðall means order standard. Skrá sig í Standard (subscribe to Standard) is more appropriate. |
| `billingPage.faqA3` | Fullt gervigreindarkerfi: viðskiptavinakort með sjálfvirkri greiningu, Telegram heimild, sérsniðnar fyrirspurnir, Google dagatal, snjallþarfamerkingar, CRM útflutningur, samþætting við questflow.pro og sér stjórnunarflipi. | **Fullt gervigreindarkerfi: viðskiptavinakort með sjálfvirkri greiningu, Telegram heimild, sérsniðin fyrirmæli, Google dagatal, snjallþarfamerkingar, CRM útflutningur, samþætting við questflow.pro og sér stjórnunarflipi.** | Fyrirspurnir means queries. Fyrirmæli (prompts) is better. |
| `billingPage.faqA4` | Sérhver RFC-samhæfur: Zadarma, OnlinePBX, Asterisk/FreePBX, o.s.frv. VibeVox býr sjálfkrafa til útleiðandi tengingu. | **Sérhver RFC-samhæfur: Zadarma, OnlinePBX, Asterisk/FreePBX, o.s.frv. VibeVox býr sjálfkrafa til útleiðandi SIP-trunk.** | Tengingu means connection. SIP-trunk is the correct technical term. |
| `billingPage.renewsOn` | viðbót {{date}} | **endurnýjun {{date}}** | Viðbót means addition. Endurnýjun (renewal) is more appropriate. |
| `billingPage.searchResultsCount_one` | Fann: {{count}} tungumál | **Fannst: {{count}} tungumál** | Fann is past tense 'found'. Fannst (was found) is grammatically correct for 'found'. |
| `auth.login.title` | Velkomin | **Velkominn** | Velkomin is feminine. Velkominn is masculine and more commonly used for a general welcome. |
| `auth.register.ruleNumber` | Fjöldi | **Tala** | Fjöldi means number/quantity. Tala (digit/number) is more appropriate for a password rule. |

⚠ 2 fix(es) skipped (no-op, missing path, or would break placeholders).
