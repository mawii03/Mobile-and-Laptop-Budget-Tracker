import {
  auth, db, onAuthStateChanged, collection, doc, addDoc, deleteDoc,
  query, orderBy, onSnapshot, getDoc, setDoc
} from "./firebase-app.js";

const $ = id => document.getElementById(id);
const accountKey = document.body.dataset.accountPage;
const hiddenBalances = JSON.parse(localStorage.getItem("lapmobHiddenBalances") || "{}");
let user = null;
let data = [];
let unsubscribe = null;

function money(n){return "NT$"+Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0});}
function today(){return new Date().toISOString().slice(0,10);}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function setSensitiveValue(id,value){
  const el=$(id); if(!el)return;
  el.dataset.value=value; el.textContent=hiddenBalances[id]?"••••••":value;
  const eye=document.querySelector(`.eye-toggle[data-target="${id}"]`);
  if(eye)eye.textContent=hiddenBalances[id]?"👁‍🗨":"👁";
}
document.addEventListener("click",e=>{
  const eye=e.target.closest(".eye-toggle"); if(!eye)return;
  e.preventDefault();e.stopPropagation();
  const id=eye.dataset.target;hiddenBalances[id]=!hiddenBalances[id];
  localStorage.setItem("lapmobHiddenBalances",JSON.stringify(hiddenBalances));
  setSensitiveValue(id,$(id)?.dataset.value||"NT$0");
});
function render(){
  const tx=data.filter(x=>x.account===accountKey);
  const income=tx.filter(x=>x.type==="income"), expense=tx.filter(x=>x.type==="expense"), withdrawal=tx.filter(x=>x.type==="withdrawal");
  const sum=a=>a.reduce((s,x)=>s+Number(x.amount||0),0);
  const balance=sum(income)-sum(expense)-sum(withdrawal);
  setSensitiveValue("pageBalance",money(balance));
  setSensitiveValue("pageIncome",money(sum(income)));
  setSensitiveValue("pageExpense",money(sum(expense)));
  setSensitiveValue("pageWithdrawal",money(sum(withdrawal)));
  if($("pageIncomeTotal"))$("pageIncomeTotal").textContent=money(sum(income));
  if($("pageExpenseTotal"))$("pageExpenseTotal").textContent=money(sum(expense));
  if($("pageWithdrawalTotal"))$("pageWithdrawalTotal").textContent=money(sum(withdrawal));
  renderGroup("incomeRows",income,"income","+");
  renderGroup("expenseRows",expense,"expense","-");
  renderGroup("withdrawalRows",withdrawal,"withdrawal","-");
}
function renderGroup(id,rows,cls,sign){
  const el=$(id);if(!el)return;
  rows=[...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(!rows.length){el.innerHTML='<div class="transaction-empty">No transactions yet.</div>';return;}
  el.innerHTML=rows.map(x=>`<div class="transaction-row"><span>${esc(x.date)}</span><span>${esc(x.category)}</span><span>${esc(x.note||"—")}</span><span class="amount ${cls}">${sign}${money(x.amount)}</span><span><button class="row-delete" type="button" data-delete-id="${esc(x.id)}">Delete</button></span></div>`).join("");
}
async function addTransaction(e){
  e.preventDefault();
  if(!user)return alert("Please sign in first.");
  const amount=Number($("amount").value),date=$("date").value;
  if(!Number.isFinite(amount)||amount<=0||!date)return alert("Please enter a valid amount and date.");
  await addDoc(collection(db,"users",user.uid,"transactions"),{
    account:accountKey,type:$("type").value,amount,category:$("category").value,
    date,note:$("note").value.trim(),createdAt:Date.now()
  });
  e.target.reset();$("date").value=today();
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-delete-id]");if(!b||!user)return;
  e.preventDefault();e.stopPropagation();
  if(confirm("Delete this transaction?"))await deleteDoc(doc(db,"users",user.uid,"transactions",b.dataset.deleteId));
});
$("backBtn")?.addEventListener("click",()=>location.href="index.html");
$("accountTransactionForm")?.addEventListener("submit",addTransaction);
$("date")?.setAttribute("value",today());
if($("date"))$("date").value=today();

if(accountKey==="other"){
  $("editOtherNameBtn")?.classList.remove("hidden");
  $("editOtherNameBtn")?.addEventListener("click",async()=>{
    const current=localStorage.getItem("lapmobOtherName")||"Other";
    const name=prompt("Enter a name for this account:",current);
    if(!name?.trim()||!user)return;
    localStorage.setItem("lapmobOtherName",name.trim());
    await setDoc(doc(db,"users",user.uid,"settings","otherName"),{name:name.trim()},{merge:true});
  });
}
onAuthStateChanged(auth,u=>{
  user=u;
  if(unsubscribe)unsubscribe();
  if(!u){data=[];render();return;}
  const q=query(collection(db,"users",u.uid,"transactions"),orderBy("date","desc"));
  unsubscribe=onSnapshot(q,snap=>{
    data=snap.docs.map(d=>({id:d.id,...d.data()}));render();
  },err=>{console.error(err);alert("Firestore error: "+err.message);});
});
