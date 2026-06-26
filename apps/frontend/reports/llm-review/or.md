# LLM Review: Odia (or)

**Model:** gemini-2.5-flash  
**Took:** 327.0s  
**Fixes proposed:** 156 (valid after placeholder-check: 155)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.actions.open` | ଲଗ୍ଇନ୍ | **ପ୍ରବେଶ କରନ୍ତୁ** | Wrong word sense: 'Login' instead of 'Enter' a room. |
| `rooms.actions.chat` | ଚାଟ୍ କରନ୍ତୁ | **ଚାଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `rooms.actions.delete` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `rooms.actions.copyLink` | ଲିଙ୍କ୍ କପି କରନ୍ତୁ | **ଲିଙ୍କ୍ କପି** | Excessive length for button label. Shorter form is better. |
| `rooms.actions.rename` | ପୁନଃନାମକରଣ କରନ୍ତୁ | **ପୁନଃନାମକରଣ** | Excessive length for button label. Noun form is sufficient. |
| `rooms.confirmDelete.confirm` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `common.cancel` | ବାତିଲ କରନ୍ତୁ | **ବାତିଲ** | Excessive length for button label. Noun form is sufficient. |
| `common.confirm` | ସୁନିଶ୍ଚିତ କରନ୍ତୁ | **ସୁନିଶ୍ଚିତ** | Excessive length for button label. Shorter form is better. |
| `common.save` | ସେଭ୍ କରନ୍ତୁ | **ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `common.delete` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `common.close` | ବନ୍ଦ କରନ୍ତୁ | **ବନ୍ଦ** | Excessive length for button label. Noun form is sufficient. |
| `common.search` | ଖୋଜନ୍ତୁ | **ସନ୍ଧାନ** | Excessive length for button label. Noun form is better. |
| `common.open` | ଖୋଲନ୍ତୁ | **ଖୋଲ** | Excessive length for button label. Shorter imperative is better. |
| `common.select` | ବାଛନ୍ତୁ | **ବାଛ** | Excessive length for button label. Shorter imperative is better. |
| `common.edit` | ପରିବର୍ତ୍ତନ କରନ୍ତୁ | **ପରିବର୍ତ୍ତନ** | Excessive length for button label. Noun form is sufficient. |
| `common.tryAgain` | ଦୋହରାନ୍ତୁ | **ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ** | More accurate translation for 'Try again'. |
| `common.success` | ପ୍ରସ୍ତୁତ | **ସଫଳ** | Wrong word sense: 'Ready' instead of 'Success/Done'. |
| `balance.minutes` | {{count}} ମିନିଟ୍ | **{{count}} ମି** | Use short form 'ମି' for 'min' as a time unit. |
| `balance.minutes_one` | {{count}} ମିନିଟ୍ | **{{count}} ମି** | Use short form 'ମି' for 'min' as a time unit. |
| `balance.minutes_few` | {{count}} ମିନିଟ୍ | **{{count}} ମି** | Use short form 'ମି' for 'min' as a time unit. |
| `balance.minutes_many` | {{count}} ମିନିଟ୍ | **{{count}} ମି** | Use short form 'ମି' for 'min' as a time unit. |
| `balance.minutesShort` | ମିନିଟ୍ | **ମି** | Use short form 'ମି' for 'min' as a time unit. |
| `balance.openPlans` | ଖୋଲା ଶୁଳ୍କ ଏବଂ ବାଲାନ୍ସ | **ଶୁଳ୍କ ଏବଂ ବାଲାନ୍ସ ଖୋଲନ୍ତୁ** | Grammar: 'Open' as a verb should be at the end. |
| `tier.trial` | ପରୀକ୍ଷା | **ମାଗଣା ପରୀକ୍ଷଣ** | Wrong word sense: 'Test/Exam' instead of 'Free Trial'. |
| `tier.plus` | ଯୁକ୍ତ | **Plus** | Brand name 'Plus' should be preserved. |
| `tier.standard` | ମାନାଙ୍କ | **Standard** | Brand name 'Standard' should be preserved. |
| `tier.standardYearly` | ବାର୍ଷିକ | **Yearly** | Brand name 'Yearly' should be preserved. |
| `tier.enterprise` | ଏଣ୍ଟରପ୍ରାଇଜ | **Enterprise** | Brand name 'Enterprise' should be preserved. |
| `call.speaksLang` | ଇଂରାଜୀ କହିପାରେ | **ଇଂରାଜୀ କହୁଛି** | Wrong verb tense: 'can speak' instead of 'speaking'. |
| `call.muted` | କୌଣସି ଶବ୍ଦ ନାହିଁ | **ମ୍ୟୁଟ୍** | Literal translation 'No sound'. 'Mute' is commonly used. |
| `call.toPlayground` | 🎯 ଲ୍ୟାଣ୍ଡଫିଲ୍ କୁ | **🎯 ପଲିଗନ୍ କୁ** | Wrong word sense: 'Landfill' instead of 'Playground/Polygon'. |
| `call.expandPeer` | ଇଣ୍ଟରଲୋକର୍ ବିସ୍ତାର କରନ୍ତୁ | **କଥାବାର୍ତ୍ତାକାରୀଙ୍କୁ ବିସ୍ତାର କରନ୍ତୁ** | Transliteration 'Interlocutor' instead of native 'କଥାବାର୍ତ୍ତାକାରୀ'. |
| `call.screenshareOn` | ସ୍କ୍ରିନ୍ ସେୟାରିଂ | **ସ୍କ୍ରିନ୍ ସେୟାର୍** | Excessive length for button label. Noun form is sufficient. |
| `call.more` | ଅତିରିକ୍ତ ଭାବରେ | **ଅଧିକ** | Wrong word sense: 'Additionally' instead of 'More'. |
| `call.roomFull` | 🚫 କୋଠରୀଟି ଅଧିକ ଲୋକ - ଏଥିରେ ପୂର୍ବରୁ 2 ଜଣ ଅଂଶଗ୍ରହଣକାରୀ ଅଛନ୍ତି। | **🚫 କୋଠରୀଟି ପୂର୍ଣ୍ଣ ଅଛି - ଏଥିରେ ପୂର୍ବରୁ 2 ଜଣ ଅଂଶଗ୍ରହଣକାରୀ ଅଛନ୍ତି।** | Wrong word sense: 'More people' instead of 'Full'. |
| `coach.help` | ସାହାଯ୍ୟ ଉତ୍ତର | **ଉତ୍ତର ଦେବାରେ ସାହାଯ୍ୟ** | Grammar: 'Help answer' (noun phrase) instead of 'Help to answer'. |
| `coach.copy` | କପି କରନ୍ତୁ | **କପି** | Excessive length for button label. Noun form is sufficient. |
| `coach.pin` | ପିନ୍ କରନ୍ତୁ | **ପିନ୍** | Excessive length for button label. Noun form is sufficient. |
| `coach.close` | ବନ୍ଦ କରନ୍ତୁ | **ବନ୍ଦ** | Excessive length for button label. Noun form is sufficient. |
| `coach.tones.joke` | ମଜା | **ମଜାକ** | Wrong word sense: 'Fun' instead of 'Joke'. |
| `coach.tonePrompts.joke` | ଏକ ହାଲୁକା ଏବଂ ଉପଯୁକ୍ତ ମଜା ସହିତ ଉତ୍ତର ଦିଅନ୍ତୁ। | **ଏକ ହାଲୁକା ଏବଂ ଉପଯୁକ୍ତ ମଜାକ ସହିତ ଉତ୍ତର ଦିଅନ୍ତୁ।** | Wrong word sense: 'Fun' instead of 'Joke'. |
| `roomActions.copyLink` | ରୁମକୁ ଲିଙ୍କ୍ କପି କରନ୍ତୁ | **ରୁମ୍ ଲିଙ୍କ୍ କପି** | Excessive length for button label. Shorter form is better. |
| `roomActions.delete` | ରୁମ୍ ଡିଲିଟ୍ କରନ୍ତୁ | **ରୁମ୍ ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `settings.saveProfile` | ପ୍ରୋଫାଇଲ୍ ସେଭ୍ କରନ୍ତୁ | **ପ୍ରୋଫାଇଲ୍ ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `partner.title` | Partner program | **ସହଭାଗୀ କାର୍ଯ୍ୟକ୍ରମ** | Brand/product name translated when it should be preserved. |
| `partner.subtitle` | Share your link and earn | **ଆପଣଙ୍କ ଲିଙ୍କ୍ ସେୟାର୍ କରନ୍ତୁ ଏବଂ ରୋଜଗାର କରନ୍ତୁ** | Brand/product name translated when it should be preserved. |
| `partner.yourLink` | Your link | **ଆପଣଙ୍କ ଲିଙ୍କ୍** | Brand/product name translated when it should be preserved. |
| `partner.copy` | Copy | **କପି** | Brand/product name translated when it should be preserved. Also shorter for button. |
| `partner.copied` | ✓ Link copied | **✓ ଲିଙ୍କ୍ କପି କରାଯାଇଛି** | Brand/product name translated when it should be preserved. |
| `partner.stats.clicks` | Clicks | **କ୍ଲିକ୍** | Brand/product name translated when it should be preserved. |
| `partner.stats.registrations` | Sign-ups | **ପଞ୍ଜିକରଣ** | Brand/product name translated when it should be preserved. |
| `partner.stats.paid` | Payments | **ଦେୟ** | Brand/product name translated when it should be preserved. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ଜଣ · {{minutes}} ମିନିଟ୍** | Brand/product name translated when it should be preserved. |
| `partner.terms` | Program terms | **କାର୍ଯ୍ୟକ୍ରମର ସର୍ତ୍ତାବଳୀ** | Brand/product name translated when it should be preserved. |
| `partner.contact` | Contact us | **ଯୋଗାଯୋଗ କରନ୍ତୁ** | Brand/product name translated when it should be preserved. |
| `partner.termsModalTitle` | Partner program terms | **ସହଭାଗୀ କାର୍ଯ୍ୟକ୍ରମର ସର୍ତ୍ତାବଳୀ** | Brand/product name translated when it should be preserved. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **କାର୍ଯ୍ୟକ୍ରମର ସର୍ତ୍ତାବଳୀ ଏପର୍ଯ୍ୟନ୍ତ ସେଟ୍ ହୋଇନାହିଁ। ଦୟାକରି SuperAdmin ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ।** | Brand/product name translated when it should be preserved. |
| `partner.loadError` | Failed to load partner data | **ସହଭାଗୀ ଡାଟା ଲୋଡ୍ କରିବାରେ ବିଫଳ ହୋଇଛି** | Brand/product name translated when it should be preserved. |
| `toneMenu.generationError` | ପିଢ଼ି ତ୍ରୁଟି | **ଉତ୍ପାଦନ ତ୍ରୁଟି** | Wrong word sense: 'Generation' (of people) instead of 'Production'. |
| `sip.savingChanges` | ପରିବର୍ତ୍ତନଗୁଡ଼ିକୁ ସେଭ୍ କରନ୍ତୁ | **ପରିବର୍ତ୍ତନ ସେଭ୍** | Excessive length for button label. Shorter form is better. |
| `sip.incoming.stop` | ବନ୍ଦ କରନ୍ତୁ | **ବନ୍ଦ** | Excessive length for button label. Noun form is sufficient. |
| `sip.incoming.activate` | ସକ୍ରିୟ କରନ୍ତୁ | **ସକ୍ରିୟ** | Excessive length for button label. Noun form is sufficient. |
| `sip.incoming.copy` | କପି କରନ୍ତୁ | **କପି** | Excessive length for button label. Noun form is sufficient. |
| `sip.incoming.reissue` | ପୁନଃପ୍ରକାଶ କରନ୍ତୁ | **ପୁନଃ ଜାରି କରନ୍ତୁ** | Wrong word sense: 'Republish' instead of 'Reissue'. |
| `sip.incoming.pausedHint` | VibeVox ଆସୁଥିବା କଲ୍ ଗୁଡିକୁ ଫରୱାର୍ଡ କରିବା ଆରମ୍ଭ କରିବା ପାଇଁ ରିସେପ୍ସନକୁ ସକ୍ରିୟ କରନ୍ତୁ। | **VibeVox ଆସୁଥିବା କଲ୍ ଗୁଡିକୁ ଅନୁବାଦ କରିବା ଆରମ୍ଭ କରିବା ପାଇଁ ରିସେପ୍ସନକୁ ସକ୍ରିୟ କରନ୍ତୁ।** | Wrong word sense: 'Forward' instead of 'Translate'. |
| `sip.outbound.lead` | ୱେବ୍ ଇଣ୍ଟରଫେସ୍ ରୁ ଏକ ଫୋନ୍ ନମ୍ବରକୁ କଲ୍ କରନ୍ତୁ ଏବଂ VibeVox ସ୍ୱୟଂଚାଳିତ ଭାବରେ ଆପଣଙ୍କର ବାର୍ତ୍ତାଳାପକୁ ପ୍ରକୃତ ସମୟରେ ସ୍ଥାନାନ୍ତର କରିବ। | **ୱେବ୍ ଇଣ୍ଟରଫେସ୍ ରୁ ଏକ ଫୋନ୍ ନମ୍ବରକୁ କଲ୍ କରନ୍ତୁ ଏବଂ VibeVox ସ୍ୱୟଂଚାଳିତ ଭାବରେ ଆପଣଙ୍କର ବାର୍ତ୍ତାଳାପକୁ ପ୍ରକୃତ ସମୟରେ ଅନୁବାଦ କରିବ।** | Wrong word sense: 'Transfer' instead of 'Translate'. |
| `sip.tenantOnly.hint2` | ଜଣେ ନିୟମିତ ଉପଭୋକ୍ତା ଭାବରେ ଲଗ୍ ଇନ୍ କରନ୍ତୁ ଯାହାଙ୍କର ଏକ ଟ୍ରଙ୍କ୍ ତିଆରି କରିବା ପାଇଁ ନିଜର ଟେଣ୍ଟଏଣ୍ଟ ଆଇଡି ଅଛି। | **ଜଣେ ନିୟମିତ ଉପଭୋକ୍ତା ଭାବରେ ଲଗ୍ ଇନ୍ କରନ୍ତୁ ଯାହାଙ୍କର ଏକ ଟ୍ରଙ୍କ୍ ତିଆରି କରିବା ପାଇଁ ନିଜର tenantId ଅଛି।** | Brand/product name 'tenantId' should be preserved. |
| `sip.danger.deleteTrunk` | ଟ୍ରଙ୍କ୍‌ ଡିଲିଟ୍‌ କରନ୍ତୁ | **ଟ୍ରଙ୍କ୍ ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `sip.danger.deleteInbound` | ଇନକମିଂ କଲ୍ ପାଇଁ SIP ଠିକଣା କାଢ଼ି ଦିଅନ୍ତୁ | **ଇନକମିଂ SIP ଠିକଣା ଡିଲିଟ୍** | Excessive length for button label. Shorter form is better. |
| `sip.danger.reissueHint` | SIP ଠିକଣା ପାଇଁ ଲଗଇନ୍ ଏବଂ ପାସୱାର୍ଡ ପୁନଃ ପ୍ରଦାନ କରନ୍ତୁ। ପୁରୁଣା ସୂଚନା ଆଉ କାମ କରିବ ନାହିଁ। | **SIP ଠିକଣା ପାଇଁ ଲଗଇନ୍ ଏବଂ ପାସୱାର୍ଡ ପୁନଃ ଜାରି କରନ୍ତୁ। ପୁରୁଣା ସୂଚନା ଆଉ କାମ କରିବ ନାହିଁ।** | Wrong word sense: 'Re-provide' instead of 'Reissue'. |
| `sip.outbound2.callButton` | କଲ୍ କରନ୍ତୁ | **କଲ୍** | Excessive length for button label. Noun form is sufficient. |
| `sip.confirm.deleteInboundTitle` | ଇନକମିଂ ପାଇଁ SIP ଠିକଣା କାଢ଼ିବେ? | **ଇନକମିଂ SIP ଠିକଣା ଡିଲିଟ୍ କରିବେ?** | More accurate translation for 'Delete inbound SIP address?'. |
| `enterprise.common.delete` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.common.save` | ସେଭ୍ କରନ୍ତୁ | **ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.common.copy` | କପି କରନ୍ତୁ | **କପି** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.apiKey.copy` | କପି କରନ୍ତୁ | **କପି** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.gemini.leadPrefix` | ବ୍ୟକ୍ତିଗତ କୀ | **AI Studio ରୁ ବ୍ୟକ୍ତିଗତ କୀ** | Missing 'from AI Studio' for context. |
| `enterprise.gemini.leadSuffix` | । ଆପଣଙ୍କ ଆକାଉଣ୍ଟରେ ସମସ୍ତ ଜେମିନି କଲ୍ ପାଇଁ ଗ୍ଲୋବାଲ୍ କଲ୍ ପରିବର୍ତ୍ତେ ବ୍ୟବହୃତ। | **। ଆପଣଙ୍କ ଆକାଉଣ୍ଟରେ ସମସ୍ତ ଜେମିନି କଲ୍ ପାଇଁ ଗ୍ଲୋବାଲ୍ କୀ ପରିବର୍ତ୍ତେ ବ୍ୟବହୃତ।** | Wrong word sense: 'Global call' instead of 'Global key'. |
| `enterprise.gemini.deleteLabel` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.gemini.confirmDeleteCta` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.gemini.telegram.leadCreatePart1` | ଏଠାରେ ଏକ ବୋଟ୍ ତିଆରି କରନ୍ତୁ | **@BotFather ନିକଟରେ ଏକ ବୋଟ୍ ତିଆରି କରନ୍ତୁ** | Wrong word sense: 'Here' instead of 'at @BotFather'. |
| `enterprise.gemini.telegram.botFatherLabel` | @ବଟଫାଦର | **@BotFather** | Brand name '@BotFather' should be preserved. |
| `enterprise.gemini.telegram.leadStartCmd` | /ଆରମ୍ଭ କରନ୍ତୁ | **/start** | Brand/product name '/start' should be preserved. |
| `enterprise.gemini.telegram.successUnlinked` | ବଟ୍‌ଟି ଖୋଲା ଅଛି। | **ବଟ୍ ଅନଲିଙ୍କ୍ ହୋଇଛି।** | Wrong word sense: 'Is open' instead of 'Unlinked'. |
| `enterprise.gemini.telegram.saveLabel` | ସେଭ୍ କରନ୍ତୁ | **ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.gemini.telegram.testingLabel` | ହେଲମେଟ୍… | **ପଠାଯାଉଛି…** | Wrong word sense: 'Helmet' instead of 'Sending'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | ଟାଇ ଖୋଲିଦିଅ | **ଅନଲିଙ୍କ୍** | Wrong word sense: 'Untie' instead of 'Unlink'. |
| `enterprise.prompt.savePrompt` | ପ୍ରମ୍ପ୍ଟ ସେଭ୍ କରନ୍ତୁ | **ପ୍ରମ୍ପ୍ଟ ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.prompt.uploadFile` | ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ | **ଫାଇଲ୍ ଅପଲୋଡ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.prompt.hideDefault` | ଲୁଚାନ୍ତୁ | **ଲୁଚା** | Excessive length for button label. Shorter imperative is better. |
| `enterprise.prompt.headerLeadBold2` | "ତୁମ ଅନୁରୋଧ ଅନୁସାରେ" | **"ତୁମ ପ୍ରମ୍ପ୍ଟ ଅନୁସାରେ"** | Wrong word sense: 'Request' instead of 'Prompt'. |
| `enterprise.prompt.contextLeadBold` | "ତୁମ ଅନୁରୋଧ ଅନୁସାରେ" | **"ତୁମ ପ୍ରମ୍ପ୍ଟ ଅନୁସାରେ"** | Wrong word sense: 'Request' instead of 'Prompt'. |
| `enterprise.prompt.promptPlaceholder` | ତୁମର ପ୍ରୋମ୍ଟ... | **ତୁମର ପ୍ରମ୍ପ୍ଟ...** | Typo: 'ପ୍ରୋମ୍ଟ' should be 'ପ୍ରମ୍ପ୍ଟ'. |
| `enterprise.prompt.savePromptLabel` | ପ୍ରମ୍ପ୍ଟ ସେଭ୍ କରନ୍ତୁ | **ପ୍ରମ୍ପ୍ଟ ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.prompt.kbHeading` | ଜ୍ଞାନ ଆଧାର — TXT / ଶବ୍ଦ / ଏକ୍ସେଲ / CSV | **ଜ୍ଞାନ ଆଧାର — TXT / Word / ଏକ୍ସେଲ / CSV** | Brand name 'Word' should be preserved. |
| `enterprise.prompt.kbCharsSuffix` | ପ୍ରତୀକଗୁଡିକ | **ଅକ୍ଷର** | Wrong word sense: 'Symbols' instead of 'Characters'. |
| `enterprise.prompt.kbDeleteTitle` | ଜ୍ଞାନ ଆଧାରକୁ ଡିଲିଟ୍ କରନ୍ତୁ | **ଜ୍ଞାନ ଆଧାର ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.prompt.kbReplaceFile` | ଫାଇଲ୍ ବଦଳାନ୍ତୁ | **ଫାଇଲ୍ ବଦଳା** | Excessive length for button label. Shorter imperative is better. |
| `enterprise.prompt.kbUploadFile` | ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ | **ଫାଇଲ୍ ଅପଲୋଡ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.prompt.confirmKbDeleteCta` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.prompt.presetsLeadBold` | "ତୁମ ଅନୁରୋଧ ଅନୁସାରେ" | **"ତୁମ ପ୍ରମ୍ପ୍ଟ ଅନୁସାରେ"** | Wrong word sense: 'Request' instead of 'Prompt'. |
| `enterprise.questFlow.savePrompt` | ପ୍ରମ୍ପ୍ଟ ସେଭ୍ କରନ୍ତୁ | **ପ୍ରମ୍ପ୍ଟ ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.questFlow.errDelete` | Delete error | **ଡିଲିଟ୍ ତ୍ରୁଟି** | English text should be translated. |
| `enterprise.questFlow.copyKey` | କପି କରନ୍ତୁ | **କପି** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.questFlow.deleteTitle` | Delete | **ଡିଲିଟ୍** | English text should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **କୀ ଡିଲିଟ୍ କରିବେ?** | English text should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **କୀଟି ସ୍ଥାୟୀ ଭାବରେ ଡିଲିଟ୍ ହୋଇଯିବ। Quest Flow ଏହା ମାଧ୍ୟମରେ କାମ କରିବା ବନ୍ଦ କରିଦେବ - ଆପଣଙ୍କୁ ଏକ ନୂତନ କୀ ତିଆରି କରିବାକୁ ପଡିବ ଏବଂ ଏହାକୁ ଫ୍ଲୋରେ ବଦଳାଇବାକୁ ପଡିବ।** | English text should be translated. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ଡିଲିଟ୍** | English text should be translated. |
| `enterprise.questFlow.promptPlaceholder` | ତୁମର ପ୍ରୋମ୍ଟ... | **ତୁମର ପ୍ରମ୍ପ୍ଟ...** | Typo: 'ପ୍ରୋମ୍ଟ' should be 'ପ୍ରମ୍ପ୍ଟ'. |
| `enterprise.questFlow.savePromptLabel` | ସେଭ୍ କରନ୍ତୁ | **ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.questFlow.kbLeadBold2` | ଅଲଗା କରିବା | **ଅଲଗା** | Wrong word sense: 'To separate' instead of 'Separate' (adjective). |
| `enterprise.questFlow.kbCharsSuffix` | ପ୍ରତୀକଗୁଡିକ | **ଅକ୍ଷର** | Wrong word sense: 'Symbols' instead of 'Characters'. |
| `enterprise.questFlow.kbDeleteTitle` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.questFlow.kbReplaceFile` | ଫାଇଲ୍ ବଦଳାନ୍ତୁ | **ଫାଇଲ୍ ବଦଳା** | Excessive length for button label. Shorter imperative is better. |
| `enterprise.questFlow.kbUploadFile` | ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ | **ଫାଇଲ୍ ଅପଲୋଡ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.questFlow.confirmKbDeleteCta` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.chatwoot.save` | ସେଭ୍ କରନ୍ତୁ | **ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `enterprise.chatwoot.saveLabel` | ସେଭ୍ କରନ୍ତୁ | **ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `chat.refreshShort` | ରିଫ୍ରେଶ୍ କରନ୍ତୁ | **ରିଫ୍ରେଶ୍** | Excessive length for button label. Noun form is sufficient. |
| `chat.attach` | ଏକ ଫାଇଲ୍ ସଲଗ୍ନ କରନ୍ତୁ | **ଫାଇଲ୍ ସଲଗ୍ନ କରନ୍ତୁ** | Redundant 'ଏକ' (a/an). |
| `chat.deleteMessage` | ମେସେଜ୍ ଡିଲିଟ୍ କରନ୍ତୁ | **ମେସେଜ୍ ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `insights.recalc` | ପୁନରାବୃତ୍ତି | **ପୁନଃ ଗଣନା କରନ୍ତୁ** | Wrong word sense: 'Repeat' instead of 'Recalculate'. |
| `insights.summary` | ପୁନରାବୃତ୍ତି | **ସାରାଂଶ** | Wrong word sense: 'Repeat' instead of 'Summary'. |
| `insights.sentiment` | କୀ | **ଭାବ** | Wrong word sense: 'Key' instead of 'Sentiment'. |
| `insights.engagement` | ନିର୍ବନ୍ଧ | **ସମ୍ପୃକ୍ତି** | Wrong word sense: 'Marriage engagement' instead of 'Involvement'. |
| `lobby.connect` | ସଂଯୋଗ କରନ୍ତୁ | **ସଂଯୋଗ** | Excessive length for button label. Noun form is sufficient. |
| `lobby.copyLink` | ଲିଙ୍କ୍ କପି କରନ୍ତୁ | **ଲିଙ୍କ୍ କପି** | Excessive length for button label. Shorter form is better. |
| `paywall.subscribe` | ଡିଜାଇନ୍ | **ସବସ୍କ୍ରାଇବ୍ କରନ୍ତୁ** | Wrong word sense: 'Design' instead of 'Subscribe'. |
| `paywall.topupPlusLine` | ଯୁକ୍ତ ଶୁଳ୍କ ({{count}} ସର୍ବନିମ୍ନ ଅନ୍ତର୍ଭୁକ୍ତ) | **Plus ଶୁଳ୍କ ({{count}} ମିନିଟ୍ ଅନ୍ତର୍ଭୁକ୍ତ)** | Wrong word sense: 'Minimum' instead of 'Minute'. Also preserve 'Plus'. |
| `paywall.topupAddon` | ଅତିରିକ୍ତ କ୍ରୟ {{count}} ସର୍ବନିମ୍ନ × €0.17 | **ଅତିରିକ୍ତ କ୍ରୟ {{count}} ମିନିଟ୍ × €0.17** | Wrong word sense: 'Minimum' instead of 'Minute'. |
| `paywall.close` | ବନ୍ଦ କରନ୍ତୁ | **ବନ୍ଦ** | Excessive length for button label. Noun form is sufficient. |
| `confirmModal.cancel` | ବାତିଲ କରନ୍ତୁ | **ବାତିଲ** | Excessive length for button label. Noun form is sufficient. |
| `confirmModal.confirm` | ସୁନିଶ୍ଚିତ କରନ୍ତୁ | **ସୁନିଶ୍ଚିତ** | Excessive length for button label. Shorter form is better. |
| `confirmModal.delete` | ଡିଲିଟ୍ କରନ୍ତୁ | **ଡିଲିଟ୍** | Excessive length for button label. Noun form is sufficient. |
| `postCallInsights.analyzing` | ଆସନ୍ତୁ ଆଲୋଚନାକୁ ବିଶ୍ଳେଷଣ କରିବା... | **ଆଲୋଚନା ବିଶ୍ଳେଷଣ କରାଯାଉଛି...** | Wrong verb form: 'Let's analyze' instead of 'Analyzing...' |
| `postCallInsights.metricEngagement` | ନିର୍ବନ୍ଧ | **ସମ୍ପୃକ୍ତି** | Wrong word sense: 'Marriage engagement' instead of 'Involvement'. |
| `postCallInsights.summary` | ପୁନରାବୃତ୍ତି | **ସାରାଂଶ** | Wrong word sense: 'Repeat' instead of 'Summary'. |
| `settingsMore.saveProfile` | ପ୍ରୋଫାଇଲ୍ ସେଭ୍ କରନ୍ତୁ | **ପ୍ରୋଫାଇଲ୍ ସେଭ୍** | Excessive length for button label. Noun form is sufficient. |
| `billingPage.tierLabel` | ମୂଲ୍ୟାଙ୍କନ କରନ୍ତୁ | **ଶୁଳ୍କ** | Wrong word sense: 'Evaluate' instead of 'Tariff/Plan'. |
| `billingPage.cancel` | ବାତିଲ କରନ୍ତୁ | **ବାତିଲ** | Excessive length for button label. Noun form is sufficient. |
| `billingPage.resume` | ପୁନରାବୃତ୍ତି | **ପୁନଃ ଆରମ୍ଭ କରନ୍ତୁ** | Wrong word sense: 'Repeat' instead of 'Resume'. |
| `billingPage.promoApply` | ପ୍ରୟୋଗ କରନ୍ତୁ | **ପ୍ରୟୋଗ** | Excessive length for button label. Noun form is sufficient. |
| `billingPage.topupCarried` | ସ୍ଥଗିତ କରାଯାଇଛି | **ସ୍ଥାନାନ୍ତରିତ** | Wrong word sense: 'Postponed' instead of 'Carried over'. |
| `billingPage.tierPlusName` | ଯୁକ୍ତ | **Plus** | Brand name 'Plus' should be preserved. |
| `billingPage.tierStandardName` | ମାନାଙ୍କ | **Standard** | Brand name 'Standard' should be preserved. |
| `billingPage.tierEnterpriseName` | ଏଣ୍ଟରପ୍ରାଇଜ | **Enterprise** | Brand name 'Enterprise' should be preserved. |
| `billingPage.ctaSubscribePlus` | ପ୍ଲସ୍ ପାଆନ୍ତୁ | **Plus ସବସ୍କ୍ରାଇବ୍ କରନ୍ତୁ** | Wrong word sense: 'Get Plus' instead of 'Subscribe Plus'. Also preserve 'Plus'. |
| `billingPage.ctaSubscribeStandard` | ଅର୍ଡର ମାନକ | **Standard ସବସ୍କ୍ରାଇବ୍ କରନ୍ତୁ** | Wrong word sense: 'Order Standard' instead of 'Subscribe Standard'. Also preserve 'Standard'. |
| `billingPage.ctaContact` | ଯୋଗାଯୋଗ | **ଯୋଗାଯୋଗ କରନ୍ତୁ** | Grammar: Noun form instead of imperative verb for button. |
| `billingPage.presetHours` | __ଭିଭି୦__ଘଣ୍ଟା | **{{count}} ଘଣ୍ଟା** | Placeholder '{{count}}' was incorrectly translated. |
| `billingPage.presetMinutes` | __ଭିଭି୦__ମି | **{{count}} ମି** | Placeholder '{{count}}' was incorrectly translated. |
| `auth.login.submit` | ଲଗ୍ଇନ୍ | **ଲଗ୍ ଇନ୍** | Grammar: Noun form instead of imperative verb for button. |
| `auth.login.registerLink` | ପଞ୍ଜୀକୃତ କରନ୍ତୁ | **ପଞ୍ଜୀକରଣ** | Excessive length for link/button. Noun form is sufficient. |
| `auth.register.submit` | ପଞ୍ଜୀକୃତ କରନ୍ତୁ | **ପଞ୍ଜୀକରଣ** | Excessive length for button label. Noun form is sufficient. |
| `auth.register.loginLink` | ଲଗ୍ଇନ୍ | **ଲଗ୍ ଇନ୍** | Grammar: Noun form instead of imperative verb for button. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
