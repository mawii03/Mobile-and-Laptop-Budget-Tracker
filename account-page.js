import {
  auth,
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
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
const accountKey = document.body.dataset.accountPage;

const hiddenBalances = JSON.parse(
  localStorage.getItem("lapmobHiddenBalances") || "{}"
);

let user = null;
let data = [];
let otherName = "Other";
let unsubscribe = null;

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

function money(n) {
  return "NT$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function setPageVisible(visible) {
  const container = document.querySelector(".container");
  if (container) container.style.display = visible ? "" : "none";
}

function showLoginPanel() {
  let panel = document.getElementById("firebaseAccountLogin");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "firebaseAccountLogin";
    panel.style.cssText = "min-height:100vh;display:flex;align-items:center;justify-content:center;padding:30px;box-sizing:border-box;background:linear-gradient(135deg,#f8f9ff,#fff);font-family:Inter,system-ui,sans-serif;";
    panel.innerHTML = `
      <div style="width:min(430px,100%);padding:32px;border-radius:22px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 18px 45px rgba(17,24,39,.10);text-align:center;">
        <div style="font-size:46px;margin-bottom:8px;">☁️</div>
        <h1 style="margin:0 0 8px;font-size:28px;color:#172143;">LapMob Budget Tracker</h1>
        <p style="margin:0 0 22px;color:#6b7280;">Sign in to access your account and cloud transactions.</p>
        <button id="accountGoogleSignIn" type="button" style="width:100%;padding:13px 18px;border-radius:12px;border:0;background:#2563eb;color:#fff;font-weight:800;cursor:pointer;">Continue with Google</button>
        <p id="accountAuthMessage" style="min-height:20px;margin:14px 0 0;color:#6b7280;font-size:13px;"></p>
      </div>`;
    document.body.appendChild(panel);

    panel.querySelector("#accountGoogleSignIn").addEventListener("click", async () => {
      const btn = panel.querySelector("#accountGoogleSignIn");
      const msg = panel.querySelector("#accountAuthMessage");
      try {
        btn.disabled = true;
        btn.textContent = "Connecting...";
        msg.textContent = "Choose your Google account...";
        await signInWithGoogle();
      } catch (error) {
        console.error(error);
        msg.textContent = error.message || "Google sign-in failed.";
        btn.disabled = false;
        btn.textContent = "Continue with Google";
      }
    });
  }
  panel.style.display = "flex";
}

function hideLoginPanel() {
  const panel = document.getElementById("firebaseAccountLogin");
  if (panel) panel.style.display = "none";
}

function calculateAccountBalance(account) {
  return data.reduce((balance, transaction) => {
    if (transaction.account !== account) return balance;
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount < 0) return balance;

    if (transaction.type === "income") return balance + amount;
    if (transaction.type === "expense" || transaction.type === "withdrawal") return balance - amount;
    return balance;
  }, 0);
}

function render() {
  const tx = data.filter(x => x.account === accountKey);
  const income = tx.filter(x => x.type === "income");
  const expenses = tx.filter(x => x.type === "expense");
  const withdrawals = tx.filter(x => x.type === "withdrawal");

  const sum = rows => rows.reduce((s, x) => s + Number(x.amount || 0), 0);

  setSensitiveValue("pageBalance", money(calculateAccountBalance(accountKey)));
  setSensitiveValue("pageIncome", money(sum(income)));
  setSensitiveValue("pageExpense", money(sum(expenses)));
  setSensitiveValue("pageWithdrawal", money(sum(withdrawals)));

  if ($("pageIncomeTotal")) $("pageIncomeTotal").textContent = money(sum(income));
  if ($("pageExpenseTotal")) $("pageExpenseTotal").textContent = money(sum(expenses));
  if ($("pageWithdrawalTotal")) $("pageWithdrawalTotal").textContent = money(sum(withdrawals));

  renderGroup("incomeRows", income, true);
  renderGroup("expenseRows", expenses, false);
  renderGroup("withdrawalRows", withdrawals, false);
}

function renderGroup(id, rows, positive) {
  const container = $(id);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<div class="transaction-empty">No transactions yet.</div>';
    return;
  }

  const sortedRows = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  container.innerHTML = sortedRows.map(x => {
    const amountClass = positive ? "income" : x.type === "withdrawal" ? "withdrawal" : "expense";
    const sign = positive ? "+" : "-";

    return `
      <div class="transaction-row">
        <span>${esc(x.date)}</span>
        <span>${esc(x.category)}</span>
        <span>${esc(x.note || "—")}</span>
        <span class="amount ${amountClass}">${sign}${money(x.amount)}</span>
        <span>
          <button class="row-delete" data-delete-id="${esc(x.id)}" type="button">Delete</button>
        </span>
      </div>`;
  }).join("");
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
  }

  await setDoc(markerRef, { localMigrated: true, migratedAt: Date.now() }, { merge: true });
}

async function loadOtherName() {
  if (!user) return;
  const snap = await getDoc(userSettingRef(user.uid, "profile"));
  otherName = snap.exists() ? (snap.data().otherName || "Other") : "Other";
}

async function saveOtherName(name) {
  otherName = name;
  await setDoc(userSettingRef(user.uid, "profile"), { otherName: name }, { merge: true });
}

async function loadTransactions() {
  if (!user) return;
  if (unsubscribe) unsubscribe();

  const q = query(userTransactionsRef(user.uid), orderBy("date", "desc"));
  unsubscribe = onSnapshot(q, snap => {
    data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, error => {
    console.error(error);
    alert(error.message || "Could not sync transactions.");
  });
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-delete-id]");
  if (!button || !user) return;

  event.preventDefault();
  event.stopPropagation();

  if (!confirm("Delete this transaction?")) return;

  try {
    await deleteDoc(doc(userTransactionsRef(user.uid), String(button.dataset.deleteId)));
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not delete transaction.");
  }
});

$("backBtn")?.addEventListener("click", () => {
  window.location.href = "index.html";
});

$("editOtherNameBtn")?.addEventListener("click", async event => {
  event.preventDefault();
  event.stopPropagation();

  const current = otherName || "Other";
  const newName = prompt("Enter a name for this account:", current);

  if (newName && newName.trim()) {
    try {
      await saveOtherName(newName.trim());
      location.reload();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not save account name.");
    }
  }
});

if (accountKey === "other") {
  $("editOtherNameBtn")?.classList.remove("hidden");
}

const transactionForm = $("accountTransactionForm");

if (transactionForm) {
  transactionForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!user) {
      alert("Please sign in with Google first.");
      return;
    }

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
        account: accountKey,
        type,
        amount,
        category: $("category").value,
        date,
        note: $("note").value.trim(),
        createdAt: Date.now()
      });

      event.target.reset();
      $("date").value = new Date().toISOString().slice(0, 10);
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not save transaction.");
    }
  });
}

if ($("date")) $("date").value = new Date().toISOString().slice(0, 10);

onAuthStateChanged(auth, async currentUser => {
  user = currentUser;

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  if (!user) {
    data = [];
    setPageVisible(false);
    showLoginPanel();
    return;
  }

  hideLoginPanel();
  setPageVisible(true);

  try {
    await migrateLocalDataOnce();
    await loadOtherName();
    await loadTransactions();
  } catch (error) {
    console.error(error);
    alert(error.message || "Firebase connection failed.");
  }
});
