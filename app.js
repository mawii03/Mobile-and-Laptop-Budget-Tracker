import {
  auth,
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
  updateProfile,
  userTransactionsRef,
  userSettingRef,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  doc,
  onSnapshot
} from "./firebase-app.js";

const $ = id => document.getElementById(id);

const hiddenBalances = JSON.parse(
  localStorage.getItem("lapmobHiddenBalances") || "{}"
);

let user = null;
let data = [];
let otherFundName = "Other";
let unsubscribe = null;

const defaultFunds = {
  cash: 0,
  bank: 0,
  savings: 0,
  emergency: 0,
  other: 0
};

function setSensitiveValue(id, value) {
  const element = $(id);
  if (!element) return;

  element.dataset.value = value;
  element.textContent = hiddenBalances[id] ? "••••••" : value;

  const eye = document.querySelector(`.eye-toggle[data-target="${id}"]`);
  if (eye) {
    eye.textContent = hiddenBalances[id] ? "👁‍🗨" : "👁";
    eye.setAttribute("aria-label", hiddenBalances[id] ? "Show amount" : "Hide amount");
    eye.setAttribute("title", hiddenBalances[id] ? "Show amount" : "Hide amount");
  }
}

function toggleBalance(id) {
  hiddenBalances[id] = !hiddenBalances[id];
  localStorage.setItem("lapmobHiddenBalances", JSON.stringify(hiddenBalances));
  const element = $(id);
  if (element) setSensitiveValue(id, element.dataset.value || element.textContent);
}

document.addEventListener("click", event => {
  const button = event.target.closest(".eye-toggle");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  toggleBalance(button.dataset.target);
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return "NT$" + Number(n || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function calculateFunds() {
  const funds = { ...defaultFunds };

  data.forEach(transaction => {
    const account = transaction.account;
    const amount = Number(transaction.amount);
    if (!(account in funds) || !Number.isFinite(amount) || amount < 0) return;

    if (transaction.type === "income") {
      funds[account] += amount;
    } else if (transaction.type === "expense" || transaction.type === "withdrawal") {
      funds[account] -= amount;
    }
  });

  return funds;
}

function renderFunds() {
  const funds = calculateFunds();

  setSensitiveValue("cashAmount", money(funds.cash));
  setSensitiveValue("bankAmount", money(funds.bank));
  setSensitiveValue("savingsAmount", money(funds.savings));
  setSensitiveValue("emergencyAmount", money(funds.emergency));
  setSensitiveValue("otherAmount", money(funds.other));

  if ($("otherFundName")) $("otherFundName").textContent = otherFundName;

  if ($("fundTotal")) {
    $("fundTotal").textContent = money(funds.cash + funds.bank);
  }
}

function renderGroup(containerId, rows, cssClass, sign, emptyText) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = rows.length
    ? rows.map(x => `
        <div class="transaction-row">
          <span>${esc(x.date)}</span>
          <span>${esc(x.category)}</span>
          <span>${esc(x.note || "—")}</span>
          <span class="amount ${cssClass}">
            ${sign}${money(x.amount)}
          </span>
          <span>
            <button class="row-delete" data-delete-id="${esc(x.id)}" type="button">
              Delete
            </button>
          </span>
        </div>
      `).join("")
    : `<div class="transaction-empty">${esc(emptyText)}</div>`;
}

function render() {
  const funds = calculateFunds();
  const cashTransactions = data.filter(x => x.account === "cash");

  const cashIncome = cashTransactions.filter(x => x.type === "income")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const cashExpenses = cashTransactions.filter(x => x.type === "expense")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const cashWithdrawals = cashTransactions.filter(x => x.type === "withdrawal")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  setSensitiveValue("balance", money(funds.cash + funds.bank));

  const inc = data.filter(x => x.type === "income")
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const exp = data.filter(x => x.type === "expense")
    .reduce((s, x) => s + Number(x.amount || 0), 0);

  setSensitiveValue("income", money(inc));
  setSensitiveValue("expenses", money(exp));
  if ($("count")) $("count").textContent = data.length;

  renderGroup("cashIncomeRows", cashIncome, "income", "+", "No cash income yet.");
  renderGroup("cashExpenseRows", cashExpenses, "expense", "-", "No cash expenses yet.");
  renderGroup("cashWithdrawalRows", cashWithdrawals, "withdrawal", "-", "No cash withdrawals yet.");

  if ($("cashIncomeTotal")) $("cashIncomeTotal").textContent = money(sum(cashIncome));
  if ($("cashExpenseTotal")) $("cashExpenseTotal").textContent = money(sum(cashExpenses));
  if ($("cashWithdrawalTotal")) $("cashWithdrawalTotal").textContent = money(sum(cashWithdrawals));

  const ym = today().slice(0, 7);
  if ($("monthSpend")) {
    $("monthSpend").textContent = money(
      data.filter(x => x.account === "cash" && x.type === "expense" && String(x.date).startsWith(ym))
        .reduce((s, x) => s + Number(x.amount || 0), 0)
    );
  }

  const cats = {};
  cashExpenses.forEach(x => {
    cats[x.category] = (cats[x.category] || 0) + Number(x.amount || 0);
  });
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  if ($("topCategory")) $("topCategory").textContent = top ? `${top[0]} (${money(top[1])})` : "—";
}

function sum(rows) {
  return rows.reduce((s, x) => s + Number(x.amount || 0), 0);
}

function setStatus(text, ok = false) {
  const status = document.querySelector(".status");
  if (status) {
    status.textContent = text;
    status.className = `status${ok ? " ok" : ""}`;
  }
}

function ensureAuthUI() {
  const area = document.querySelector(".account-area");
  if (!area) return;

  if (!document.getElementById("firebaseSignInBtn")) {
    const button = document.createElement("button");
    button.id = "firebaseSignInBtn";
    button.className = "secondary";
    button.type = "button";
    button.textContent = "Continue with Google";
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        button.textContent = "Connecting...";
        await signInWithGoogle();
      } catch (error) {
        console.error(error);
        alert(error.message || "Google sign-in failed.");
      } finally {
        button.disabled = false;
        button.textContent = "Continue with Google";
      }
    });
    area.prepend(button);
  }

  if (!document.getElementById("firebaseLogoutBtn")) {
    const button = document.createElement("button");
    button.id = "firebaseLogoutBtn";
    button.className = "secondary";
    button.type = "button";
    button.textContent = "Logout";
    button.style.display = "none";
    button.addEventListener("click", () => signOut(auth));
    area.appendChild(button);
  }

  if (!document.getElementById("firebaseUser")) {
    const span = document.createElement("span");
    span.id = "firebaseUser";
    span.className = "user-email";
    span.style.display = "none";
    area.appendChild(span);
  }
}

