# LLM Review: Amharic (am)

**Model:** gemini-2.5-flash  
**Took:** 161.3s  
**Fixes proposed:** 54 (valid after placeholder-check: 53)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | የኩዌስት ፍሰት | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `moreSheet.sip.sub` | ድንኳኖችን ማዘጋጀት | **የSIP ትራንኮችን ማዋቀር** | Wrong word sense: 'ድንኳን' means 'tent', should be 'ትራንክ' for telecom trunk. |
| `moreSheet.enterprise.sub` | የQuest Flow | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `call.toPlayground` | 🎯 ወደ ቆሻሻ መጣያ | **🎯 ወደ ማሰልጠኛ ቦታ** | Wrong word sense: 'ቆሻሻ መጣያ' means 'dumpster', should be 'training ground'. |
| `coach.promptLabel` | የእርስዎ ምኞቶች (ቀለም፣ ቅጥ፣ ጥልቀት) | **የእርስዎ ምኞቶች (ቃና፣ ቅጥ፣ ጥልቀት)** | Wrong word sense: 'ቀለም' means 'color', should be 'ቃና' for 'tone'. |
| `coach.tones.formal` | በሕጋዊ መንገድ | **በመደበኛነት** | Wrong word sense: 'በሕጋዊ መንገድ' means 'legally', should be 'formally'. |
| `roomActions.translation.disableSub` | ቃለ-መጠይቆች ከአሁን በኋላ አይጻፉም | **ደቂቃዎች ከአሁን በኋላ አይጻፉም** | Wrong word sense: 'ቃለ-መጠይቆች' means 'interviews', should be 'ደቂቃዎች' for 'minutes'. |
| `partner.title` | Partner program | **የአጋር ፕሮግራም** | English text not translated to Amharic. |
| `partner.subtitle` | Share your link and earn | **አገናኝዎን ያጋሩ እና ያግኙ** | English text not translated to Amharic. |
| `partner.yourLink` | Your link | **የእርስዎ አገናኝ** | English text not translated to Amharic. |
| `partner.copy` | Copy | **ቅጂ** | English text not translated to Amharic. Button label should be short. |
| `partner.copied` | ✓ Link copied | **✓ አገናኝ ተቀድቷል** | English text not translated to Amharic. |
| `partner.stats.clicks` | Clicks | **ጠቅታዎች** | English text not translated to Amharic. |
| `partner.stats.registrations` | Sign-ups | **ምዝገባዎች** | English text not translated to Amharic. |
| `partner.stats.paid` | Payments | **ክፍያዎች** | English text not translated to Amharic. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ተጠቃሚዎች · {{minutes}} ደቂቃ** | English text not translated to Amharic, and 'min' should be localized. |
| `partner.terms` | Program terms | **የፕሮግራም ውሎች** | English text not translated to Amharic. |
| `partner.contact` | Contact us | **ያግኙን** | English text not translated to Amharic. Button label should be short. |
| `partner.termsModalTitle` | Partner program terms | **የአጋር ፕሮግራም ውሎች** | English text not translated to Amharic. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **የፕሮግራሙ ውሎች ገና አልተዘጋጁም። እባክዎ SuperAdminን ያነጋግሩ።** | English text not translated to Amharic. |
| `partner.loadError` | Failed to load partner data | **የአጋር ውሂብ መጫን አልተሳካም** | English text not translated to Amharic. |
| `toneMenu.explainIn` | በድምፅ ያብራሩ | **በቃና ያብራሩ** | Wrong word sense: 'ድምፅ' means 'sound/voice', should be 'ቃና' for 'tone'. |
| `sip.subtitle` | ለገቢ እና ወጪ ጥሪዎች የኪስ ቦርሳዎችን ማዘጋጀት | **ለገቢ እና ወጪ ጥሪዎች የSIP ትራንኮችን ማዋቀር** | Wrong word sense: 'ኪስ ቦርሳ' means 'wallet', should be 'ትራንክ' for telecom trunk. |
| `sip.newTrunk` | አዲስ የSIP ትራክ | **አዲስ የSIP ትራንክ** | Wrong word sense: 'ትራክ' means 'track', should be 'ትራንክ' for telecom trunk. |
| `sip.editTrunk` | የትከሻ ቅንብሮችን ይቀይሩ | **የትራንክ ቅንብሮችን ይቀይሩ** | Wrong word sense: 'ትከሻ' means 'shoulder', should be 'ትራንክ' for telecom trunk. |
| `sip.trunkId` | የጭነት መታወቂያ | **የትራንክ መታወቂያ** | Wrong word sense: 'ጭነት' means 'cargo/load', should be 'ትራንክ' for telecom trunk. |
| `sip.createTrunk` | አንድ ግንድ ይፍጠሩ | **ትራንክ ይፍጠሩ** | Wrong word sense: 'ግንድ' means 'tree trunk', should be 'ትራንክ' for telecom trunk. |
| `sip.toasts.saveFailed` | ሻንጣውን ማስቀመጥ አልተሳካም | **ትራንኩን ማስቀመጥ አልተሳካም** | Wrong word sense: 'ሻንጣ' means 'suitcase', should be 'ትራንክ' for telecom trunk. |
| `sip.toasts.deleted` | ግንዱ ተሰርዟል። | **ትራንኩ ተሰርዟል።** | Wrong word sense: 'ግንድ' means 'tree trunk', should be 'ትራንክ' for telecom trunk. |
| `sip.toasts.deleteFailed` | ትሩን መሰረዝ አልተሳካም | **ትራንኩን መሰረዝ አልተሳካም** | Wrong word sense: 'ትሩ' is not the correct word for 'trunk'. |
| `sip.tenantOnly.hint2` | ግንድ የሚፈጥር | **ትራንክ የሚፈጥር** | Wrong word sense: 'ግንድ' means 'tree trunk', should be 'ትራንክ' for telecom trunk. |
| `sip.danger.deleteTrunk` | ግንዱን ሰርዝ | **ትራንኩን ሰርዝ** | Wrong word sense: 'ግንድ' means 'tree trunk', should be 'ትራንክ' for telecom trunk. |
| `sip.danger.deleteTrunkHint` | የውጪ ጥሪዎች ግንዱን እንደገና እስኪፈጥሩ ድረስ ይቆማሉ። | **የውጪ ጥሪዎች ትራንኩን እንደገና እስኪፈጥሩ ድረስ ይቆማሉ።** | Wrong word sense: 'ግንድ' means 'tree trunk', should be 'ትራንክ' for telecom trunk. |
| `sip.confirm.deleteTrunkBody` | አዲስ ግንድ እስኪፈጠር ድረስ | **አዲስ ትራንክ እስኪፈጠር ድረስ** | Wrong word sense: 'ግንድ' means 'tree trunk', should be 'ትራንክ' for telecom trunk. |
| `enterprise.tabs.questFlow` | የኩዌስት ፍሰት | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.gemini.aiStudioLink` | የአይአይ ስቱዲዮ | **AI Studio** | Brand name 'AI Studio' should be preserved, not translated. |
| `enterprise.gemini.telegram.botFatherLabel` | @ቦትፋዘር | **@BotFather** | Brand name '@BotFather' should be preserved, not translated. |
| `enterprise.gemini.telegram.testingLabel` | የራስ ቁር… | **በመላክ ላይ…** | Wrong word sense: 'የራስ ቁር' means 'helmet', should be 'sending'. |
| `enterprise.prompt.presetsHeading` | ተደራሽ የሆኑ የማብራሪያ ድምጾች | **ተደራሽ የሆኑ የማብራሪያ ቃናዎች** | Wrong word sense: 'ድምጾች' means 'sounds/voices', should be 'ቃናዎች' for 'tones'. |
| `enterprise.prompt.presetsLeadPart1` | በኢንተርፕራይዝ ክፍል ውይይት ውስጥ ማንኛውንም መልእክት ማድመቅ እና AI በተመረጠው ድምጽ እንዲያብራራ መጠየቅ ይችላሉ። | **በኢንተርፕራይዝ ክፍል ውይይት ውስጥ ማንኛውንም መልእክት ማድመቅ እና AI በተመረጠው ቃና እንዲያብራራ መጠየቅ ይችላሉ።** | Wrong word sense: 'ድምጽ' means 'voice', should be 'ቃና' for 'tone'. |
| `enterprise.questFlow.heading` | የኩዌስት ፍሰት | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.errDelete` | Delete error | **የመሰረዝ ስህተት** | English text not translated to Amharic. |
| `enterprise.questFlow.deleteTitle` | Delete | **ሰርዝ** | English text not translated to Amharic. Button label should be short. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **ቁልፍ ይሰረዝ?** | English text not translated to Amharic. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **ቁልፉ በቋሚነት ይሰረዛል። Quest Flow በእሱ በኩል መስራት ያቆማል — አዲስ ቁልፍ መፍጠር እና በሰንሰለቱ ውስጥ መተካት ያስፈልግዎታል።** | English text not translated to Amharic. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ሰርዝ** | English text not translated to Amharic. Button label should be short. |
| `insights.summary` | የስራ ልምድ ማስረጃ | **ማጠቃለያ** | Wrong word sense: 'የስራ ልምድ ማስረጃ' means 'resume (CV)', should be 'ማጠቃለያ' for 'summary'. |
| `insights.sentiment` | ቁልፍ | **ስሜት** | Wrong word sense: 'ቁልፍ' means 'key', should be 'ስሜት' for 'sentiment'. |
| `paywall.buyPlus` | በተጨማሪም — €19/ወር (60 ደቂቃ) | **Plus — €19/ወር (60 ደቂቃ)** | Brand name 'Plus' should be preserved, not translated to 'በተጨማሪም'. |
| `paywall.subscribe` | ዲዛይን | **ይመዝገቡ** | Wrong word sense: 'ዲዛይን' means 'design', should be 'ይመዝገቡ' for 'subscribe'. |
| `paywall.topupNoSubInfo` | ℹ ንቁ የደንበኝነት ምዝገባ የለዎትም። በተጨማሪም በወር €19 በግዢዎ ላይ ይታከላል—60 ደቂቃዎች ከዕቅድዎ ጋር ተካትተዋል፣ ስለዚህ ምንም ተጨማሪ ክፍያ የለም። | **ℹ ንቁ የደንበኝነት ምዝገባ የለዎትም። Plus በወር €19 በግዢዎ ላይ ይታከላል—60 ደቂቃዎች ከዕቅድዎ ጋር ተካትተዋል፣ ስለዚህ ምንም ተጨማሪ ክፍያ የለም።** | Brand name 'Plus' should be preserved, not translated to 'በተጨማሪም'. |
| `billingPage.resume` | የስራ ልምድ ማስረጃ | **ከቆመበት ቀጥል** | Wrong word sense: 'የስራ ልምድ ማስረጃ' means 'resume (CV)', should be 'ከቆመበት ቀጥል' for 'resume (action)'. |
| `billingPage.autoRenewCancelledHint` | የዕቅድዎ ቃለ ጉባኤ እስከዚህ ቀን ድረስ የሚሰራ ነው፤ ተጨማሪ ቃለ ጉባኤዎችን መግዛት ይችላሉ። ሀሳብዎን ከቀየሩ "ከቆመበት ቀጥል" የሚለውን ጠቅ ያድርጉ። | **የዕቅድዎ ደቂቃዎች እስከዚህ ቀን ድረስ የሚሰራ ነው፤ ተጨማሪ ደቂቃዎችን መግዛት ይችላሉ። ሀሳብዎን ከቀየሩ "ከቆመበት ቀጥል" የሚለውን ጠቅ ያድርጉ።** | Wrong word sense: 'ቃለ ጉባኤ' means 'conference/meeting', should be 'ደቂቃዎች' for 'minutes'. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
