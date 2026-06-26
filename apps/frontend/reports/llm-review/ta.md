# LLM Review: Tamil (ta)

**Model:** gemini-2.5-flash  
**Took:** 156.5s  
**Fixes proposed:** 91 (valid after placeholder-check: 88)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.createRoom` | ஒரு அறையை உருவாக்குங்கள் | **அறையை உருவாக்கு** | Shorter and more direct for a button label. |
| `rooms.actions.open` | உள்நுழை | **நுழை** | Correct verb for 'enter' a room, not 'log in'. |
| `common.close` | அருகில் | **மூடு** | Correct verb for 'close'. |
| `common.back` | திரும்பி | **பின்** | Shorter and common for a 'back' button. |
| `common.open` | திறந்த | **திற** | Correct verb for 'open'. |
| `common.edit` | மாற்றம் | **திருத்து** | Correct verb for 'edit'. |
| `common.tryAgain` | மீண்டும் | **மீண்டும் முயற்சி செய்** | More complete translation for 'Try again'. |
| `common.success` | தயார் | **வெற்றி** | Correct term for 'success' status. |
| `balance.minutes_one` | _{{count}} நிமிடம் | **{{count}} நிமிடம்** | Remove extraneous underscore character. |
| `balance.openPlans` | திறந்த கட்டணங்கள் மற்றும் இருப்பு | **கட்டணங்கள் மற்றும் இருப்பைத் திற** | Correct verb form for 'open plans'. |
| `tier.trial` | சோதனை | **இலவசச் சோதனை** | Clarify 'Trial' as 'free trial' in subscription context (trial_meaning). |
| `moreSheet.sip.sub` | தண்டுகளை அமைத்தல் | **ட்ரங்குகளை அமைத்தல்** | Preserve technical term 'trunk' for telephony. |
| `call.toPlayground` | 🎯 குப்பைக் கிடங்கிற்கு | **🎯 பயிற்சி களத்திற்கு** | Correct word sense for 'playground' (training ground). |
| `call.more` | மொத்தமாக | **மேலும்** | Correct word for 'more' (options). |
| `call.translatorJoining` | ஒரு செயற்கை நுண்ணறிவு மொழிபெயர்ப்பியை அறிமுகப்படுத்துகிறது… | **செயற்கை நுண்ணறிவு மொழிபெயர்ப்பியைத் தொடங்குகிறது…** | More accurate verb for 'launching/starting' an AI translator. |
| `coach.close` | அருகில் | **மூடு** | Consistent with common.close, correct verb for 'close'. |
| `coach.tones.empathic` | எம் ஜனநாயகவாதிகள் | **அனுதாபத்துடன்** | Incorrect word sense; 'empathetic' should be 'அனுதாபத்துடன்'. |
| `coach.tonePrompts.short` | ஓரிரு சிறிய வாக்கியங்களில் பதிலளிக்கவும் | **ஒரு குறுகிய வாக்கியத்தில் பதிலளிக்கவும்** | More accurate to 'one short phrase'. |
| `roomActions.translation.enable` | தொகுப்புகளை இயக்கு | **மொழிபெயர்ப்பை இயக்கு** | Incorrect word sense; 'translation' should be 'மொழிபெயர்ப்பு'. |
| `settings.themeDarkSub` | அபிஸ் அரோரா (இருள்) | **அபிஸ் அரோரா (இருண்ட)** | Use adjective form for 'dark'. |
| `settings.themeLightSub` | மேக துருவ ஒளி (ஒளி) | **மேக துருவ ஒளி (ஒளிமயமான)** | Use adjective form for 'light'. |
| `sip.savingShort` | சேமிப்பு… | **சேமிக்கிறோம்…** | Use active verb form for 'saving'. |
| `sip.createTrunk` | ஒரு தண்டு உருவாக்கவும் | **ஒரு ட்ரங்க் உருவாக்கவும்** | Preserve technical term 'trunk'. |
| `sip.toasts.deleted` | தண்டு நீக்கப்பட்டுவிட்டது. | **ட்ரங்க் நீக்கப்பட்டுவிட்டது.** | Preserve technical term 'trunk'. |
| `sip.outbound2.callButton` | அழைப்பு | **அழை** | Shorter and more direct verb for 'call'. |
| `enterprise.common.saving` | சேமிப்பு… | **சேமிக்கிறோம்…** | Use active verb form for 'saving'. |
| `enterprise.gemini.statusNotChecked` | விண்ணப்பதாரர் அல்ல | **சரிபார்க்கப்படவில்லை** | Incorrect word sense; 'not checked' should be 'சரிபார்க்கப்படவில்லை'. |
| `enterprise.gemini.confirmDeleteTitle` | ஒவ்வொரு பயனருக்கான ஜெமினி சாவியை நீக்கவா? | **ஒவ்வொரு குத்தகைதாரருக்குமான ஜெமினி சாவியை நீக்கவா?** | Correct translation for 'per-tenant'. |
| `enterprise.gemini.telegram.leadStartCmd` | /தொடங்கு | **/start** | Preserve exact string for command. |
| `enterprise.gemini.telegram.savingLabel` | சேமிப்பு… | **சேமிக்கிறோம்…** | Use active verb form for 'saving'. |
| `enterprise.gemini.telegram.testingLabel` | ஹெல்மெட்… | **அனுப்புகிறோம்…** | Incorrect word sense; 'Шлём…' (sending) should be 'அனுப்புகிறோம்…'. |
| `enterprise.gemini.telegram.lastBroadcast` | சமீபத்திய அஞ்சல்: {{total}} இலிருந்து {{sent}} இல் வழங்கப்பட்டது | **சமீபத்திய அஞ்சல்: {{total}} இல் {{sent}} வழங்கப்பட்டது** | More natural phrasing for 'delivered X out of Y'. |
| `enterprise.prompt.subtitle` | உடனடி மற்றும் அறிவுத் தளம் | **ப்ராம்ட் மற்றும் அறிவுத் தளம்** | Preserve technical term 'prompt'. |
| `enterprise.prompt.promptLabel` | கணினி அறிவுறுத்தல் (தொனி, நடை, சொற்களஞ்சியம்) | **கணினி ப்ராம்ட் (தொனி, நடை, சொற்களஞ்சியம்)** | Preserve technical term 'prompt'. |
| `enterprise.prompt.savePrompt` | செய்தியைச் சேமிக்கவும் | **ப்ராம்ட்டைச் சேமிக்கவும்** | Preserve technical term 'prompt'. |
| `enterprise.prompt.defaultLabel` | VibeVox இயல்புநிலைத் தூண்டுதல் | **VibeVox இயல்புநிலை ப்ராம்ட்** | Preserve technical term 'prompt'. |
| `enterprise.prompt.headerLeadBold2` | உங்கள் கோரிக்கையின்படி | **உங்கள் ப்ராம்ட்டின்படி** | Preserve technical term 'prompt'. |
| `enterprise.prompt.contextHeading` | சூழல் / தூண்டுதல் | **சூழல் / ப்ராம்ட்** | Preserve technical term 'prompt'. |
| `enterprise.prompt.contextLeadBold` | உங்கள் கோரிக்கையின்படி | **உங்கள் ப்ராம்ட்டின்படி** | Preserve technical term 'prompt'. |
| `enterprise.prompt.extendNoteText` | அவற்றின் சொந்த விதிகள்/பாணி/சொற்களஞ்சியத்துடன் - அவை மேலே உள்ள இயல்புநிலைத் தூண்டுதல் மற்றும் அறிவுத் தளத்துடன் இணைக்கப்படும். | **அவற்றின் சொந்த விதிகள்/பாணி/சொற்களஞ்சியத்துடன் - அவை மேலே உள்ள இயல்புநிலை ப்ராம்ட் மற்றும் அறிவுத் தளத்துடன் இணைக்கப்படும்.** | Preserve technical term 'prompt'. |
| `enterprise.prompt.promptPlaceholder` | உங்கள் தூண்டுதல்... | **உங்கள் ப்ராம்ட்...** | Preserve technical term 'prompt'. |
| `enterprise.prompt.savingPromptLabel` | சேமிப்பு… | **சேமிக்கிறோம்…** | Use active verb form for 'saving'. |
| `enterprise.prompt.savePromptLabel` | செய்தியைச் சேமிக்கவும் | **ப்ராம்ட்டைச் சேமிக்கவும்** | Preserve technical term 'prompt'. |
| `enterprise.prompt.successPromptSaved` | கேட்கப்பட்ட செய்தி சேமிக்கப்பட்டது. | **ப்ராம்ட் சேமிக்கப்பட்டது.** | Preserve technical term 'prompt'. |
| `enterprise.prompt.presetsLeadBold` | உங்கள் கோரிக்கையின்படி | **உங்கள் ப்ராம்ட்டின்படி** | Preserve technical term 'prompt'. |
| `enterprise.prompt.presetsLeadPart2` | மேலே உள்ள புலத்திலிருந்து உங்கள் உள்ளீட்டைப் பயன்படுத்துகிறது. | **மேலே உள்ள புலத்திலிருந்து உங்கள் ப்ராம்ட்டைப் பயன்படுத்துகிறது.** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.warning` | புலம் காலியாக இருந்தால், பொதுவான வைப்வாக்ஸ் (VibeVox) அறிவிப்பு பயன்படுத்தப்படும். | **புலம் காலியாக இருந்தால், பொதுவான VibeVox ப்ராம்ட் பயன்படுத்தப்படும்.** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.savePrompt` | செய்தியைச் சேமிக்கவும் | **ப்ராம்ட்டைச் சேமிக்கவும்** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.errDelete` | Delete error | **நீக்குதல் பிழை** | Translate English phrase. |
| `enterprise.questFlow.deleteTitle` | Delete | **நீக்கு** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **சாவியை நீக்கவா?** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **சாவி நிரந்தரமாக நீக்கப்படும். Quest Flow இதன் மூலம் செயல்படுவதை நிறுத்திவிடும் — நீங்கள் ஒரு புதிய சாவியை உருவாக்கி, அதை ஓட்டத்தில் மாற்ற வேண்டும்.** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **நீக்கு** | Translate English phrase. |
| `enterprise.questFlow.promptHeading` | டெலிகிராம் உரையாடல்களுக்கான தூண்டுதல் | **டெலிகிராம் உரையாடல்களுக்கான ப்ராம்ட்** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.promptLead2` | — பொதுவான VibeVox கட்டளை (கீழே) பயன்படுத்தப்படுகிறது. | **— பொதுவான VibeVox ப்ராம்ட் (கீழே) பயன்படுத்தப்படுகிறது.** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.promptLeadBold2` | நீங்கள் உங்கள் படிவத்தை நிரப்பினால் | **நீங்கள் உங்கள் ப்ராம்ட்டை நிரப்பினால்** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.promptLead3` | — இது அடிப்படைக் குறிப்பு மற்றும் அறிவுத் தளத்துடன் இணைக்கப்படும். | **— இது அடிப்படை ப்ராம்ட் மற்றும் அறிவுத் தளத்துடன் இணைக்கப்படும்.** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.promptPlaceholder` | உங்கள் தூண்டுதல்... | **உங்கள் ப்ராம்ட்...** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.savingPromptLabel` | சேமிப்பு… | **சேமிக்கிறோம்…** | Use active verb form for 'saving'. |
| `enterprise.questFlow.successPromptSaved` | குவெஸ்ட் ஃப்ளோ தூண்டுதல் சேமிக்கப்பட்டது. | **குவெஸ்ட் ஃப்ளோ ப்ராம்ட் சேமிக்கப்பட்டது.** | Preserve technical term 'prompt'. |
| `enterprise.questFlow.kbLeadBold2` | தனித்தனியாக | **தனி** | More concise adjective for 'separate'. |
| `enterprise.chatwoot.savingLabel` | சேமிப்பு… | **சேமிக்கிறோம்…** | Use active verb form for 'saving'. |
| `chat.telegramBadge` | தந்தி | **டெலிகிராம்** | Preserve brand name 'Telegram'. |
| `insights.recalc` | மறு எண்ணிக்கை | **மீண்டும் கணக்கிடு** | Correct word sense for 'recalculate'. |
| `insights.summary` | சுயவிவரம் | **சுருக்கம்** | Incorrect word sense; 'summary' should be 'சுருக்கம்'. |
| `insights.sentiment` | விசை | **மனநிலை** | Incorrect word sense; 'sentiment' should be 'மனநிலை'. |
| `insights.engagement` | நிச்சயதார்த்தம் | **ஈடுபாடு** | Incorrect word sense; 'engagement' (involvement) should be 'ஈடுபாடு'. |
| `insights.analyzedReplies_one` | VV0 பிரதி பகுப்பாய்வு செய்யப்பட்டது | **{{count}} பிரதி பகுப்பாய்வு செய்யப்பட்டது** | Placeholder '{{count}}' was replaced by 'VV0'. |
| `insights.analyzedReplies_few` | VV0 பிரதிகள் பகுப்பாய்வு செய்யப்பட்டன | **{{count}} பிரதிகள் பகுப்பாய்வு செய்யப்பட்டன** | Placeholder '{{count}}' was replaced by 'VV0'. |
| `insights.analyzedReplies_many` | VV0 பிரதிகள் பகுப்பாய்வு செய்யப்பட்டன | **{{count}} பிரதிகள் பகுப்பாய்வு செய்யப்பட்டன** | Placeholder '{{count}}' was replaced by 'VV0'. |
| `insights.analyzedReplies_other` | VV0 பிரதிகள் பகுப்பாய்வு செய்யப்பட்டன | **{{count}} பிரதிகள் பகுப்பாய்வு செய்யப்பட்டன** | Placeholder '{{count}}' was replaced by 'VV0'. |
| `insights.leadValues.warm` | சூடான | **மிதமான** | Incorrect word sense; 'warm' should be 'மிதமான' (moderate/lukewarm). |
| `postCallInsights.metricEngagement` | நிச்சயதார்த்தம் | **ஈடுபாடு** | Consistent with insights.engagement, correct word sense. |
| `postCallInsights.summary` | சுயவிவரம் | **சுருக்கம்** | Consistent with insights.summary, correct word sense. |
| `billingPage.tierLabel` | விகிதம் | **திட்டம்** | Incorrect word sense; 'tariff/plan' should be 'திட்டம்'. |
| `billingPage.resume` | சுயவிவரம் | **மீண்டும் தொடங்கு** | Incorrect word sense; 'resume' should be 'மீண்டும் தொடங்கு'. |
| `billingPage.stripeOpening` | தொடக்கக் கட்டணம்... | **பணம் செலுத்துதலைத் திறக்கிறோம்...** | More accurate translation for 'Opening payment'. |
| `paywall.close` | அருகில் | **மூடு** | Consistent with common.close, correct verb for 'close'. |
| `billingPage.topupCarried` | ஒத்திவைக்கப்பட்டது | **கொண்டுசெல்லப்பட்டது** | Incorrect word sense; 'carried over' should be 'கொண்டுசெல்லப்பட்டது'. |
| `billingPage.ctaSubscribePlus` | கெட் பிளஸ் | **பிளஸ் சந்தா செலுத்து** | Translate 'Subscribe Plus' instead of transliterated English. |
| `billingPage.ctaSubscribeStandard` | ஆர்டர் தரநிலை | **ஸ்டாண்டர்ட் சந்தா செலுத்து** | Translate 'Subscribe Standard' instead of transliterated English. |
| `billingPage.languagesCount_few` | {{count}} மொழி | **{{count}} மொழிகள்** | Use plural form for 'languages'. |
| `billingPage.languagesCount_many` | மொழிகள் | **{{count}} மொழிகள்** | Missing placeholder '{{count}}'. |
| `billingPage.languagesCount_other` | மொழிகள் | **{{count}} மொழிகள்** | Missing placeholder '{{count}}'. |
| `billingPage.faqA3` | முழுமையான AI தொகுப்பு: தானியங்கு அங்கீகாரத்துடன் கூடிய வாடிக்கையாளர் அட்டைகள், டெலிகிராம் அங்கீகாரம், தனிப்பயனாக்கப்பட்ட நினைவூட்டல்கள், கூகுள் காலண்டர், ஸ்மார்ட் தேவைகள் குறியிடல், CRM ஏற்றுமதி, questflow.pro உடனான ஒருங்கிணைப்பு மற்றும் ஒரு தனி நிர்வாகப் பகுதி. | **முழுமையான AI தொகுப்பு: தானியங்கு அங்கீகாரத்துடன் கூடிய வாடிக்கையாளர் அட்டைகள், டெலிகிராம் அங்கீகாரம், தனிப்பயனாக்கப்பட்ட ப்ராம்ட்கள், கூகுள் காலண்டர், ஸ்மார்ட் தேவைகள் குறியிடல், CRM ஏற்றுமதி, questflow.pro உடனான ஒருங்கிணைப்பு மற்றும் ஒரு தனி நிர்வாகப் பகுதி.** | Preserve technical term 'prompts'. |
| `billingPage.presetHours` | {{count}}h | **{{count}}ம** | Translate 'h' (hours) to Tamil 'ம' (மணி). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}நி** | Translate 'm' (minutes) to Tamil 'நி' (நிமிடம்). |
| `billingPage.featurePersonalPrompts` | தனிப்பட்ட AI தூண்டுதல்கள் | **தனிப்பட்ட AI ப்ராம்ட்கள்** | Preserve technical term 'prompts'. |

⚠ 3 fix(es) skipped (no-op, missing path, or would break placeholders).
