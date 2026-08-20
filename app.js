import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = !Object.values(firebaseConfig).some(v => v.includes("PASTE_YOUR"));

let app;
let auth;
let db;
let user = null;
let data = [];
let unsubscribeTransactions = null;

const $ = id => document.getElementById(id);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return "NT$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function setStatus(text, ok = false) {
  $("status").textContent = text;
  $("status").className = "status" + (ok ? " ok" : "");
}

function setAuthMessage(text = "", type = "") {
  $("authMessage").textContent = text;
  $("authMessage").className = "auth-message" + (type ? ` ${type}` : "");
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/cancelled-popup-request": "The Google sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Please allow pop-ups for this site.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase yet.",
    "auth/network-request-failed": "Network error. Please check your internet connection."
  };
  return map[code] || error?.message || "Google sign-in failed.";
}

function render() {
  const type = $("typeFilter").value;
  const month = $("monthFilter").value;

  const filtered = data
    .filter(x =>
      (type === "all" || x.type === type) &&
      (month === "all" || String(x.date).startsWith(month))
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const inc = data
    .filter(x => x.type === "income")
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  const exp = data
    .filter(x => x.type === "expense")
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  $("income").textContent = money(inc);
  $("expenses").textContent = money(exp);
  $("balance").textContent = money(inc - exp);
  $("count").textContent = data.length;

  $("rows").innerHTML = filtered.map(x => {
    const typeLabel = x.type === "income"
      ? "Income"
      : x.type === "expense"
        ? "Expense"
        : "Bank Balance";

    const typeClass = x.type === "income"
      ? "income"
      : x.type === "expense"
        ? "expense"
        : "";

    const prefix = x.type === "income" ? "+" : x.type === "expense" ? "-" : "";

    return `<tr>
      <td>${esc(x.date)}</td>
      <td class="${typeClass}">${typeLabel}</td>
      <td>${esc(x.category)}</td>
      <td>${esc(x.note || "—")}</td>
      <td>${prefix}${money(x.amount)}</td>
      <td><button class="delete" data-delete-id="${esc(x.id)}" type="button">Delete</button></td>
    </tr>`;
  }).join("");

  $("empty").style.display = filtered.length ? "none" : "block";

  const ym = today().slice(0, 7);
  $("monthSpend").textContent = money(
    data
      .filter(x => x.type === "expense" && String(x.date).startsWith(ym))
      .reduce((s, x) => s + Number(x.amount || 0), 0)
  );

  const cats = {};
  data
    .filter(x => x.type === "expense")
    .forEach(x => cats[x.category] = (cats[x.category] || 0) + Number(x.amount || 0));

  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  $("topCategory").textContent = top ? `${top[0]} (${money(top[1])})` : "—";

  const months = [...new Set(data.map(x => String(x.date).slice(0, 7)))]
    .filter(Boolean)
    .sort()
    .reverse();

  const currentMonth = $("monthFilter").value;
  $("monthFilter").innerHTML =
    '<option value="all">All months</option>' +
    months.map(m => `<option value="${m}">${m}</option>`).join("");

  $("monthFilter").value = months.includes(currentMonth) ? currentMonth : "all";
}

function showAppForUser(u) {
  user = u;
  $("authPanel").classList.add("hidden");
  $("appPanel").classList.remove("hidden");
  $("userEmail").textContent = u.email || "";
  $("userEmail").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  setStatus("Loading cloud...");
  listen();
}

function showLoggedOut() {
  user = null;
  data = [];
  $("authPanel").classList.remove("hidden");
  $("appPanel").classList.add("hidden");
  $("userEmail").classList.add("hidden");
  $("userEmail").textContent = "";
  $("logoutBtn").classList.add("hidden");

  if (unsubscribeTransactions) {
    unsubscribeTransactions();
    unsubscribeTransactions = null;
  }

  setStatus("Sign in to continue");
}

async function signInWithGoogle() {
  if (!auth) return;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    $("googleSignInBtn").disabled = true;
    $("googleSignInBtn").textContent = "Connecting to Google...";
    setAuthMessage("Choose your Google account...");

    // Popup is quick on desktop. Redirect fallback is used when popups are blocked.
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    setAuthMessage(friendlyAuthError(error), "error");
    $("googleSignInBtn").disabled = false;
    $("googleSignInBtn").innerHTML = '<span class="google-icon">G</span> Continue with Google';
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    setStatus("Logout failed");
  }
}

function listen() {
  if (!user) return;

  if (unsubscribeTransactions) {
    unsubscribeTransactions();
  }

  const q = query(
    collection(db, "users", user.uid, "transactions"),
    orderBy("date", "desc")
  );

  unsubscribeTransactions = onSnapshot(
    q,
    snap => {
      data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
      setStatus("Cloud synced ✓", true);
    },
    error => {
      console.error(error);
      setStatus("Sync error");
      setAuthMessage(error.message, "error");
    }
  );
}

async function addTransaction(event) {
  event.preventDefault();

  if (!user) {
    setAuthMessage("Please sign in first.", "error");
    return;
  }

  try {
    setStatus("Saving...");
    await addDoc(
      collection(db, "users", user.uid, "transactions"),
      {
        type: $("type").value,
        amount: Number($("amount").value),
        category: $("category").value,
        date: $("date").value,
        note: $("note").value.trim(),
        createdAt: Date.now()
      }
    );

    event.target.reset();
    $("date").value = today();
  } catch (error) {
    console.error(error);
    alert(error.message);
    setStatus("Save failed");
  }
}

async function removeTransaction(id) {
  if (!user || !confirm("Delete this transaction?")) return;

  try {
    await deleteDoc(doc(db, "users", user.uid, "transactions", id));
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

async function start() {
  if (!configured) {
    setStatus("Needs Firebase setup");
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    await setPersistence(auth, browserLocalPersistence);

    $("date").value = today();

    // Complete a previous mobile/browser redirect sign-in, if one exists.
    try {
      await getRedirectResult(auth);
    } catch (error) {
      console.error(error);
      setAuthMessage(friendlyAuthError(error), "error");
    }

    onAuthStateChanged(auth, currentUser => {
      if (currentUser) {
        showAppForUser(currentUser);
      } else {
        showLoggedOut();
      }
    });
  } catch (error) {
    console.error(error);
    setStatus("Connection error");
    setAuthMessage(error.message, "error");
  }
}

$("googleSignInBtn").addEventListener("click", signInWithGoogle);
$("logoutBtn").addEventListener("click", logout);
$("form").addEventListener("submit", addTransaction);
$("monthFilter").addEventListener("change", render);
$("typeFilter").addEventListener("change", render);

$("rows").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-id]");
  if (button) {
    removeTransaction(button.dataset.deleteId);
  }
});

start();
