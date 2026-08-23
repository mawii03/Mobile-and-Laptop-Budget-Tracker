# LapMob Budget Tracker - Firebase Ready

These files keep the existing HTML/CSS design and move budget data to Firebase.

## Files
- index.html
- bank.html
- savings.html
- emergency.html
- other.html
- app.js
- account-page.js
- firebase-app.js
- firebase-config.js
- firestore.rules

## Firebase features
- Google Authentication
- Firestore transactions per signed-in user
- Cloud sync across pages/devices
- Other account name stored in Firestore
- Existing localStorage transactions are migrated once to the signed-in user's Firestore account if that user's cloud transaction collection is empty.
- Eye visibility preference remains local to the browser.

## Important
1. In Firebase Authentication, enable Google under Sign-in providers.
2. Add your website domain under Authentication -> Settings -> Authorized domains.
3. Publish firestore.rules in Firebase Console -> Firestore Database -> Rules.
4. Open the site through a web server (for example GitHub Pages or VS Code Live Server), not by double-clicking an HTML file.

The firebase-config.js file contains the web app configuration supplied for this project.
