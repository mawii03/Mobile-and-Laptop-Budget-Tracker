# LapMob Budget Tracker V7

Google-login budget tracker with profile settings.

## New in V7
- Continue with Google authentication
- Profile Settings button
- Change your display name
- Display name is saved to the Firebase Authentication profile
- Same account works across phone and laptop
- Log out

## Firebase setup
- Authentication → Sign-in method → Google → Enable
- Authentication → Settings → Authorized domains → add your GitHub Pages domain
- Firestore → use the included `firestore.rules`

## Hosting
Serve through GitHub Pages or another HTTPS host. Do not open the files directly with `file://`.
