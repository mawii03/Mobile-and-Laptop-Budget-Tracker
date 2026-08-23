# LapMob Budget Tracker — Real Local Version

This version is for testing the actual behavior before Firebase.

- Starts with zero balances and no transactions.
- Income increases only the selected account.
- Expense decreases only the selected account.
- Withdrawal decreases only the selected account.
- Bank, Savings, Emergency Fund, and Other have separate pages.
- Cash transactions stay on the dashboard.
- Amount fields start empty.
- Data is saved in browser localStorage and shared by these pages in the same browser.
- Refreshing does not erase saved data.

Example:
Cash = NT$0
Add Income → Cash → NT$1,000

Cash becomes NT$1,000.
Bank, Savings, Emergency Fund, and Other remain unchanged.

This is ready to connect to Firebase later.


## Eye toggle
Amounts on the dashboard and account pages can be hidden or shown with the eye button. The setting is saved in localStorage.


Eye buttons now stop link/card clicks, so clicking the eye only hides/shows the amount and does not open Bank, Savings, Emergency, or Other.
