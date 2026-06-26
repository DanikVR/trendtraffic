# LLM Review: Sinhala (si)

**Model:** gemini-2.5-flash  
**Took:** 78.7s  
**Fixes proposed:** 88 (valid after placeholder-check: 88)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `appName` | වයිබ්වොක්ස් | **VibeVox** | Brand name should not be translated. |
| `nav.sip` | SIP දුරකථන | **SIP-දුරකථන** | Improve compound word structure for 'SIP-telephony'. |
| `rooms.tabs.questFlow` | ගවේෂණ ප්‍රවාහය | **Quest Flow** | Brand name should not be translated. |
| `rooms.tabs.vibeAdd` | වයිබ්ඇඩ් | **VibeAdd** | Brand name should not be translated. |
| `balance.minutes` | {{count}} විනාඩි | **{{count}} min** | Preserve 'min' as per min_unit rule. 'විනාඩි' is a full word. |
| `balance.minutes_one` | {{count}} මිනිත්තුව | **{{count}} min** | Preserve 'min' as per min_unit rule. |
| `balance.minutes_few` | {{count}} මිනිත්තු | **{{count}} min** | Preserve 'min' as per min_unit rule. |
| `balance.minutes_many` | {{count}} මිනිත්තු | **{{count}} min** | Preserve 'min' as per min_unit rule. |
| `balance.minutesShort` | මිනි | **min** | Preserve 'min' as per min_unit rule. |
| `tier.trial` | නඩු විභාගය | **අත්හදා බැලීම** | Wrong word sense: 'trial' in subscription context, not 'court trial'. |
| `tier.plus` | ප්ලස් | **Plus** | Brand name should not be translated. |
| `tier.standard` | සම්මත | **Standard** | Brand name should not be translated. |
| `tier.standardYearly` | වාර්ෂිකව | **Yearly** | Brand name should not be translated. |
| `tier.enterprise` | ව්‍යවසාය | **Enterprise** | Brand name (subscription tier) should not be translated. |
| `sidebar.logoAria` | VibeVox — මුල් පිටුව | **VibeVox - මුල් පිටුව** | Use hyphen as separator for consistency with source. |
| `moreSheet.sip.label` | SIP දුරකථන | **SIP-දුරකථන** | Improve compound word structure for 'SIP-telephony'. |
| `call.geminiLive` | මිථුන ලග්නය සජීවීව | **Gemini Live** | Brand name should not be translated. |
| `call.toPlayground` | 🎯 ගොඩකිරීමට | **🎯 පුහුණු භූමියට** | 'ගොඩකිරීමට' means 'to dump/fill'. 'Полигон' means 'training ground'. |
| `call.micOn` | මයික්‍රෆෝනය ක්‍රියා විරහිත කරන්න | **මයික්‍රෆෝනය නිවා දමන්න** | More concise for 'turn off' for a button label. |
| `call.micOff` | මයික්‍රෆෝනය ක්‍රියාත්මක කරන්න | **මයික්‍රෆෝනය දල්වන්න** | More concise for 'turn on' for a button label. |
| `call.camOn` | කැමරාව ක්‍රියා විරහිත කරන්න | **කැමරාව නිවා දමන්න** | More concise for 'turn off' for a button label. |
| `call.camOff` | කැමරාව ක්‍රියාත්මක කරන්න | **කැමරාව දල්වන්න** | More concise for 'turn on' for a button label. |
| `call.screenshareOn` | තිර බෙදා ගැනීම | **තිරය බෙදා ගන්න** | Translate as a verb phrase 'Share screen' for a button label. |
| `call.screenshareOff` | තිර බෙදා ගැනීම නවත්වන්න | **තිරය බෙදා ගැනීම නවත්වන්න** | More grammatically correct for 'Stop screen sharing'. |
| `sip.title` | SIP දුරකථන | **SIP-දුරකථන** | Improve compound word structure for 'SIP-telephony'. |
| `sip.loginShort` | ඇතුල් වන්න | **පිවිසුම** | 'ඇතුල් වන්න' is a verb. 'පිවිසුම' is a noun for 'login'. |
| `sip.incoming.heading` | එන SIP ඇමතුම් | **එන SIP-ඇමතුම්** | Improve compound word structure for 'Incoming SIP-calls'. |
| `sip.outbound.lead` | වෙබ් අතුරුමුහුණතෙන් දුරකථන අංකයකට අමතන්න, එවිට VibeVox ඔබගේ සංවාදය තථ්‍ය කාලය තුළ ස්වයංක්‍රීයව මාරු කරනු ඇත. | **වෙබ් අතුරුමුහුණතෙන් දුරකථන අංකයකට අමතන්න, එවිට VibeVox ඔබගේ සංවාදය තත්‍ය කාලීනව ස්වයංක්‍රීයව පරිවර්තනය කරනු ඇත.** | 'මාරු කරනු ඇත' means 'will transfer'. Context requires 'will translate'. |
| `sip.howTo.step1` | ඔබේ සැපයුම්කරුගෙන් (Zadarma, OnlinePBX, Asterisk) SIP කඳ අක්තපත්‍ර ලබා ගන්න. | **ඔබේ සැපයුම්කරුගෙන් (Zadarma, OnlinePBX, Asterisk) SIP-ට්‍රන්ක් අක්තපත්‍ර ලබා ගන්න.** | Use 'ට්‍රන්ක්' for the technical term 'trunk'. |
| `sip.howTo.step3` | VibeVox විසින් LiveKit Cloud හි ස්වයංක්‍රීයව පිටතට යන SIP කඳක් නිර්මාණය කරනු ඇත. | **VibeVox විසින් LiveKit Cloud හි ස්වයංක්‍රීයව පිටතට යන SIP-ට්‍රන්ක් එකක් නිර්මාණය කරනු ඇත.** | Use 'ට්‍රන්ක්' for the technical term 'trunk'. |
| `sip.toasts.saveFailed` | කඳ සුරැකීමට අසමත් විය. | **ට්‍රන්ක් සුරැකීමට අසමත් විය.** | Use 'ට්‍රන්ක්' for the technical term 'trunk'. |
| `sip.toasts.deleted` | කඳ මකා දමා ඇත. | **ට්‍රන්ක් මකා දමා ඇත.** | Use 'ට්‍රන්ක්' for the technical term 'trunk'. |
| `sip.toasts.deleteFailed` | කඳ මකා දැමීමට අසමත් විය. | **ට්‍රන්ක් මකා දැමීමට අසමත් විය.** | Use 'ට්‍රන්ක්' for the technical term 'trunk'. |
| `sip.tenantOnly.hint2` | ට්‍රන්ක් එකක් සෑදීමට තමන්ගේම කුලී නිවැසියෙකු ඇති සාමාන්‍ය පරිශීලකයෙකු ලෙස ලොග් වන්න. | **ට්‍රන්ක් එකක් සෑදීමට තමන්ගේම tenantId එකක් ඇති සාමාන්‍ය පරිශීලකයෙකු ලෙස ලොග් වන්න.** | Preserve 'tenantId' as a technical term. |
| `sip.connected` | SIP කඳ සුරකින අතර LiveKit සමඟ සමමුහුර්ත කර ඇත | **SIP-ට්‍රන්ක් සුරකින අතර LiveKit සමඟ සමමුහුර්ත කර ඇත** | Use 'ට්‍රන්ක්' for the technical term 'trunk'. |
| `sip.danger.deleteTrunk` | කඳ මකන්න | **ට්‍රන්ක් මකන්න** | Use 'ට්‍රන්ක්' for the technical term 'trunk'. |
| `sip.confirm.deleteTrunkTitle` | SIP ට්‍රන්ක් මකන්නද? | **SIP-ට්‍රන්ක් මකන්නද?** | Improve compound word structure for 'SIP-trunk'. |
| `enterprise.tabs.gemini` | මිථුන API | **Gemini API** | Brand name should not be translated. |
| `enterprise.tabs.questFlow` | ගවේෂණ ප්‍රවාහය | **Quest Flow** | Brand name should not be translated. |
| `enterprise.tabs.chatwoot` | CRM (චැට්වූට්) | **CRM (Chatwoot)** | Brand name should not be translated. |
| `enterprise.gemini.heading` | ගූගල් මිථුන API යතුර | **Google Gemini API යතුර** | Brand name should not be translated. |
| `enterprise.gemini.aiStudioLink` | AI ස්ටුඩියෝ | **AI Studio** | Brand name should not be translated. |
| `enterprise.gemini.keyPlaceholder` | අයිසාසි... | **AIzaSy...** | Placeholder should be preserved exactly. |
| `enterprise.gemini.confirmDeleteTitle` | එක්-කුලී නිවැසියෙකුගේ Gemini යතුර ඉවත් කරන්නද? | **Per-tenant Gemini යතුර ඉවත් කරන්නද?** | Preserve 'per-tenant' as a technical term. |
| `enterprise.gemini.telegram.botFatherLabel` | @බොට් ෆාදර් | **@BotFather** | Brand name should not be translated. |
| `enterprise.gemini.telegram.leadStartCmd` | /ආරම්භ කරන්න | **/start** | Command should be preserved exactly. |
| `enterprise.questFlow.heading` | ගවේෂණ ප්‍රවාහය | **Quest Flow** | Brand name should not be translated. |
| `enterprise.questFlow.apiKeyLabel` | ආදාන API යතුර (දරන්නා) | **Inbound API Key (Bearer)** | Preserve technical terms 'Inbound API Key (Bearer)'. |
| `enterprise.questFlow.errDelete` | Delete error | **මකා දැමීමේ දෝෂය** | Translate to Sinhala. |
| `enterprise.questFlow.deleteTitle` | Delete | **මකන්න** | Translate to Sinhala. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **යතුර මකන්නද?** | Translate to Sinhala. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **යතුර ස්ථිරවම මකා දැමෙනු ඇත. Quest Flow එය හරහා ක්‍රියා කිරීම නවත්වනු ඇත — ඔබට නව යතුරක් සාදා එය දාමයේ ප්‍රතිස්ථාපනය කිරීමට අවශ්‍ය වනු ඇත.** | Translate to Sinhala. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **මකන්න** | Translate to Sinhala. |
| `enterprise.questFlow.kbLead3` | "ඉඟි" කොටසෙන්—වීඩියෝ පිටපත් කිරීම සඳහා. සීමාව: දත්ත සමුදායේ 50 MB ගොනුව / අක්ෂර 500,000. | **"ඉඟි" කොටසෙන්—වීඩියෝ පිටපත් කිරීම සඳහා. සීමාව: 50 MB ගොනුව / දත්ත සමුදායේ අක්ෂර 500,000.** | Improve phrasing for clarity. |
| `enterprise.chatwoot.urlPlaceholder` | https://chat.example.com/ | **https://chat.example.com** | Preserve placeholder exactly, remove trailing slash. |
| `insights.summary` | අරඹන්න | **සාරාංශය** | 'අරඹන්න' means 'resume'. 'Резюме' means 'summary'. |
| `insights.sentiment` | යතුර | **ස්වරය** | 'යතුර' means 'key'. 'Тональность' (sentiment) should be 'ස්වරය'. |
| `insights.leadScore` | ඉදිරි ලකුණු | **Lead Score** | Preserve 'Lead Score' as per known failure mode. |
| `postCallInsights.metricLeadScore` | ඉදිරි ලකුණු | **Lead Score** | Preserve 'Lead Score' as per known failure mode. |
| `postCallInsights.summary` | අරඹන්න | **සාරාංශය** | 'අරඹන්න' means 'resume'. 'Резюме' means 'summary'. |
| `billingPage.tierLabel` | අනුපාතය | **සැලැස්ම** | 'අනුපාතය' means 'rate'. 'Тариф' (tier/plan) should be 'සැලැස්ම'. |
| `paywall.buyPlus` | ඊට අමතරව — €19/මසකට (විනාඩි 60) | **Plus — €19/මසකට (60 min)** | Preserve 'Plus' and 'min'. |
| `paywall.buyStandard` | සම්මත – මසකට €29 (විනාඩි 120) | **Standard – මසකට €29 (120 min)** | Preserve 'Standard' and 'min'. |
| `paywall.featureMinutes` | {{count}} අවම පරිවර්තනය | **{{count}} min පරිවර්තනය** | Preserve 'min' as per min_unit rule. 'අවම' means 'minimum'. |
| `paywall.topupPerMin` | €0.17 / විනාඩියකට | **€0.17 / min** | Preserve 'min' as per min_unit rule. |
| `paywall.topupAddon` | අමතර මිලදී ගැනීම {{count}} අවම × €0.17 | **අමතර මිලදී ගැනීම {{count}} min × €0.17** | Preserve 'min' as per min_unit rule. 'අවම' means 'minimum'. |
| `paywall.topupPlusLine` | අමතර ගාස්තුව ({{count}} විනාඩි ඇතුළත්) | **Plus සැලැස්ම ({{count}} min ඇතුළත්)** | Preserve 'Plus' and 'min'. 'අමතර ගාස්තුව' is not 'Plus tariff'. |
| `paywall.topupFreeLine` | ↳ ගාස්තු සහිතව {{count}} විනාඩි නොමිලේ | **↳ සැලැස්ම සමඟ {{count}} min නොමිලේ** | Preserve 'min'. 'ගාස්තු' (rate) should be 'සැලැස්ම' (plan). |
| `billingPage.yearlyToggle` | වාර්ෂිකව | **වාර්ෂික** | 'වාර්ෂිකව' is an adverb. 'වාර්ෂික' is an adjective, more suitable for a toggle label. |
| `billingPage.monthlyToggle` | මාසිකව | **මාසික** | 'මාසිකව' is an adverb. 'මාසික' is an adjective, more suitable for a toggle label. |
| `billingPage.yearlyMinutes` | වසරකට මිනිත්තු 1,440ක් | **1,440 min / වසර** | Preserve 'min' and make more concise. |
| `billingPage.topupSliderMax` | {{max}} විනාඩි (පැය 10) | **{{max}} min (පැය 10)** | Preserve 'min'. |
| `billingPage.presetHours` | {{count}}පැය | **{{count}}h** | Use 'h' for hours as a short unit. |
| `billingPage.presetMinutes` | {{count}}මී | **{{count}}m** | Use 'm' for minutes as a short unit. |
| `billingPage.minutesTimesPrice` | {{count}} මිනිත්තු × €{{price}} | **{{count}} min × €{{price}}** | Preserve 'min'. |
| `billingPage.tierPlusName` | ප්ලස් | **Plus** | Brand name should not be translated. |
| `billingPage.tierStandardName` | සම්මත | **Standard** | Brand name should not be translated. |
| `billingPage.tierEnterpriseName` | ව්‍යවසාය | **Enterprise** | Brand name (subscription tier) should not be translated. |
| `billingPage.tierPlusMinutes` | මිනිත්තු 60 / මසකට | **60 min / මසකට** | Preserve 'min'. |
| `billingPage.tierPlusPrice` | €0.31 / විනාඩියකට | **€0.31 / min** | Preserve 'min'. |
| `billingPage.tierStandardMinutes` | මිනිත්තු 120 / මසකට | **120 min / මසකට** | Preserve 'min'. |
| `billingPage.tierStandardPrice` | €0.24 / විනාඩියකට | **€0.24 / min** | Preserve 'min'. |
| `billingPage.featureCountWithMinutes` | මසකට පරිවර්තන මිනිත්තු {{count}} | **මසකට පරිවර්තන {{count}} min** | Preserve 'min'. |
| `billingPage.ctaSubscribePlus` | ප්ලස් ලබා ගන්න | **Plus ලබා ගන්න** | Preserve 'Plus'. |
| `billingPage.ctaSubscribeStandard` | ඇණවුම් ප්‍රමිතිය | **Standard ලබා ගන්න** | Preserve 'Standard'. 'ඇණවුම් ප්‍රමිතිය' is not quite right for 'Subscribe Standard'. |
| `seo.description` | VibeVox යනු භාෂා 100+ කට සහය දක්වන එකවර AI-බලයෙන් ක්‍රියාත්මක වන හඬ පරිවර්තන වේදිකාවකි. වීඩියෝ ඇමතුම්, SIP දුරකථන, පාරිභෝගික කතාබස් සහ AI-බලයෙන් ක්‍රියාත්මක වන සංවාද විශ්ලේෂණය ලබා ගත හැකිය. | **VibeVox යනු භාෂා 100+ කට සහය දක්වන එකවර AI-බලයෙන් ක්‍රියාත්මක වන හඬ පරිවර්තන වේදිකාවකි. වීඩියෝ ඇමතුම්, SIP-දුරකථන, පාරිභෝගික කතාබස් සහ AI-බලයෙන් ක්‍රියාත්මක වන සංවාද විශ්ලේෂණය ලබා ගත හැකිය.** | Improve compound word structure for 'SIP-telephony'. |
| `pwaInstall.description` | VibeVox යනු භාෂා 108 කින් හඬ සහ වීඩියෝ ඇමතුම් සඳහා එකවර AI පරිවර්තකයකි. WebRTC සහ SIP දුරකථන, හඬ සහායක සහ තත්‍ය කාලීන පරිවර්තනය ඕනෑම උපාංගයක ක්‍රියා කරයි. | **VibeVox යනු භාෂා 108 කින් හඬ සහ වීඩියෝ ඇමතුම් සඳහා එකවර AI පරිවර්තකයකි. WebRTC සහ SIP-දුරකථන, හඬ සහායක සහ තත්‍ය කාලීන පරිවර්තනය ඕනෑම උපාංගයක ක්‍රියා කරයි.** | Improve compound word structure for 'SIP-telephony'. |
| `pwaInstall.buttonAria` | VibeVox යෙදුමක් ලෙස ස්ථාපනය කරන්න. | **VibeVox යෙදුමක් ලෙස ස්ථාපනය කරන්න** | Remove trailing period for button label. |
