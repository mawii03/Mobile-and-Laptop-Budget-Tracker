import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = !Object.values(firebaseConfig).some(v => v.includes("PASTE_YOUR"));
let app, auth, db, user, data = [];
const $ = id => document.getElementById(id);
$("date").value = new Date().toISOString().slice(0, 10);

function money(n) { return "NT$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }) }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])) }
function setStatus(text, ok = false) { $("status").textContent = text; $("status").className = "status" + (ok ? " ok" : "") }

function render() {
  const type = $("typeFilter").value, month = $("monthFilter").value;
  const filtered = data.filter(x => (type === "all" || x.type === type) && (month === "all" || x.date.startsWith(month))).sort((a, b) => b.date.localeCompare(a.date));
  const inc = data.filter(x => x.type === "income").reduce((s, x) => s + x.amount, 0), exp = data.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  $("income").textContent = money(inc); $("expenses").textContent = money(exp); $("balance").textContent = money(inc - exp); $("count").textContent = data.length;
  $("rows").innerHTML = filtered.map(x => `<tr><td>${x.date}</td><td class="${x.type === "income" ? "income" : "expense"}">${x.type === "income" ? "Income" : "Expense"}</td><td>${esc(x.category)}</td><td>${esc(x.note || "—")}</td><td>${x.type === "income" ? "+" : "-"}${money(x.amount)}</td><td><button class="delete" onclick="removeTx('${x.id}')">Delete</button></td></tr>`).join("");
  $("empty").style.display = filtered.length ? "none" : "block";
  const ym = new Date().toISOString().slice(0, 7); $("monthSpend").textContent = money(data.filter(x => x.type === "expense" && x.date.startsWith(ym)).reduce((s, x) => s + x.amount, 0));
  const cats = {}; data.filter(x => x.type === "expense").forEach(x => cats[x.category] = (cats[x.category] || 0) + x.amount);
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]; $("topCategory").textContent = top ? `${top[0]} (${money(top[1])})` : "—";
  const months = [...new Set(data.map(x => x.date.slice(0, 7)))].sort().reverse(); $("monthFilter").innerHTML = '<option value="all">All months</option>' + months.map(m => `<option value="${m}">${m}</option>`).join("");
}

async function start() {
  if (!configured) { setStatus("Needs Firebase setup"); return }
  try {
    app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app);
    onAuthStateChanged(auth, u => { if (u) { user = u; listen(); } });
    await signInAnonymously(auth);
  } catch (e) { console.error(e); setStatus("Connection error"); alert("Firebase setup/error: " + e.message) }
}
window.signIn = () => { if (configured) start() };

function listen() {
  const q = query(collection(db, "users", user.uid, "transactions"), orderBy("date", "desc"));
  onSnapshot(q, snap => { data = snap.docs.map(d => ({ id: d.id, ...d.data() })); render(); setStatus("Cloud synced ✓", true) }, e => { console.error(e); setStatus("Sync error"); });
}
$("form").addEventListener("submit", async e => {
  e.preventDefault(); if (!user) { alert("Connect Firebase first."); return }
  try {
    setStatus("Saving...");
    await addDoc(collection(db, "users", user.uid, "transactions"), { type: $("type").value, amount: Number($("amount").value), category: $("category").value, date: $("date").value, note: $("note").value.trim(), createdAt: Date.now() });
    e.target.reset(); $("date").value = new Date().toISOString().slice(0, 10);
  } catch (err) { alert(err.message); setStatus("Save failed") }
});
window.removeTx = async id => { if (!user || !confirm("Delete this transaction?")) return; try { await deleteDoc(doc(db, "users", user.uid, "transactions", id)) } catch (e) { alert(e.message) } };
start();