function setSignedInUI(u) {
  const signIn = $("firebaseSignInBtn");
  const logout = $("firebaseLogoutBtn");
  const userEl = $("firebaseUser");

  if (u) {
    if (signIn) signIn.style.display = "none";
    if (logout) logout.style.display = "";
    if (userEl) {
      userEl.style.display = "";
      userEl.textContent = u.displayName ? `${u.displayName} · ${u.email || ""}` : (u.email || "");
    }
    setStatus("Cloud synced ✓", true);
  } else {
    if (signIn) signIn.style.display = "";
    if (logout) logout.style.display = "none";
    if (userEl) userEl.style.display = "none";
    setStatus("Sign in to sync");
  }
}

function showCloudMessage(message) {
  let el = document.getElementById("firebaseMessage");
  if (!el) {
    el = document.createElement("div");
    el.id = "firebaseMessage";
    el.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;padding:10px 16px;border-radius:12px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,.12);font-size:13px;";
    document.body.appendChild(el);
  }
  el.textContent = message;
  clearTimeout(showCloudMessage.timer);
  showCloudMessage.timer = setTimeout(() => el.remove(), 2800);
}

async function loadOtherName() {
  if (!user) return;
  const snap = await getDoc(userSettingRef(user.uid, "profile"));
  otherFundName = snap.exists() ? (snap.data().otherName || "Other") : "Other";
  if ($("otherFundName")) $("otherFundName").textContent = otherFundName;
}

async function saveOtherName(name) {
  otherFundName = name;
  if (user) {
    await setDoc(userSettingRef(user.uid, "profile"), { otherName: name }, { merge: true });
  }
}

async function loadTransactions() {
  if (!user) return;

  if (unsubscribe) unsubscribe();

  const q = query(userTransactionsRef(user.uid), orderBy("date", "desc"));
  // A snapshot listener keeps the dashboard synced across tabs/devices.
  unsubscribe = onSnapshot(q, snap => {
      data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFunds();
      render();
      setStatus("Cloud synced ✓", true);
    }, error => {
      console.error(error);
      setStatus("Cloud sync error");
      showCloudMessage(error.message || "Could not load cloud data.");
    });
}

