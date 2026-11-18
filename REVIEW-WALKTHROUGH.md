# LoopMarket · Review & Presentation Walkthrough

**Target Audience:** Project Reviewers, Faculty Guides, Evaluation Committee  
**Estimated Time:** 5 Minutes

---

## 1. Project Concept & Objective

LoopMarket is an academic marketplace prototype built for MIT-ADT University students to foster a sustainable campus circular economy. It enables students to buy, sell, rent, or pass on study materials and essentials within a trusted campus boundary.

---

## 2. 5-Minute Demonstration Script

### Act 1 (00:00 – 01:00): Registration & Manual Access Review
1. Open the website: `https://loopmarket.vercel.app` (or local `http://127.0.0.1:5173`).
2. Click **Create account**. Register a new student profile (e.g. `john.doe@mitadt.edu.in`).
3. Point out that the account is placed in **Pending** status:
   > *"Notice that campus access is not granted purely by email domain; a campus moderator reviews student ID details to prevent spoofing."*
4. Log in as the Website Owner / Administrator (`/login?next=/admin`).
5. Open the **Access & accounts** tab in the Admin panel.
6. Review the pending registration, enter an approval note, and click **Approve**.
7. Return to the student session: the account status is now **Approved**, unlocking listing and enquiry capabilities.

### Act 2 (01:00 – 02:00): Marketplace Discovery & Advanced Search
1. Navigate to **Marketplace**.
2. Show transaction filter tabs: **Buy**, **Rent**, and **Free**.
3. Test search keywords: type `"Mathematics"` or filter by category **Books**.
4. Adjust price range bounds and sort by **Price: Low to High**.
5. Save a favorite listing by clicking the Heart icon; demonstrate persistence under **Saved items**.

### Act 3 (02:00 – 03:00): Listing Creation with Permanent Photo Upload
1. Click **Sell an item** (`/sell`).
2. Select transaction type: **Sell**, **Rent**, or **Giveaway**.
3. Fill in listing details: Title, Category, Pickup Location, Asking Price, and Description.
4. Drag and drop a product photograph:
   > *"Image uploads validate file magic bytes (JPG/PNG/WebP) and enforce a 5 MB limit. On production, files are saved permanently in Vercel Blob."*
5. Check the **Live Preview** card on the right, which dynamically updates as fields are filled.
6. Publish the listing and view it under **My Listings**.

### Act 4 (03:00 – 04:00): Enquiries, Messages & Rental Coordination
1. Switch to a second student session and open the newly created listing.
2. Send an enquiry message.
3. Switch back to the seller session: open **Enquiry inbox** (`/inbox`).
4. Show the real-time conversation thread and message exchange.
5. Demonstrate rental request flow:
   - Select future dates within availability.
   - Show automatic total rental estimate and refundable deposit breakdown.
   - Accept the request: demonstrate that overlapping bookings are prevented by database triggers.

### Act 5 (04:00 – 05:00): Moderation, Reporting & Audit Logging
1. From any listing page, submit a report (e.g. "Misleading pickup spot").
2. Switch to Owner / Admin view:
   - Open **Reports** tab to review the reported item and record an administrative resolution.
   - Open **Activity Log** tab to display the immutable audit trail of actions (account status changes, listing creations, moderation decisions).
3. Conclude the demonstration.
