import{deactivateVendorLink as e,generateVendorToken as t,getVendorLinksForEvent as n,setVendorLink as r}from"./mockStore-Cat_jsL3.js";var i=[{templateId:`tpl-sow`,title:`SOW review & sign-off — {{event_code}}`,category:`SOW`,instructions:`Review the Statement of Work received from PSA for {{event_name}}.

1. Identify all LEM responsibilities listed in the SOW.
2. Confirm attendee count, event format, and special requirements.
3. Upload the signed SOW PDF to this task.
4. Flag any missing information back to PSA before proceeding.

Assigned member: {{owner_email}} · Event dates: {{dates}} · Venue: {{venue}}`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:1,active:`yes`,dueOffsetDays:-28,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-venue`,title:`Venue coordination — {{venue}}`,category:`Venue`,instructions:`Coordinate venue logistics for {{event_name}} in {{city}} ({{dates}}).

1. Confirm final room capacity and seating layout.
2. Agree on load-in / load-out times with venue contact.
3. Obtain floor plans for AV, interpretation, and registration placement.
4. Confirm Wi-Fi credentials and AV connection points.
5. Upload signed venue contract and floor plan to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:2,active:`yes`,dueOffsetDays:-21,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-av`,title:`AV & technical setup — {{city}}`,category:`AV`,instructions:`Manage AV and technical requirements for {{event_code}} at {{venue}} on {{dates}}.

1. Confirm microphone types (lapel, handheld, podium) and quantities.
2. Confirm projection/screen requirements and aspect ratio.
3. Confirm recording requirements (video/audio).
4. Book AV vendor and share floor plan.
5. Schedule rehearsal/sound-check slot minimum 2 hours before opening.
6. Upload AV quote and setup confirmation to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:3,active:`yes`,dueOffsetDays:-14,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-interpretation`,title:`Interpretation setup — {{city}}`,category:`Interpretation`,instructions:`Arrange interpretation services for {{event_name}} ({{dates}}).

1. Confirm source language and all target languages from the SOW.
2. Confirm number of interpretation booths required.
3. Book interpreters and issue briefing documents.
4. Coordinate booth placement on the floor plan with venue.
5. Confirm receiver/headset quantities for delegates.
6. Upload interpretation confirmation and booth specs to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:4,active:`yes`,dueOffsetDays:-14,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-transportation`,title:`Airport transportation — {{city}}`,category:`Transportation`,instructions:`Organise airport transfer logistics for {{event_name}} in {{city}}.

1. Collect all arrival and departure flight details from delegates.
2. Group delegates by arrival window (max 2-hour slots per vehicle).
3. Book appropriate vehicles (minibus / sedan) per group.
4. Confirm driver contact details and share with delegates.
5. Prepare and upload transfer schedule to this task.
6. Brief drivers with hotel/venue address, parking, and timing.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:5,active:`yes`,dueOffsetDays:-7,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-registration`,title:`Registration desk setup — {{venue}}`,category:`Registration`,instructions:`Set up the delegate registration desk for {{event_name}} ({{dates}}) at {{venue}}.

1. Prepare the delegate list and print alphabetical sign-in sheets.
2. Confirm desk location with venue — near main entrance, good signage.
3. Arrange required equipment: laptop, printer, scanner, stationery.
4. Prepare welcome packs / lanyards / materials for each delegate.
5. Brief registration staff on check-in procedure and escalation contacts.
6. Upload final delegate list and welcome pack checklist to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:6,active:`yes`,dueOffsetDays:-3,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-printing`,title:`Name badges & printing — {{event_name}}`,category:`Printing`,instructions:`Manage all printing requirements for {{event_name}} ({{dates}}).

1. Confirm final delegate list and badge format (name, title, org, colour coding).
2. Design and print name badges — include lanyards.
3. Print agenda booklets, table cards, directional signage.
4. Print banners (confirm dimensions with venue).
5. Prepare spare blank badges for on-site additions.
6. Upload print-ready files and vendor confirmation to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:7,active:`yes`,dueOffsetDays:-5,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-catering`,title:`Catering coordination — {{city}}`,category:`Catering`,instructions:`Arrange catering for {{event_name}} at {{venue}} on {{dates}}.

1. Confirm headcount and any dietary restrictions from delegate list.
2. Agree menu with venue/caterer (coffee breaks, lunch, dinner if applicable).
3. Confirm service times aligned with agenda.
4. Confirm halal, vegetarian, vegan, and allergy-safe options.
5. Upload catering quote and confirmed menu to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:8,active:`yes`,dueOffsetDays:-7,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-photography`,title:`Photography & video — {{event_name}}`,category:`Photography`,instructions:`Coordinate photography and video coverage for {{event_name}} ({{dates}}) in {{city}}.

1. Confirm scope: event photography only, or also video recording?
2. Book photographer/videographer and share the agenda and floor plan.
3. Brief photographer on key moments: opening, panel sessions, group photo.
4. Confirm image delivery timeline and format (RAW/JPEG, Google Drive link).
5. Upload photographer brief and confirmation to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:9,active:`yes`,dueOffsetDays:-10,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-internet`,title:`Internet & connectivity — {{venue}}`,category:`AV`,instructions:`Ensure reliable internet for {{event_name}} at {{venue}} ({{dates}}).

1. Obtain venue Wi-Fi credentials and test speed (min 50 Mbps recommended).
2. Confirm number of simultaneous connections needed.
3. If venue Wi-Fi is insufficient, arrange 4G/5G router or dedicated line.
4. Prepare printed Wi-Fi credentials card for registration desk.
5. Test interpretation streaming platform connectivity on-site.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:10,active:`yes`,dueOffsetDays:-3,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-lodging`,title:`Hotel & lodging — {{city}}`,category:`Travel`,instructions:`Coordinate hotel accommodation for {{event_name}} delegates in {{city}}.

1. Confirm number of rooms required and check-in / check-out dates.
2. Block rooms at agreed hotel (or use hotel if same as {{venue}}).
3. Share hotel address, check-in instructions, and booking reference with delegates.
4. Confirm breakfast inclusion and any special requests.
5. Upload room list and hotel confirmation to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:11,active:`yes`,dueOffsetDays:-14,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-lem`,title:`LEM on-site coordination — {{event_name}}`,category:`LEM`,instructions:`Overall LEM on-site readiness for {{event_code}} in {{city}} on {{dates}}.

1. Confirm LEM scope from SOW is fully covered by task list.
2. Prepare on-site operations manual (contacts, timeline, escalation).
3. Conduct pre-event walkthrough with venue at least 24 hours before.
4. Confirm all vendor arrival times and on-site contacts.
5. Brief all team members on their roles and the run-of-show.
6. Upload the final run-of-show schedule to this task.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:12,active:`yes`,dueOffsetDays:-2,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-per-diem`,title:`Per diem distribution — {{event_name}}`,category:`Finance`,instructions:`Distribute M&IE (per diem) and reimbursements to delegates on-site at {{event_name}} in {{city}} ({{dates}}).

USE THE ATTACHED "Per Diem Distribution" FORM for every traveler.

— HOW TO COMPLETE THE FORM —

Section 1 · M&IE (Meals & Incidental Expenses)
• Calculate: USG daily rate × number of travel days (check SOW for the approved rate).
• PSA pays M&IE on the day of arrival in the country.
• If breakfast is included in the lodging rate (but not complimentary), deduct accordingly per FTR.
• Deduct meals provided on all workshop days.
• Record the currency of payment (usually EUR) and the USD equivalent.
• Do NOT write anything in the green traveler signature box — traveler signs there only.

Section 2 · Visa reimbursement
• Only reimburse with an original receipt, up to $250 USD maximum.
• Write the exact amount in local currency and the exchange rate used.
• Calculate and record the USD equivalent.
• If the reimbursement exceeds the maximum allowance, obtain IPS approval BEFORE paying.
• Do NOT write in this section if no receipt is provided.

Section 3 · Ground transportation
• Reimburse home-city airport transfers only, with receipt, up to $60 USD maximum.
• Same rules as Visa: exact local amount, exchange rate, USD equivalent.
• IPS approval required if reimbursement exceeds the cap.

— COLOUR CODING —
• GREEN fields → traveler fills in and signs only.
• BLUE fields → LEM (you) fills in amounts and signs.
• APPROVAL BOX → IPS only — do not touch unless IPS is present.

— SIGNATURE RULES —
• Only sign a section if the corresponding amount is actually being paid to the traveler.
• "Distributed by LEM" line: sign and date after handing over the funds.
• "Received by traveler" line: traveler signs and dates upon receipt.

— CHECKLIST —
1. Print one form per traveler before the event.
2. Pre-fill event name, traveler name, and M&IE calculation.
3. Collect receipts for visa and transport before the distribution session.
4. Obtain IPS approval for any overages before the session.
5. Disburse funds, have traveler sign, then sign as LEM.
6. Photograph or scan all completed forms and upload to this task.
7. Submit originals to PSA per the SOW instructions.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:13,active:`yes`,dueOffsetDays:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-transfer`,title:`Airport transfer list — {{event_code}} {{city}}`,category:`Transportation`,instructions:`Generate the airport ↔ hotel transfer list for {{event_name}} in {{city}} ({{dates}}).

📋 USE THE TRANSFER LIST GENERATOR TOOL:
→ /transfer-list?code={{event_code}}&city={{city}}&dates={{dates}}

— HOW TO USE THE GENERATOR —

1. Open the link above (pre-filled with event details).
2. Enter the hotel name and airport name(s).
   • If arrivals and departures use different airports, fill both fields.
3. Add each traveler and complete all fields:
   ARRIVALS  → name, phone, type (Expert/Participant), arrival date, flight code, arrival time
   DEPARTURES → departure date, flight code, departure time, hotel pick-up time
   (Departure fields auto-fill the traveler's name, phone and type from the arrivals data)
4. Travelers on the same flight are automatically grouped together.
5. Vehicle type is assigned automatically per group:
   1–2 pax → SEDAN   ·   3–7 → VAN   ·   8–14 → SPRINTER
   15–24 → MINIBUS   ·   25–45 → BUS
6. The dark blue separator line appears between each flight group.
7. Click "Export Excel (.xlsx)" — the file is named automatically:
   {code}_{city}_{dates}_Transfer_List.xlsx

— CHECKLIST —
1. Collect all arrival/departure flight details from the SOW or traveler confirmations.
2. Confirm hotel name and airport names with the venue team.
3. Generate the list 5–7 days before the event.
4. Share with the transportation vendor and upload the final xlsx to this task.
5. Update the list if any flight details change.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:4,active:`yes`,dueOffsetDays:-7,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-per-diem-form`,title:`Generate per diem forms — {{event_name}}`,category:`Finance`,instructions:`Generate and print event-specific per diem cash disbursement forms for {{event_name}} in {{city}} ({{dates}}).

📋 USE THE FORM GENERATOR TOOL:
→ /per-diem-form?event={{event_code}}&location={{city}}&dates={{dates}}

— CONFIGURABLE AMOUNTS FOR THIS EVENT —

Enter the following amounts when you open the generator:

1. M&IE daily rate (USD): \${{per_diem_daily_rate}}
   → Total = rate × number of travel days per traveler

2. Maximum Visa reimbursement (USD): \${{max_visa_allowance}}
   → Reimburse only with original receipt, up to this cap.
   → If the actual receipt amount exceeds the cap, obtain IPS approval BEFORE paying.

3. Maximum ground transportation (USD): \${{max_ground_transport}}
   → Home-city airport transfers only, with receipt, up to this cap.
   → IPS approval required for any overage.

— STEPS —
1. Open the form generator (link above), enter the three amounts for this event.
2. Enter the traveler's name and event details.
3. Click "Generate form", then "Print / Save as PDF".
4. Repeat for every traveler expected to receive per diem.
5. Bring printed forms on-site, collect signatures, disburse funds.
6. Scan completed forms and upload them to this task.

— COLOUR CODING REMINDER —
• GREEN → traveler fills in and signs only.
• BLUE → LEM fills in amounts and signs.
• APPROVAL BOX → IPS only.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:14,active:`yes`,dueOffsetDays:-3,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`},{templateId:`tpl-av-equipment`,title:`AV equipment list — {{event_code}} {{city}}`,category:`AV`,instructions:`Generate the conference AV equipment list for {{event_name}} in {{city}} ({{dates}}).

🎛️ USE THE AV EQUIPMENT LIST GENERATOR TOOL:
→ /av-equipment

— HOW TO USE THE GENERATOR —

1. Open the link above and select this event from the event dropdown.
2. Choose the setup style (Classroom / Cabaret / Theatre / U-Shape / Boardroom).
3. Enter the number of PAX and the number of days AV is needed.
4. Check each equipment item required for the event and configure its options:
   • LCD projector  → choose luminosity (3000–8000 lm) and quantity
   • Projector screen → choose size and quantity
   • Laptop → quantity (1–15)
   • Fixed tabletop mics → number of mics (10–150)
   • Head table mics → number (1–10)
   • Wireless/lapel mics → lapel count (1–4) + handheld count (1–10)
   • Simultaneous Interpretation → receivers (5–200) and booths (1–5)
5. Review the live preview on the right to confirm descriptions and quantities.
6. Click "Export Equipment List (.xlsx)" — the file is named automatically:
   {code}_{city}_{date}_Equipment.xlsx

— CHECKLIST —
1. Confirm setup style and PAX count with the venue team.
2. Verify interpretation language requirements and booth/receiver counts.
3. Send the exported list to the AV vendor for quotation.
4. Upload the vendor-confirmed list to this task once pricing is agreed.`,defaultAssigneeEmail:``,defaultAssigneeName:``,sortOrder:5,active:`yes`,dueOffsetDays:-14,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:`system`}],a={"tpl-sow":[{fileId:`tf-sow-1`,templateId:`tpl-sow`,fileName:`SOW-checklist.pdf`,mimeType:`application/pdf`,driveFileId:``,driveUrl:`#`,sizeBytes:245e3,uploadedAt:new Date().toISOString()}],"tpl-av":[{fileId:`tf-av-1`,templateId:`tpl-av`,fileName:`AV-requirements.docx`,mimeType:`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,driveFileId:``,driveUrl:`#`,sizeBytes:52e3,uploadedAt:new Date().toISOString()}],"tpl-per-diem":[{fileId:`tf-per-diem-1`,templateId:`tpl-per-diem`,fileName:`Per diem distribution.pdf`,mimeType:`application/pdf`,driveFileId:``,driveUrl:`/Per diem distribution.pdf`,sizeBytes:63e3,uploadedAt:new Date().toISOString()}],"tpl-per-diem-form":[{fileId:`tf-per-diem-form-1`,templateId:`tpl-per-diem-form`,fileName:`Per diem distribution.pdf`,mimeType:`application/pdf`,driveFileId:``,driveUrl:`/Per diem distribution.pdf`,sizeBytes:63e3,uploadedAt:new Date().toISOString()}]};function o(){return i.filter(e=>e.active===`yes`).sort((e,t)=>Number(e.sortOrder)-Number(t.sortOrder)).map(e=>({template:e,files:a[e.templateId]||[]}))}function s(e){let t=i.find(t=>t.templateId===e);return t?{template:t,files:a[e]||[]}:null}function c(e){let t={templateId:`tpl-`+Date.now(),title:e.title||`New template`,category:e.category||`General`,instructions:e.instructions||``,defaultAssigneeEmail:e.defaultAssigneeEmail||``,defaultAssigneeName:e.defaultAssigneeName||``,sortOrder:e.sortOrder??99,active:`yes`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:e.createdBy||``};return i.push(t),a[t.templateId]=[],t}function l(e,t){let n=i.findIndex(t=>t.templateId===e);if(n<0)throw Error(`Template not found`);return i[n]={...i[n],...t,updatedAt:new Date().toISOString()},i[n]}function u(e){l(e,{active:`no`})}function d(e,t){let n={fileId:`tf-`+Date.now(),templateId:e,fileName:t.name,mimeType:t.type,driveFileId:``,driveUrl:URL.createObjectURL(t),sizeBytes:t.size,uploadedAt:new Date().toISOString()};return a[e]||(a[e]=[]),a[e].push(n),n}function f(e,i,a){let o=a?.vendorCategory||``,s=n(e).find(e=>(e.vendorCategory||``)===o);if(s)return s;let c={linkId:`vl-`+e+`-`+Date.now()+`-`+Math.random().toString(36).slice(2,8),token:t(),eventCode:e,eventRowId:i,label:a?.label||(a?.vendorName?`${a.vendorName} portal`:o?`${o} portal`:`Vendor portal`),vendorCategory:o||void 0,vendorName:a?.vendorName,permission:a?.permission||`view`,createdAt:new Date().toISOString(),createdBy:``,active:`yes`};return r(c),c}function p(t,r,i){let a=i?.vendorCategory||``;return n(t).filter(e=>(e.vendorCategory||``)===a).forEach(t=>e(t.linkId)),f(t,r,i)}function m(e){return n(e)}function h(t){e(t)}export{d as addMockTemplateFile,c as createMockTemplate,u as deleteMockTemplate,s as getMockTemplate,f as getOrCreateMockVendorLink,o as listMockTemplatesWithFiles,m as listMockVendorLinks,p as regenerateMockVendorLink,h as revokeMockVendorLink,l as updateMockTemplate};