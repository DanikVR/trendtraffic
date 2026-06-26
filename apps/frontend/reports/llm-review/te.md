# LLM Review: Telugu (te)

**Model:** gemini-2.5-flash  
**Took:** 174.4s  
**Fixes proposed:** 59 (valid after placeholder-check: 59)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.actions.open` | లాగిన్ | **ప్రవేశించండి** | Wrong word sense: 'Login' instead of 'Enter' (a room). |
| `balance.openPlans` | బహిరంగ సుంకాలు మరియు బ్యాలెన్స్ | **ప్లాన్‌లు మరియు బ్యాలెన్స్‌ను తెరవండి** | Awkward phrasing, 'బహిరంగ' means public. 'తెరవండి' is better for 'open'. |
| `tier.trial` | విచారణ | **ఉచిత ట్రయల్** | Wrong word sense: 'విచారణ' means legal trial, not free trial period. |
| `call.toPlayground` | 🎯 చెత్తకుప్పకు | **🎯 శిక్షణా మైదానానికి** | Wrong word sense: 'చెత్తకుప్పకు' means garbage dump, not training/testing ground. |
| `coach.help` | సహాయం సమాధానం | **సమాధానం ఇవ్వడానికి సహాయం చేయండి** | Awkward phrasing, improved grammar for 'Help to answer'. |
| `roomActions.translation.disableSub` | సమావేశ నిమిషాలను ఇకపై రద్దు చేయరు | **నిమిషాలు ఇకపై ఖర్చు చేయబడవు** | Wrong word sense: 'రద్దు చేయరు' means will not cancel, should be 'will not be charged'. |
| `sip.incoming.pausedHint` | వైబ్‌వాక్స్ ఇన్‌కమింగ్ కాల్స్‌ను ఫార్వార్డ్ చేయడం ప్రారంభించడానికి రిసెప్షన్‌ను యాక్టివేట్ చేయండి. | **వైబ్‌వాక్స్ ఇన్‌కమింగ్ కాల్స్‌ను అనువదించడం ప్రారంభించడానికి రిసెప్షన్‌ను యాక్టివేట్ చేయండి.** | Wrong word sense: 'ఫార్వార్డ్ చేయడం' (forwarding) instead of 'అనువదించడం' (translating). |
| `sip.outbound.noTrunkHint` | పేజీ పైభాగంలో ఉన్న "New SIP Trunk" ఫారమ్‌ను పూరించండి | **పేజీ పైభాగంలో ఉన్న "కొత్త SIP ట్రంక్" ఫారమ్‌ను పూరించండి** | Brand/product name 'New SIP Trunk' was not translated. |
| `sip.toasts.saveFailed` | ట్రంక్‌ను కాపాడటంలో విఫలమయ్యారు | **ట్రంక్‌ను సేవ్ చేయడంలో విఫలమైంది** | Wrong word sense: 'కాపాడటంలో' means to protect, should be 'సేవ్ చేయడంలో' (to save). |
| `partner.title` | Partner program | **భాగస్వామ్య కార్యక్రమం** | Brand/product name 'Partner program' was not translated. |
| `partner.subtitle` | Share your link and earn | **మీ లింక్‌ను పంచుకోండి మరియు సంపాదించండి** | Brand/product name 'Share your link and earn' was not translated. |
| `partner.yourLink` | Your link | **మీ లింక్** | Brand/product name 'Your link' was not translated. |
| `partner.copy` | Copy | **కాపీ** | Brand/product name 'Copy' was not translated. |
| `partner.copied` | ✓ Link copied | **✓ లింక్ కాపీ చేయబడింది** | Brand/product name 'Link copied' was not translated. |
| `partner.stats.clicks` | Clicks | **క్లిక్‌లు** | Brand/product name 'Clicks' was not translated. |
| `partner.stats.registrations` | Sign-ups | **నమోదులు** | Brand/product name 'Sign-ups' was not translated. |
| `partner.stats.paid` | Payments | **చెల్లింపులు** | Brand/product name 'Payments' was not translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} వినియోగదారులు · {{minutes}} నిమిషాలు** | Brand/product names 'users' and 'min' were not translated. |
| `partner.terms` | Program terms | **కార్యక్రమ నిబంధనలు** | Brand/product name 'Program terms' was not translated. |
| `partner.contact` | Contact us | **మమ్మల్ని సంప్రదించండి** | Brand/product name 'Contact us' was not translated. |
| `partner.termsModalTitle` | Partner program terms | **భాగస్వామ్య కార్యక్రమ నిబంధనలు** | Brand/product name 'Partner program terms' was not translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **కార్యక్రమ నిబంధనలు ఇంకా సెట్ చేయబడలేదు. దయచేసి సూపర్‌అడ్మిన్‌ను సంప్రదించండి.** | Brand/product name 'Program terms are not set yet. Please contact SuperAdmin.' was not translated. |
| `partner.loadError` | Failed to load partner data | **భాగస్వామ్య డేటాను లోడ్ చేయడంలో విఫలమైంది** | Brand/product name 'Failed to load partner data' was not translated. |
| `enterprise.gemini.successDeleted` | ప్రతి అద్దెదారుకు ఉండే తాళంచెవి తీసివేయబడింది. | **ప్రతి టెనెంట్‌కు ఉండే కీ తొలగించబడింది.** | Wrong word sense: 'తాళంచెవి' means physical key, should be 'కీ' (API key). |
| `enterprise.gemini.confirmDeleteTitle` | ప్రతి టెనెంట్‌కు జెమిని కీని తొలగించాలా? | **ప్రతి టెనెంట్‌కు ఉండే జెమిని కీని తొలగించాలా?** | Wrong word sense: 'తాళంచెవి' means physical key, should be 'కీ' (API key). |
| `enterprise.gemini.telegram.testingLabel` | హెల్మెట్… | **పంపుతున్నాము...** | Wrong word sense: 'హెల్మెట్' (helmet) instead of 'పంపుతున్నాము' (sending). |
| `enterprise.gemini.telegram.lastBroadcast` | తాజా మెయిలింగ్: {{total}} నుండి {{sent}}న పంపబడింది | **చివరిగా పంపబడింది: {{total}}లో {{sent}} డెలివరీ చేయబడింది** | Awkward phrasing, improved for clarity. |
| `enterprise.questFlow.tagsLabel` | ట్యాగ్‌లు అవసరం | **అవసరాల ట్యాగ్‌లు** | Awkward phrasing: 'Tags are needed' instead of 'Need tags'. |
| `enterprise.questFlow.keyLabelPlaceholder` | లేబుల్ (ఐచ్ఛికం), ఉదాహరణకు: "Prod bot clinic" | **లేబుల్ (ఐచ్ఛికం), ఉదాహరణకు: "క్లినిక్ ప్రొడక్షన్ బాట్"** | Example text 'Prod bot clinic' was not translated. |
| `enterprise.questFlow.errDelete` | Delete error | **తొలగింపు లోపం** | Brand/product name 'Delete error' was not translated. |
| `enterprise.questFlow.savedKeyConfirm` | నేను తాళం చెవిని భద్రపరిచాను | **నేను కీని భద్రపరిచాను** | Wrong word sense: 'తాళం చెవి' means physical key, should be 'కీ' (API key). |
| `enterprise.questFlow.deleteTitle` | Delete | **తొలగించు** | Brand/product name 'Delete' was not translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **కీని తొలగించాలా?** | Brand/product name 'Delete key?' was not translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **కీ శాశ్వతంగా తొలగించబడుతుంది. దీని ద్వారా క్వెస్ట్ ఫ్లో పనిచేయడం ఆగిపోతుంది — మీరు కొత్త కీని సృష్టించి, ఫ్లోలో దాన్ని భర్తీ చేయాలి.** | Brand/product name 'The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow.' was not translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **తొలగించు** | Brand/product name 'Delete' was not translated. |
| `enterprise.questFlow.promptLead1` | క్వెస్ట్ ఫ్లో ద్వారా AI క్లయింట్‌లతో ఎలా సంభాషిస్తుందో నిర్ధారిస్తుంది: స్వరూపం, శైలి, ఏమి గుర్తించాలి. | **క్వెస్ట్ ఫ్లో ద్వారా AI క్లయింట్‌లతో ఎలా సంభాషిస్తుందో నిర్ధారిస్తుంది: స్వరం, శైలి, ఏమి గుర్తించాలి.** | Wrong word sense: 'స్వరూపం' (appearance) instead of 'స్వరం' (tone). |
| `enterprise.questFlow.promptLeadBold2` | మీరు మీ | **మీరు మీ స్వంతంగా పూరిస్తే** | Incomplete phrase, improved for clarity. |
| `enterprise.questFlow.tagsHeading` | ట్యాగ్‌లు అవసరం | **అవసరాల ట్యాగ్‌లు** | Awkward phrasing: 'Tags are needed' instead of 'Need tags'. |
| `enterprise.chatwoot.whatSentFooter` | రూమ్ చాట్‌లో మీరు మాన్యువల్‌గా 'Send to CRM' పై క్లిక్ చేసినప్పుడు పంపబడుతుంది. | **రూమ్ చాట్‌లో మీరు మాన్యువల్‌గా 'CRMకు పంపండి' పై క్లిక్ చేసినప్పుడు పంపబడుతుంది.** | Brand/product name 'Send to CRM' was not translated. |
| `insights.recalc` | తిరిగి వివరించండి | **తిరిగి లెక్కించండి** | Wrong word sense: 're-explain' instead of 'recalculate'. |
| `insights.summary` | పునఃప్రారంభం | **సారాంశం** | Wrong word sense: 'restart/resume' instead of 'summary'. |
| `insights.sentiment` | కీ | **భావోద్వేగం** | Wrong word sense: 'key' instead of 'sentiment'. |
| `insights.engagement` | నిశ్చితార్థం | **పాల్గొనడం** | Wrong word sense: 'marriage engagement' instead of 'involvement/engagement'. |
| `lobby.shareHint` | మీ సంభాషణకర్తను సమావేశానికి ఆహ్వానించడానికి, దీని కాపీని వారికి పంపండి. | **మీ సంభాషణకర్తను సమావేశానికి ఆహ్వానించడానికి, లింక్‌ను కాపీ చేసి వారికి పంపండి.** | Awkward phrasing, improved for clarity and directness. |
| `paywall.buyPlus` | అదనంగా — నెలకు €19 (60 నిమిషాలు) | **ప్లస్ — నెలకు €19 (60 నిమిషాలు)** | Brand name 'Plus' was translated as 'additionally'. |
| `paywall.subscribe` | డిజైన్ | **సబ్‌స్క్రయిబ్ చేయండి** | Wrong word sense: 'design' instead of 'subscribe/sign up'. |
| `paywall.topupPlusLine` | ప్లస్ టారిఫ్ ({{count}} కనిష్టంగా చేర్చబడింది) | **ప్లస్ టారిఫ్ ({{count}} నిమిషాలు చేర్చబడింది)** | Wrong word sense: 'కనిష్టంగా' (minimum) instead of 'నిమిషాలు' (minutes). |
| `paywall.topupAddon` | అదనపు కొనుగోలు {{count}} కనిష్ట × €0.17 | **అదనపు కొనుగోలు {{count}} నిమిషాలు × €0.17** | Wrong word sense: 'కనిష్ట' (minimum) instead of 'నిమిషాలు' (minutes). |
| `postCallInsights.analyzing` | సంభాషణను విశ్లేషిద్దాం... | **సంభాషణను విశ్లేషిస్తున్నాము...** | Wrong verb tense: 'Let's analyze' instead of 'Analyzing...' |
| `postCallInsights.metricEngagement` | నిశ్చితార్థం | **పాల్గొనడం** | Wrong word sense: 'marriage engagement' instead of 'involvement/engagement'. |
| `postCallInsights.summary` | పునఃప్రారంభం | **సారాంశం** | Wrong word sense: 'restart/resume' instead of 'summary'. |
| `billingPage.topupCarried` | వాయిదా వేయబడింది | **బదిలీ చేయబడింది** | Wrong word sense: 'postponed' instead of 'transferred'. |
| `billingPage.presetHours` | {{count}}h | **{{count}}గం** | Unit 'h' should be localized to 'గం' (short for గంటలు - hours). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}ని** | Unit 'm' should be localized to 'ని' (short for నిమిషాలు - minutes). |
| `billingPage.renewsOn` | విస్తరణ {{date}} | **పునరుద్ధరణ {{date}}** | Wrong word sense: 'extension' instead of 'renewal'. |
| `billingPage.autoRenewCancelledHint` | మీ ప్లాన్‌లోని నిమిషాలు ఈ తేదీ వరకు చెల్లుబాటులో ఉంటాయి; మీరు అదనపు నిమిషాలను కొనుగోలు చేయవచ్చు. మీరు మీ నిర్ణయాన్ని మార్చుకుంటే "Resume" పై క్లిక్ చేయండి. | **మీ ప్లాన్‌లోని నిమిషాలు ఈ తేదీ వరకు చెల్లుబాటులో ఉంటాయి; మీరు అదనపు నిమిషాలను కొనుగోలు చేయవచ్చు. మీరు మీ నిర్ణయాన్ని మార్చుకుంటే "పునఃప్రారంభించు" పై క్లిక్ చేయండి.** | Brand/product name 'Resume' was not translated. |
| `billingPage.languagesCount_few` | {{count}} భాష | **{{count}} భాషలు** | Incorrect plural form for 'languages'. |
| `billingPage.ctaSubscribePlus` | గెట్ ప్లస్ | **ప్లస్ కోసం నమోదు చేసుకోండి** | Literal translation 'Get Plus', improved to 'Sign up for Plus'. |
| `billingPage.ctaSubscribeStandard` | ఆర్డర్ ప్రమాణం | **స్టాండర్డ్ కోసం నమోదు చేసుకోండి** | Literal translation 'Order Standard', improved to 'Sign up for Standard'. |
