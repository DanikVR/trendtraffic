# LLM Review: Nepali (ne)

**Model:** gemini-2.5-flash  
**Took:** 132.8s  
**Fixes proposed:** 29 (valid after placeholder-check: 29)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `partner.title` | Partner program | **साझेदारी कार्यक्रम** | English text, should be translated. |
| `partner.subtitle` | Share your link and earn | **आफ्नो लिङ्क सेयर गर्नुहोस् र कमाउनुहोस्** | English text, should be translated. |
| `partner.yourLink` | Your link | **तपाईंको लिङ्क** | English text, should be translated. |
| `partner.copy` | Copy | **प्रतिलिपि गर्नुहोस्** | English text, should be translated. |
| `partner.copied` | ✓ Link copied | **✓ लिङ्क प्रतिलिपि गरियो** | English text, should be translated. |
| `partner.stats.clicks` | Clicks | **क्लिकहरू** | English text, should be translated. |
| `partner.stats.registrations` | Sign-ups | **दर्ताहरू** | English text, should be translated. |
| `partner.stats.paid` | Payments | **भुक्तानीहरू** | English text, should be translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} प्रयोगकर्ता · {{minutes}} मिनेट** | English text, should be translated. |
| `partner.terms` | Program terms | **कार्यक्रमका सर्तहरू** | English text, should be translated. |
| `partner.contact` | Contact us | **हामीलाई सम्पर्क गर्नुहोस्** | English text, should be translated. |
| `partner.termsModalTitle` | Partner program terms | **साझेदारी कार्यक्रमका सर्तहरू** | English text, should be translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **कार्यक्रमका सर्तहरू अहिलेसम्म सेट गरिएको छैन। कृपया सुपरएडमिनलाई सम्पर्क गर्नुहोस्।** | English text, should be translated. |
| `partner.loadError` | Failed to load partner data | **साझेदारी डेटा लोड गर्न असफल भयो** | English text, should be translated. |
| `sip.incoming.pausedHint` | VibeVox ले आगमन कलहरू फर्वार्ड गर्न सुरु गर्न रिसेप्शन सक्रिय गर्नुहोस्। | **VibeVox ले आगमन कलहरू अनुवाद गर्न सुरु गर्न रिसेप्शन सक्रिय गर्नुहोस्।** | Incorrect verb: 'forward' instead of 'translate'. |
| `enterprise.gemini.leadSuffix` | । तपाईंको खातामा भएका सबै Gemini कलहरूको लागि विश्वव्यापी कलको सट्टा प्रयोग गरिन्छ। | **। तपाईंको खातामा भएका सबै Gemini कलहरूको लागि विश्वव्यापी कुञ्जीको सट्टा प्रयोग गरिन्छ।** | Incorrect word: 'call' instead of 'key'. |
| `enterprise.gemini.telegram.successUnlinked` | बोट खोलिएको छ। | **बट अनलिंक गरियो।** | Incorrect word: 'opened' instead of 'unlinked'. |
| `enterprise.gemini.telegram.lastBroadcast` | पछिल्लो पत्राचार: {{sent}} मा {{total}} बाट डेलिभर गरिएको | **पछिल्लो पत्राचार: {{total}} मध्ये {{sent}} डेलिभर गरियो** | Awkward phrasing, improved structure for 'X out of Y'. |
| `enterprise.prompt.headerLeadBold2` | "तपाईंको अनुरोध अनुसार" | **"तपाईंको प्रम्प्ट अनुसार"** | Incorrect word: 'request' instead of 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "तपाईंको अनुरोध अनुसार" | **"तपाईंको प्रम्प्ट अनुसार"** | Incorrect word: 'request' instead of 'prompt'. |
| `enterprise.prompt.presetsLeadBold` | "तपाईंको अनुरोध अनुसार" | **"तपाईंको प्रम्प्ट अनुसार"** | Incorrect word: 'request' instead of 'prompt'. |
| `enterprise.questFlow.errDelete` | Delete error | **मेटाउने त्रुटि** | English text, should be translated. |
| `enterprise.questFlow.deleteTitle` | Delete | **मेटाउनुहोस्** | English text, should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **कुञ्जी मेटाउने हो?** | English text, should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **कुञ्जी स्थायी रूपमा मेटाइनेछ। Quest Flow ले यस मार्फत काम गर्न बन्द गर्नेछ — तपाईंले नयाँ कुञ्जी सिर्जना गर्नुपर्नेछ र यसलाई प्रवाहमा बदल्नुपर्नेछ।** | English text, should be translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **मेटाउनुहोस्** | English text, should be translated. |
| `enterprise.questFlow.kbHeading` | ज्ञानको आधार — TXT / Word / Excel / CSV | **Quest Flow को लागि ज्ञानको आधार** | Extra file types in translation, inconsistent with source. |
| `postCallInsights.analyzing` | कुराकानीको विश्लेषण गरौं... | **कुराकानीको विश्लेषण गरिँदैछ...** | Informal verb, should be more neutral/passive for system message. |
| `postCallInsights.summary` | पुनःसुरु गर्नुहोस् | **सारांश** | Incorrect word: 'resume' instead of 'summary'. |
