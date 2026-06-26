# LLM Review: Marathi (mr)

**Model:** gemini-2.5-flash  
**Took:** 160.0s  
**Fixes proposed:** 21 (valid after placeholder-check: 21)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.actions.open` | लॉगिन | **प्रवेश करा** | Login is for app authentication; 'प्रवेश करा' (enter) is for joining a room. |
| `common.tryAgain` | पुनरावृत्ती | **पुन्हा प्रयत्न करा** | 'पुनरावृत्ती' means repetition; 'पुन्हा प्रयत्न करा' means try again. |
| `common.success` | तयार | **यशस्वी** | 'तयार' means ready; 'यशस्वी' is more appropriate for a success message. |
| `tier.trial` | चाचणी | **मोफत चाचणी** | Clarifies 'Trial' as a free trial period, not a general test. |
| `call.muted` | आवाज नाही | **म्यूट** | 'आवाज नाही' means no sound; 'म्यूट' (transliteration) is common for muted audio. |
| `enterprise.tabs.prompts` | टिप्स | **प्रॉम्प्ट्स** | 'टिप्स' means advice; 'प्रॉम्प्ट्स' (transliteration) is more accurate for AI prompts. |
| `enterprise.prompt.heading` | टिप्स | **प्रॉम्प्ट्स** | Consistency with 'enterprise.tabs.prompts' for AI prompts. |
| `enterprise.questFlow.errDelete` | Delete error | **हटवताना त्रुटी** | Untranslated English string. 'हटवताना त्रुटी' means error while deleting. |
| `enterprise.questFlow.deleteTitle` | Delete | **हटवा** | Untranslated English string. 'हटवा' means delete. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **की हटवायची का?** | Untranslated English string. 'की हटवायची का?' means delete key? |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **की कायमची हटवली जाईल. Quest Flow यापुढे त्याद्वारे काम करणार नाही — तुम्हाला नवीन की तयार करावी लागेल आणि ती फ्लोमध्ये बदलावी लागेल.** | Untranslated English string. Provided Marathi translation is accurate. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **हटवा** | Untranslated English string. 'हटवा' means delete. |
| `enterprise.questFlow.kbLead3` | "इशारे" विभागातून | **"प्रॉम्प्ट्स" विभागातून** | Consistency: 'इशारे' (hints) should be 'प्रॉम्प्ट्स' (prompts) as per context. |
| `paywall.topupCta` | खरेदी करा {{count}} min · €{{price}} | **खरेदी करा {{count}} मिनिटे · €{{price}}** | Translate 'min' to 'मिनिटे' for consistency. |
| `paywall.topupPlusLine` | Plus टॅरिफ ({{count}} min समाविष्ट) | **Plus टॅरिफ ({{count}} मिनिटे समाविष्ट)** | Translate 'min' to 'मिनिटे' for consistency. |
| `paywall.topupAddon` | अतिरिक्त खरेदी {{count}} min × €0.17 | **अतिरिक्त खरेदी {{count}} मिनिटे × €0.17** | Translate 'min' to 'मिनिटे' for consistency. |
| `postCallInsights.analyzing` | चला, संभाषणाचे विश्लेषण करूया... | **संभाषणाचे विश्लेषण करत आहोत...** | 'चला, करूया' is an invitation; 'करत आहोत' is a direct statement of action. |
| `postCallInsights.metricSentiment` | मूड | **टोनॅलिटी** | 'मूड' (mood) is less precise than 'टोनॅलिटी' (tonality) for sentiment analysis. |
| `postCallInsights.metricEngagement` | प्रतिबद्धता | **सहभाग** | 'प्रतिबद्धता' means commitment; 'सहभाग' means engagement/involvement. |
| `billingPage.presetHours` | {{count}}h | **{{count}}तास** | Translate 'h' to 'तास' (hours). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}मि.** | Translate 'm' to a short form 'मि.' (min) for minutes. |
