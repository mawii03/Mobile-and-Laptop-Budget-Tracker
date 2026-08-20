import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
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
let authMode = "login";

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

function setAuthMode(mode) {
  authMode = mode;
  const login = mode === "login";

  $("showLoginBtn").classList.toggle("active", login);
  $("showRegisterBtn").classList.toggle("active", !login);
  $("authSubmitBtn").textContent = login ? "Log in" : "Create account";
  $("authPassword").autocomplete = login ? "current-password" : "new-password";
  $("resetPasswordBtn").classList.toggle("hidden", !login);
  setAuthMessage("");
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
  setStatus("Loading cloud...", false);
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

  setStatus("Not signed in");
  setAuthMode(authMode);
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/email-already-in-use": "That email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account was found for that email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase yet."
  };
  return map[code] || error?.message || "Something went wrong.";
}

async function submitAuth() {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  if (!email || !password) {
    setAuthMessage("Enter your email and password.", "error");
    return;
  }

  try {
    $("authSubmitBtn").disabled = true;
    setAuthMessage(authMode === "login" ? "Logging in..." : "Creating account...");

    if (authMode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
      setAuthMessage("Logged in.", "success");
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      setAuthMessage("Account created.", "success");
    }
  } catch (error) {
    console.error(error);
    setAuthMessage(friendlyAuthError(error), "error");
  } finally {
    $("authSubmitBtn").disabled = false;
  }
}

async function resetPassword() {
  const email = $("authEmail").value.trim();

  if (!email) {
    setAuthMessage("Enter your email first, then click Forgot password.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setAuthMessage("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    console.error(error);
    setAuthMessage(friendlyAuthError(error), "error");
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
    setAuthMessage("Please log in first.", "error");
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

    $("date").value = today();

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

$("showLoginBtn").addEventListener("click", () => setAuthMode("login"));
$("showRegisterBtn").addEventListener("click", () => setAuthMode("register"));
$("authForm").addEventListener("submit", event => {
  event.preventDefault();
  submitAuth();
});
$("resetPasswordBtn").addEventListener("click", resetPassword);
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

setAuthMode("login");
start();
