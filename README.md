# LapMob Budget Tracker V5

A Firebase-backed budget tracker with personal user accounts.

## Features
- Email/password registration and login
- Password reset email
- Logout
- Each user's transactions are stored under their own Firebase UID
- Phone ↔ laptop synchronization through Firestore
- Responsive layout for mobile and desktop

## Files
- `index.html` — page structure
- `style.css` — design
- `app.js` — authentication, Firestore, and budget logic
- `firebase-config.js` — Firebase web configuration
- `firestore.rules` — rules so users can access only their own transactions

## Firebase setup
In Firebase Console:
1. Authentication → Sign-in method → enable **Email/Password**.
2. Firestore Database → use the `firestore.rules` rules from this project.
3. Keep your web app in GitHub Pages (or another HTTPS host). Do not open the HTML with `file://`.

## Important
Each friend creates their own account. Their transactions are separated by their Firebase user ID.
