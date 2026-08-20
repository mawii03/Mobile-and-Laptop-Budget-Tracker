# LapMob Budget Tracker V6

Google-only authentication version.

## User flow
1. Friend opens the website.
2. Clicks **Continue with Google**.
3. Selects their Google account.
4. They enter their own private budget.
5. The same Google account works on phone and laptop.
6. **Log out** is available at the top right.

## Firebase setup
In Firebase Console:
1. Authentication → Sign-in method → enable **Google**.
2. Authentication → Settings → Authorized domains → make sure your GitHub Pages domain is listed.
3. Firestore → publish/use the included `firestore.rules`.

## Important
The website must be served over HTTPS, such as GitHub Pages. Do not open `index.html` directly with `file://`.

Google sign-in is implemented with the Firebase Web SDK.
