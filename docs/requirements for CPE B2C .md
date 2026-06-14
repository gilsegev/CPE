Existing sqaurespace site to which we will be adding functionality [https://www.guidingdiversity.com/](https://www.guidingdiversity.com/)

This document will be where we capture the requirements for the added functionality that we're going to add to my wife's current Squarespace site for delivering content courses to teachers. This is the B2C model for the CPE funding program. The context should already exist, but you should know that the CPE offers funding and there are two deliveries. One of them is directly with B2B, with the district, which is not what we're working on right now. And the other is B2C, directly between my wife, the provider, and the teacher, the consumer.

1. Registration: The user registration flow must explicitly ask for "Legal Name for Certificate" rather than relying on a standard username.   
2. Enable teachers to consume content and move at their own pace through it.   
3. The content should have modules that are a presentation accompanied by voiceover or video over from my wife, generally delivered in four to five modules each time.  
4. At the end of each course, there is going to be a multi-choice question section, probably eight to ten questions, give or take. The system corrects them or confirms their suggestion is correct regarding their delivery of understanding. (this is not a “sumbit and grade” but rather \- question \- answer type quiz)   
5. Also at the end there will be a case study where the site will present the teacher a case and they will submit their observations. For now we assume this is an open text interface and that my wife will grade the work directly.   
   1. the expected flow for the admin to read the case study, flip a status dropdown from `Pending` to `Approved`, and have that specific status change trigger the webhook to generate and email the PDF certificate  
6. The system should have an ability to bill the users for the content. Users pay directly to my wife using any existing payment methodology (Square or something else), and then handle expenses with CPE later. This requires a way to expense or collect billing.  
   1. The Square integration must be configured to automatically trigger a highly detailed, itemized email receipt upon checkout. If possible, the Next.js frontend should have a "Download Invoice" button on the user dashboard so the administration isn't burdened with emailing financial documents.   
7. The sequence users go through in the app is: watch \-\> quiz \-\> submit text \-\> manual grade \-\> auto-certificate   
   1. The user should be able to leave and resume their session at any time (after logging back in)   
8. There needs to be authentication and a way for teachers to repeat login, logout, and repeat courses which they have bought, ensuring login information and payment history are persisted over time.  
9. There should be an admin module for my wife to: a. Upload the content ( we will need to decide where the content is created \- she defers to canva for now) b. View billing information c. see observability data on the performance of the website (remember: it’s hosted on squarespace) 

Non functional requirement: 

1. I don’t expect massive load here. 1-5 users at any given time is sufficient   
2. The integration should be with the existing Squarespace site where my wife's site is already hosted (edit functionality). The front / marketing layer will be on squarspace and will link to the app we create. The app can be hosted elsewhere as long as the integration makes it look like it’s a part of [https://www.guidingdiversity.com/](https://www.guidingdiversity.com/)   
3. The data teacher provide (login info, personal info, payment info) must be securely persisted 

**Questiona/opens:**

1. Do Texas educators also need to provide their TEA ID number to be printed on the certificate, or is their legal name alongside the provider's CPE Number sufficient? 


non MVP requirements 
1. Google oauth registration - enable the user to login using their google account. Upon registration, the user will also be asked to provide their legal name (required for certificate) and TEA ID (optional).
2. 