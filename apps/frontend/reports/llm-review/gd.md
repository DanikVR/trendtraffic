# LLM Review: Scots Gaelic (gd)

**Model:** gemini-2.5-flash  
**Took:** 263.7s  
**Fixes proposed:** 89 (valid after placeholder-check: 78)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | Sruth nan Ceistean | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `rooms.tabs.vibeAdd` | Cuir ris a’ bheò-shruth | **VibeAdd** | Brand name 'VibeAdd' must be preserved. |
| `rooms.actions.open` | Log a-steach | **Rach a-steach** | Wrong word sense; 'Log a-steach' is for authentication, not joining a room. |
| `common.tryAgain` | Ath-aithris | **Feuch a-rithist** | Wrong word sense; 'Repeat' instead of 'Try again'. |
| `balance.minutes` | {{count}} mionaid | **{{count}} min** | Preserve 'min' or short local equivalent as per instructions. |
| `balance.minutesShort` | mionaid | **min** | Should be a short form ('min'), not the full word 'mionaid'. |
| `balance.openPlans` | Taraifean fosgailte agus cothromachadh | **Fosgail Taraifean is Cothromachadh** | Grammatical error; adjective 'fosgailte' used instead of verb 'Fosgail'. |
| `tier.trial` | Deuchainn | **Deuchainn-ùine** | Wrong word sense; 'test' instead of 'trial period'. |
| `tier.plus` | A bharrachd air sin | **Plus** | Brand name 'Plus' must be preserved. |
| `tier.standard` | Coitcheann | **Standard** | Brand name 'Standard' must be preserved. |
| `tier.standardYearly` | Bliadhnail | **Yearly** | Brand name 'Yearly' must be preserved. |
| `call.toPlayground` | 🎯 Chun an làraich-sgudail | **🎯 Chun an raon-trèanaidh** | Wrong word sense; 'dump/landfill' instead of 'training ground'. |
| `roomActions.translation.disableSub` | Cha tèid geàrr-chunntasan a sgrìobhadh dheth tuilleadh | **Cha tèid mionaidean a sgrìobhadh dheth tuilleadh** | Wrong word sense; 'meeting minutes' instead of 'time minutes'. |
| `settings.themeDarkSub` | Aurora na h-Aibhne (Dorcha) | **Abyss Aurora (Dorcha)** | Brand name 'Abyss Aurora' must be preserved. |
| `settings.themeLightSub` | Aurora Neòil (Solas) | **Cloud Aurora (Solas)** | Brand name 'Cloud Aurora' must be preserved. |
| `partner.title` | Partner program | **Prògram Com-pàirteachais** | Translation missing for 'Partner program'. |
| `partner.subtitle` | Share your link and earn | **Roinn do cheangal agus cosnadh** | Translation missing for 'Share your link and earn'. |
| `partner.yourLink` | Your link | **Do cheangal** | Translation missing for 'Your link'. |
| `partner.copy` | Copy | **Dèan lethbhreac** | Translation missing for 'Copy'. |
| `partner.copied` | ✓ Link copied | **✓ Ceangal air a chopaigeadh** | Translation missing for 'Link copied'. |
| `partner.stats.clicks` | Clicks | **Cliogan** | Translation missing for 'Clicks'. |
| `partner.stats.registrations` | Sign-ups | **Clàraidhean** | Translation missing for 'Sign-ups'. |
| `partner.stats.paid` | Payments | **Pàighidhean** | Translation missing for 'Payments'. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} luchd-cleachdaidh · {{minutes}} min** | Translation missing for 'users', and 'min' should be preserved. |
| `partner.terms` | Program terms | **Cumhachan a’ Phrògram** | Translation missing for 'Program terms'. |
| `partner.contact` | Contact us | **Cuir fios thugainn** | Translation missing for 'Contact us'. |
| `partner.termsModalTitle` | Partner program terms | **Cumhachan prògram com-pàirteachais** | Translation missing for 'Partner program terms'. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Chan eil cumhachan a’ phrògram air an suidheachadh fhathast. Cuir fios gu SuperAdmin.** | Translation missing for 'Program terms are not set yet. Please contact SuperAdmin.'. |
| `partner.loadError` | Failed to load partner data | **Dh’fhàillig luchdachadh dàta com-pàirteachais** | Translation missing for 'Failed to load partner data'. |
| `sip.incoming.paused` | Seòladh SIP air a chruthachadh, fàilteachadh air a chur dheth | **Seòladh SIP air a chruthachadh, fàilteachadh air a stad** | More accurate translation for 'suspended/paused' ('air a stad'). |
| `sip.incoming.activeHint` | Bidh eadar-theangair a’ Bhrochaid ag èisteachd ris an t-seòmar. Thèid gach gairm eadar-theangachadh ann am fìor-ùine. | **Bidh eadar-theangair Bridge ag èisteachd ris an t-seòmar. Thèid gach gairm eadar-theangachadh ann am fìor-ùine.** | Technical term 'Bridge' should be preserved, not translated as 'Badger'. |
| `sip.incoming.pausedHint` | Cuir an gnìomh an fhàilteachadh gus am bi VibeVox a’ tòiseachadh air gairmean a tha a’ tighinn a-steach a chuir air adhart. | **Cuir an gnìomh an fhàilteachadh gus am bi VibeVox a’ tòiseachadh air gairmean a tha a’ tighinn a-steach a dh’eadar-theangachadh.** | Wrong word sense; 'forward' instead of 'translate'. |
| `sip.incoming.stopped` | Chaidh stad a chur air a’ ghlacadh | **Chaidh stad a chur air an fhàilteachadh** | Wrong word sense; 'capture' instead of 'reception'. |
| `sip.incoming.activated` | Fàilte air a ghnìomhachadh | **Fàilteachadh air a ghnìomhachadh** | Wrong word sense; 'welcome' instead of 'reception'. |
| `sip.incoming.toggleFailed` | Dh’fhàillig atharrachadh fàilte | **Dh’fhàillig atharrachadh fàilteachadh** | Wrong word sense; 'welcome' instead of 'reception'. |
| `sip.outbound.lead` | Cuir fòn gu àireamh fòn bhon eadar-aghaidh lìn agus gluaisidh VibeVox do chòmhradh gu fèin-ghluasadach ann an àm fìor. | **Cuir fòn gu àireamh fòn bhon eadar-aghaidh lìn agus eadar-theangaichidh VibeVox do chòmhradh gu fèin-ghluasadach ann an àm fìor.** | Wrong word sense; 'move/transfer' instead of 'translate'. |
| `sip.confirm.deleteInboundTitle` | A bheil thu airson seòladh SIP a thoirt air falbh airson rudan a tha a’ tighinn a-steach? | **A bheil thu airson seòladh SIP a thoirt air falbh airson gairmean a tha a’ tighinn a-steach?** | Wrong word sense; 'things' instead of 'calls'. |
| `sip.confirm.deleteInboundBody` | Chan urrainnear an gnìomh seo a thionndadh air ais. Thèid an riaghailt stoc is cur a-steach a-steach ann an LiveKit Cloud a dhubhadh às. | **Chan urrainnear an gnìomh seo a thionndadh air ais. Thèid an stoc a-steach LiveKit agus an riaghailt cur air falbh a dhubhadh às.** | Improve clarity of technical terms 'inbound trunk' and 'dispatch rule'. |
| `enterprise.tabs.questFlow` | Sruth nan Ceistean | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.gemini.telegram.leadStartCmd` | /tòisich | **/start** | Command '/start' must be preserved. |
| `enterprise.gemini.telegram.testingLabel` | Clogaid… | **A’ cur…** | Wrong word sense; 'helmets' instead of 'sending'. |
| `enterprise.gemini.telegram.lastBroadcast` | Post as ùire: air a lìbhrigeadh {{sent}} bho {{total}} | **Craoladh as ùire: air a lìbhrigeadh {{sent}} bho {{total}}** | More accurate translation for 'broadcast' ('Craoladh'). |
| `enterprise.prompt.headerLeadBold2` | "A rèir d’iarrtas" | **"A rèir do bhrosnachaidh"** | Wrong word sense; 'request' instead of 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "A rèir d’iarrtas" | **"A rèir do bhrosnachaidh"** | Wrong word sense; 'request' instead of 'prompt'. |
| `enterprise.prompt.kbCharsSuffix` | samhlaidhean | **caractaran** | Wrong word sense; 'symbols' instead of 'characters'. |
| `enterprise.prompt.presetsLeadBold` | "A rèir d’iarrtas" | **"A rèir do bhrosnachaidh"** | Wrong word sense; 'request' instead of 'prompt'. |
| `enterprise.questFlow.heading` | Sruth nan Ceistean | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.warning` | Mura h-eil an raon seo iomchaidh, thèid am brosnachadh coitcheann VibeVox a chleachdadh. | **Mura h-eil an raon falamh, thèid am brosnachadh coitcheann VibeVox a chleachdadh.** | Wrong word sense; 'appropriate' instead of 'empty'. |
| `enterprise.questFlow.promptLabel` | Brosnachadh Siostam Sruth Quest | **Brosnachadh Siostam Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.errDelete` | Delete error | **Mearachd sguabaidh às** | Translation missing for 'Delete error'. |
| `enterprise.questFlow.deleteTitle` | Delete | **Sguab às** | Translation missing for 'Delete'. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Sguab às iuchair?** | Translation missing for 'Delete key?'. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Thèid an iuchair a dhubhadh às gu buan. Stadaidh Quest Flow ag obair troimhe - feumaidh tu iuchair ùr a chruthachadh agus a chur na àite san t-sreath.** | Translation missing for the body, and 'flow' should be 'chain' ('sreath'). |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Sguab às** | Translation missing for 'Delete'. |
| `enterprise.questFlow.promptHeading` | Iarrtas airson còmhraidhean Telegram | **Brosnachadh airson còmhraidhean Telegram** | Wrong word sense; 'request' instead of 'prompt'. |
| `enterprise.questFlow.kbLead3` | Bhon earrann "Molaidhean"—airson tar-sgrìobhadh bhidio. Teòraich: faidhle 50 MB / 500,000 caractar anns an stòr-dàta. | **Bhon earrann "Molaidhean"—airson tar-sgrìobhadh bhidio. Teòrainn: faidhle 50 MB / 500,000 caractar anns an stòr-dàta.** | Grammatical error; 'Teòraich' (verb) instead of 'Teòrainn' (noun) for 'Limit'. |
| `enterprise.questFlow.kbCharsSuffix` | samhlaidhean | **caractaran** | Wrong word sense; 'symbols' instead of 'characters'. |
| `insights.sentiment` | Iuchair | **Tòna** | Wrong word sense; 'key' instead of 'sentiment/tonality'. |
| `insights.engagement` | Ceangal | **Com-pàirteachas** | Wrong word sense; 'connection' instead of 'engagement'. |
| `insights.analyzedReplies_one` | Chaidh leth-bhreac {{count}} a sgrùdadh | **Chaidh freagairt {{count}} a sgrùdadh** | Wrong word sense; 'copy' instead of 'reply'. |
| `insights.analyzedReplies_few` | Chaidh leth-bhreacan {{count}} a sgrùdadh | **Chaidh freagairtean {{count}} a sgrùdadh** | Wrong word sense; 'copies' instead of 'replies'. |
| `insights.analyzedReplies_many` | Chaidh leth-bhreacan {{count}} a sgrùdadh | **Chaidh freagairtean {{count}} a sgrùdadh** | Wrong word sense; 'copies' instead of 'replies'. |
| `insights.analyzedReplies_other` | Chaidh leth-bhreacan {{count}} a sgrùdadh | **Chaidh freagairtean {{count}} a sgrùdadh** | Wrong word sense; 'copies' instead of 'replies'. |
| `paywall.buyPlus` | A bharrachd air sin — €19/mìos (60 mionaid) | **Plus — €19/mìos (60 min)** | Brand name 'Plus' must be preserved, and 'min' should be preserved. |
| `paywall.buyStandard` | Coitcheann – €29/mìos (120 min) | **Standard – €29/mìos (120 min)** | Brand name 'Standard' must be preserved. |
| `paywall.subscribe` | Dealbhadh | **Clàraich** | Wrong word sense; 'design' instead of 'subscribe'. |
| `paywall.featureMinutes` | {{count}} mion-eadar-theangachadh | **{{count}} min eadar-theangachaidh** | 'min' should be preserved as per instructions. |
| `paywall.topupPlusLine` | Taraif a bharrachd ({{count}} min air a ghabhail a-steach) | **Taraif Plus ({{count}} min air a ghabhail a-steach)** | Brand name 'Plus' must be preserved. |
| `billingPage.topupCarried` | Air a chur dheth | **Air a ghiùlan thairis** | Wrong word sense; 'cancelled' instead of 'carried over'. |
| `billingPage.tierPlusName` | A bharrachd air sin | **Plus** | Brand name 'Plus' must be preserved. |
| `billingPage.tierStandardName` | Coitcheann | **Standard** | Brand name 'Standard' must be preserved. |
| `billingPage.ctaSubscribePlus` | Faigh Plus | **Clàraich Plus** | Brand name 'Plus' must be preserved, and 'Clàraich' is more precise for 'subscribe'. |
| `billingPage.ctaSubscribeStandard` | Òrdugh Coitcheann | **Clàraich Standard** | Brand name 'Standard' must be preserved, and 'Òrdugh' is wrong word sense for 'subscribe'. |
| `billingPage.languagesCount_one` | cànan {{count}} | **{{count}} cànan** | Improve natural word order (number before noun). |
| `billingPage.languagesCount_few` | cànan {{count}} | **{{count}} cànanan** | Improve natural word order and correct plural form for 'languages'. |
| `billingPage.renewsOn` | leudachadh {{date}} | **ath-nuadhachadh {{date}}** | Wrong word sense; 'extension' instead of 'renewal'. |
| `postCallInsights.metricSentiment` | Mood | **Faireachdainn** | Translation missing for 'Mood'. |
| `postCallInsights.metricEngagement` | Ceangal | **Com-pàirteachas** | Wrong word sense; 'connection' instead of 'engagement'. |

⚠ 11 fix(es) skipped (no-op, missing path, or would break placeholders).
