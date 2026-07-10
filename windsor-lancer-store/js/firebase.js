    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
             signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
             sendPasswordResetEmail, sendEmailVerification, updateProfile
           } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import { getFirestore, collection, doc, setDoc, getDoc, getDocs,
             addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
           } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    // ════════════════════════════════════════════════════════════════════════
    // PASTE YOUR FIREBASE CONFIG HERE
    // Steps: console.firebase.google.com → Project → Add Web App → copy config
    // Then: Authentication → Sign-in method → enable Email/Password AND Google
    // ════════════════════════════════════════════════════════════════════════
    const firebaseConfig = {
      apiKey:            "AIzaSyDAUB0bf2alUw3CTazR3-WJJPuwQIDHf-Y",
      authDomain:        "windsor-lancer-store.firebaseapp.com",
      projectId:         "windsor-lancer-store",
      storageBucket:     "windsor-lancer-store.firebasestorage.app",
      messagingSenderId: "651284530626",
      appId:             "1:651284530626:web:766738232083b24b1b425b",
      measurementId:     "G-6E9EFM7JL9"
    };

    // ── Admin email list — these users get the Admin Dashboard ───────────────
    const ADMIN_EMAILS = [
      "sarveshsolanke@gmail.com",
      "admin2@uwindsor.ca",
      "admin3@uwindsor.ca",
      "admin4@uwindsor.ca"
    ];

    // ── Init Firebase ────────────────────────────────────────────────────────
    let auth, db, provider;
    try {
      const app = initializeApp(firebaseConfig);
      auth      = getAuth(app);
      db        = getFirestore(app);
      provider  = new GoogleAuthProvider();
      window._db = db; // expose for use in regular scripts
    } catch(initErr) {
      console.error('Firebase init failed — did you paste your config?', initErr);
    }

    function requireAuth() {
      if (!auth) {
        window.showToast('❌ Firebase not configured yet. Paste your firebaseConfig first.', 'error');
        return false;
      }
      return true;
    }

    // ── Password show/hide toggle ────────────────────────────────────────────
    window.togglePassword = (inputId, btn) => {
      const el = document.getElementById(inputId);
      if (!el) return;
      const show = el.type === 'password';
      el.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁';
    };

    // ── Auth helpers exposed to global scope (called by onclick= handlers) ───
    window._firebaseAuth = {

      signInEmail: async () => {
        if (!requireAuth()) return;
        const email = document.getElementById('login-email')?.value?.trim();
        const pass  = document.getElementById('login-password')?.value?.trim();
        if (!email || !pass) { window.showToast('❌ Please enter email and password', 'error'); return; }
        try {
          const cred = await signInWithEmailAndPassword(auth, email, pass);
          handleAuthSuccess(cred.user);
        } catch(e) {
          console.error('signInEmail error:', e.code, e.message);
          window.showToast('❌ ' + friendlyError(e.code), 'error');
        }
      },

      signInGoogle: async () => {
        if (!requireAuth()) return;
        try {
          const cred = await signInWithPopup(auth, provider);
          handleAuthSuccess(cred.user);
        } catch(e) {
          console.error('signInGoogle error:', e.code, e.message);
          if (e.code !== 'auth/popup-closed-by-user')
            window.showToast('❌ ' + friendlyError(e.code), 'error');
        }
      },

      register: async () => {
        if (!requireAuth()) return;
        const name  = document.getElementById('reg-name')?.value?.trim();
        const email = document.getElementById('reg-email')?.value?.trim();
        const pass  = document.getElementById('reg-password')?.value?.trim();
        const pass2 = document.getElementById('reg-password2')?.value?.trim();
        if (!name)           { window.showToast('❌ Please enter your full name', 'error'); return; }
        if (!email)          { window.showToast('❌ Please enter your email', 'error'); return; }
        if (!pass)           { window.showToast('❌ Please enter a password', 'error'); return; }
        if (pass.length < 6) { window.showToast('❌ Password must be at least 6 characters', 'error'); return; }
        if (pass !== pass2)  { window.showToast('❌ Passwords do not match', 'error'); return; }
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          try { await updateProfile(cred.user, { displayName: name }); } catch(_) {}
          try { await sendEmailVerification(cred.user); } catch(_) {}
          window.showToast('✅ Account created! Verification email sent to ' + email, 'gold');
          handleAuthSuccess(cred.user);
        } catch(e) {
          console.error('register error code:', e.code, '| message:', e.message);
          // Show the REAL error code so nothing is hidden
          window.showToast('❌ ' + friendlyError(e.code) + ' [' + (e.code||'?') + ']', 'error');
        }
      },

      resetPassword: async () => {
        if (!requireAuth()) return;
        const email = document.getElementById('login-email')?.value?.trim();
        if (!email) {
          window.showToast('❌ Type your email in the box above first, then click Forgot password', 'error');
          return;
        }
        try {
          await sendPasswordResetEmail(auth, email);
          window.showToast('✅ Password reset email sent to ' + email + ' — check your inbox', 'gold');
        } catch(e) {
          console.error('resetPassword error:', e.code, e.message);
          window.showToast('❌ ' + friendlyError(e.code), 'error');
        }
      },

      signOut: async () => {
        if (!requireAuth()) return;
        await signOut(auth);
        window.currentUser = null;
        window.updateNavForUser?.();
        window.showScreen?.('auth');
        window.showToast('Signed out successfully', 'gold');
      }
    };

    async function handleAuthSuccess(user) {
      const role = ADMIN_EMAILS.includes(user.email.toLowerCase()) ? 'admin' : 'user';
      window.currentUser = {
        uid:      user.uid,
        name:     user.displayName || user.email.split('@')[0],
        email:    user.email,
        verified: user.emailVerified,
        role:     role
      };

      // ── Save/update user in Firestore users collection ──────────────────
      if (db) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const snap    = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid:          user.uid,
              name:         user.displayName || user.email.split('@')[0],
              email:        user.email,
              role:         role,
              emailVerified: user.emailVerified,
              createdAt:    serverTimestamp(),
              lastLogin:    serverTimestamp(),
              totalOrders:  0,
              totalSpent:   0
            });
          } else {
            await updateDoc(userRef, {
              lastLogin:    serverTimestamp(),
              emailVerified: user.emailVerified,
              name:         user.displayName || snap.data().name
            });
          }
          window._firestoreOps = { db, collection, doc, setDoc, getDoc, getDocs,
            addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp };
          window.loadUserDataFromFirestore?.();
        } catch(e) { console.warn('Firestore user save failed:', e); }
      }

      window.updateNavForUser?.();
      window.dispatchEvent(new CustomEvent('authReady', { detail: window.currentUser }));
      if (window.currentUser.role === 'admin') {
        window.showScreen?.('admin-full');
        window.renderAdminFull?.();
        window.showToast('🔐 Welcome, ' + window.currentUser.name + '! (Admin)', 'gold');
        window.loadAdminDataFromFirestore?.();
      } else {
        window.showScreen?.('home');
        if (!user.emailVerified) {
          setTimeout(() => window.showToast('📧 Please verify your email — check your inbox', 'gold'), 1500);
        } else {
          window.showToast('👋 Welcome back, ' + window.currentUser.name + '!', 'gold');
        }
      }
    }

    function friendlyError(code) {
      const map = {
        'auth/user-not-found':          'No account found with that email.',
        'auth/wrong-password':          'Incorrect password. Try again or use Forgot password.',
        'auth/invalid-email':           'Please enter a valid email address.',
        'auth/email-already-in-use':    'An account with that email already exists. Try signing in instead.',
        'auth/weak-password':           'Password must be at least 6 characters.',
        'auth/too-many-requests':       'Too many attempts. Please wait a few minutes and try again.',
        'auth/network-request-failed':  'Network error — check your internet connection.',
        'auth/invalid-credential':      'Invalid email or password. Check and try again.',
        'auth/operation-not-allowed':   'Email/password sign-in is not enabled. Contact support.',
        'auth/user-disabled':           'This account has been disabled. Contact support.',
        'auth/requires-recent-login':   'Please sign in again to continue.',
        'auth/popup-blocked':           'Popup was blocked. Allow popups for this site and try again.',
        'auth/cancelled-popup-request': 'Sign-in cancelled.',
        'auth/internal-error':          'Internal error. Please try again.',
        'auth/configuration-not-found': 'Firebase is not configured yet. Paste your firebaseConfig.',
      };
      return map[code] || ('Error: ' + (code || 'unknown') + '. Please try again.');
    }

    // Keep auth state in sync — fires on every page load if already signed in
    onAuthStateChanged(auth, async user => {
      if (user) {
        const role = ADMIN_EMAILS.includes(user.email.toLowerCase()) ? 'admin' : 'user';
        window.currentUser = {
          uid:      user.uid,
          name:     user.displayName || user.email.split('@')[0],
          email:    user.email,
          verified: user.emailVerified,
          role:     role
        };
        // Always expose Firestore ops so data can load
        window._firestoreOps = { db, collection, doc, setDoc, getDoc, getDocs,
          addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp };

        window.updateNavForUser?.();
        window.dispatchEvent(new CustomEvent('authReady', { detail: window.currentUser }));
        window.renderProfile?.();

        if (role === 'admin') {
          // Load all admin data from Firestore
          await window.loadAdminDataFromFirestore?.();
        } else {
          await window.loadUserDataFromFirestore?.();
        }
      } else {
        window.currentUser = null;
        window.updateNavForUser?.();
        window.dispatchEvent(new CustomEvent('authReady', { detail: null }));
      }
    });
