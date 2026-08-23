# LapMob Firebase fixed files

These files fix the main consistency issue:
- Cash, Bank, Savings, Emergency Fund, and Other are all supported.
- Dashboard and account pages use the same Firestore `users/{uid}/transactions` collection.
- Balances are calculated from transactions, so opening an account page cannot reset another account.
- Add/delete updates sync live through Firestore.
- Other account name is stored locally and also in Firestore.
- Eye visibility remains local to the browser.

IMPORTANT:
Change the script tags in index.html, bank.html, savings.html, emergency.html, and other.html to:
<script type="module" src="app.js"></script>   (index.html)
<script type="module" src="account-page.js"></script>   (account pages)

Keep your existing HTML/CSS/design files.
