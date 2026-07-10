# Windsor Lancer Store — MVP Prototype

A front-end e-commerce prototype (product listing, cart, checkout flow, and an
admin panel) built with vanilla HTML/CSS/JS, Firebase (Auth + Firestore), and
optional Cloudinary image uploads.

## Structure

```
windsor-lancer-store/
├── index.html        Page markup (nav, home/listing/cart/admin screens)
├── css/
│   └── styles.css     All styling
├── js/
│   ├── firebase.js    Firebase init, auth state, config (ES module)
│   └── app.js         App logic: cart, products, orders, admin panel
└── assets/            Static images/icons (if any)
```

## Setup

1. Open `js/firebase.js` and replace `firebaseConfig` with your own Firebase
   project's config (Firebase console → Project settings → Web app).
2. Enable **Email/Password** and **Google** sign-in under
   Authentication → Sign-in method.
3. (Optional) Set up Cloudinary for persistent admin-uploaded product images —
   see the `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` constants in
   `js/app.js`. Without this, uploaded images fall back to local base64
   storage and won't sync across devices.
4. Serve the folder with any static server (e.g. `npx serve .`) — Firebase's
   modular SDK requires `http(s)://`, not `file://`.

## Notes

The original single-file export had its entire Firebase auth/init block and
entire `<body>` markup duplicated (pasted twice back-to-back). That's been
de-duplicated here — worth knowing in case anything looks different from
what you remember seeing.