async function migrateLocalDataOnce() {
  if (!user) return;

  const markerRef = userSettingRef(user.uid, "migration");
  const marker = await getDoc(markerRef);
  if (marker.exists() && marker.data().localMigrated) return;

  const local = JSON.parse(localStorage.getItem("lapmobData") || "[]");
  if (!Array.isArray(local) || !local.length) {
    await setDoc(markerRef, { localMigrated: true, migratedAt: Date.now() }, { merge: true });
    return;
  }

  const existing = await getDocs(userTransactionsRef(user.uid));
  if (existing.empty) {
    for (const tx of local) {
      const { id, ...payload } = tx;
      await setDoc(
        doc(userTransactionsRef(user.uid), String(id || `${Date.now()}-${Math.random()}`)),
        { ...payload, migratedAt: Date.now() }
      );
    }
    showCloudMessage(`${local.length} local transaction(s) moved to Firebase.`);
  }

  await setDoc(markerRef, { localMigrated: true, migratedAt: Date.now() }, { merge: true });
}

async function addTransaction(event) {
  event.preventDefault();
  if (!user) {
    alert("Please sign in with Google first.");
    return;
  }

  const account = $("account").value;
  const type = $("type").value;
  const amount = Number($("amount").value);
  const date = $("date").value;

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }
  if (!date) {
    alert("Please select a date.");
    return;
  }

  try {
    await addDoc(userTransactionsRef(user.uid), {
      account,
      type,
      amount,
      category: $("category").value,
      date,
      note: $("note").value.trim(),
      createdAt: Date.now()
    });

    event.target.reset();
    $("date").value = today();
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not save transaction.");
  }
}

async function removeTransaction(id) {
  if (!user) return;
  if (!confirm("Delete this transaction?")) return;

  try {
    await deleteDoc(doc(userTransactionsRef(user.uid), String(id)));
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not delete transaction.");
  }
}

async function saveProfileName() {
  if (!user || !$("profileName")) return;
  const name = $("profileName").value.trim();
  if (!name) {
    alert("Please enter a name.");
    return;
  }

  try {
    await updateProfile(user, { displayName: name });
    if ($("firebaseUser")) $("firebaseUser").textContent = `${name} · ${user.email || ""}`;
    showCloudMessage("Profile saved to Firebase.");
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not save profile.");
  }
}

$("profileBtn")?.addEventListener("click", () => {
  if ($("profileName") && user) $("profileName").value = user.displayName || "";
  $("profileModal")?.classList.remove("hidden");
});

$("closeProfileBtn")?.addEventListener("click", () => $("profileModal")?.classList.add("hidden"));
$("cancelProfileBtn")?.addEventListener("click", () => $("profileModal")?.classList.add("hidden"));
$("saveProfileBtn")?.addEventListener("click", saveProfileName);

$("form")?.addEventListener("submit", addTransaction);
$("monthFilter")?.addEventListener("change", render);
$("typeFilter")?.addEventListener("change", render);

$("rows")?.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-id]");
  if (button) removeTransaction(button.dataset.deleteId);
});

$("editOtherNameBtn")?.addEventListener("click", async event => {
  event.preventDefault();
  event.stopPropagation();

  const newName = prompt("Enter a name for this account:", otherFundName);
  if (newName && newName.trim()) {
    try {
      await saveOtherName(newName.trim());
      renderFunds();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not save the account name.");
    }
  }
});

$("refreshFundsBtn")?.addEventListener("click", () => {
  renderFunds();
  render();
});

async function start() {
  ensureAuthUI();

  onAuthStateChanged(auth, async currentUser => {
    user = currentUser;
    setSignedInUI(user);

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!user) {
      data = [];
      otherFundName = "Other";
      renderFunds();
      render();
      return;
    }

    try {
      setStatus("Connecting to Firebase...");
      await migrateLocalDataOnce();
      await loadOtherName();
      await loadTransactions();
    } catch (error) {
      console.error(error);
      showCloudMessage(error.message || "Firebase connection failed.");
    }
  });

  if ($("date")) $("date").value = today();
  renderFunds();
  render();
}

start();
