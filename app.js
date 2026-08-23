const $ = id => document.getElementById(id);


/* =========================================
   BALANCE EYE
   ========================================= */

const hiddenBalances = JSON.parse(
  localStorage.getItem("lapmobHiddenBalances") || "{}"
);

function setSensitiveValue(id, value) {

  const element = $(id);

  if (!element) return;

  element.dataset.value = value;

  element.textContent =
    hiddenBalances[id]
      ? "••••••"
      : value;

  const eye =
    document.querySelector(
      `.eye-toggle[data-target="${id}"]`
    );

  if (eye) {

    eye.textContent =
      hiddenBalances[id]
        ? "👁‍🗨"
        : "👁";

    eye.setAttribute(
      "aria-label",
      hiddenBalances[id]
        ? "Show amount"
        : "Hide amount"
    );

    eye.setAttribute(
      "title",
      hiddenBalances[id]
        ? "Show amount"
        : "Hide amount"
    );
  }
}


function toggleBalance(id) {

  hiddenBalances[id] =
    !hiddenBalances[id];

  localStorage.setItem(
    "lapmobHiddenBalances",
    JSON.stringify(hiddenBalances)
  );

  const element = $(id);

  if (element) {

    setSensitiveValue(
      id,
      element.dataset.value ||
      element.textContent
    );

  }
}


document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(".eye-toggle");

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    toggleBalance(
      button.dataset.target
    );

  }
);


/* =========================================
   DEFAULT DATA
   ========================================= */

const defaultFunds = {

  cash: 0,
  bank: 0,
  savings: 0,
  emergency: 0,
  other: 0

};


/* =========================================
   LOAD TRANSACTIONS
   ========================================= */

let data = loadData();


function loadData() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem("lapmobData") ||
        "[]"
      );

    return Array.isArray(saved)
      ? saved
      : [];

  } catch {

    return [];

  }

}


/* =========================================
   SAVE TRANSACTIONS
   ========================================= */

function saveData() {

  localStorage.setItem(
    "lapmobData",
    JSON.stringify(data)
  );

}


/* =========================================
   HELPERS
   ========================================= */

function today() {

  return new Date()
    .toISOString()
    .slice(0, 10);

}


function money(n) {

  return "NT$" +
    Number(n || 0).toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 0
      }
    );

}


function esc(s) {

  return String(s ?? "").replace(
    /[&<>"']/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c])
  );

}


/* =========================================
   CALCULATE ALL FUNDS
   =========================================

   IMPORTANT:

   Transactions are the source of truth.

   We calculate balances from lapmobData
   instead of repeatedly overwriting
   lapmobFunds whenever another page opens.
*/

function calculateFunds() {

  const funds = {
    ...defaultFunds
  };


  data.forEach(
    transaction => {

      const account =
        transaction.account;

      const amount =
        Number(transaction.amount);


      if (
        !(account in funds) ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {

        return;

      }


      if (
        transaction.type === "income"
      ) {

        funds[account] += amount;

      }


      else if (
        transaction.type === "expense" ||
        transaction.type === "withdrawal"
      ) {

        funds[account] -= amount;

      }

    }
  );


  return funds;

}


/* =========================================
   RENDER FUND CARDS
   ========================================= */

function renderFunds() {

  const funds =
    calculateFunds();


  setSensitiveValue(
    "cashAmount",
    money(funds.cash)
  );


  setSensitiveValue(
    "bankAmount",
    money(funds.bank)
  );


  setSensitiveValue(
    "savingsAmount",
    money(funds.savings)
  );


  setSensitiveValue(
    "emergencyAmount",
    money(funds.emergency)
  );


  setSensitiveValue(
    "otherAmount",
    money(funds.other)
  );


  if ($("otherFundName")) {

    $("otherFundName").textContent =
      localStorage.getItem(
        "lapmobOtherName"
      ) || "Other";

  }


  if ($("fundTotal")) {

    $("fundTotal").textContent =
      money(
        funds.cash +
        funds.bank
      );

  }

}


/* =========================================
   RENDER DASHBOARD
   ========================================= */

function render() {

  const funds =
    calculateFunds();


  /* CASH TRANSACTIONS */

  const cashTransactions =
    data.filter(
      x =>
        x.account === "cash"
    );


  const cashIncome =
    cashTransactions
      .filter(
        x =>
          x.type === "income"
      )
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
      );


  const cashExpenses =
    cashTransactions
      .filter(
        x =>
          x.type === "expense"
      )
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
      );


  const cashWithdrawals =
    cashTransactions
      .filter(
        x =>
          x.type === "withdrawal"
      )
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
      );


  /* DASHBOARD BALANCE */

  setSensitiveValue(
    "balance",
    money(
      funds.cash +
      funds.bank
    )
  );


  /* TOTAL INCOME */

  const inc =
    data
      .filter(
        x =>
          x.type === "income"
      )
      .reduce(
        (s, x) =>
          s +
          Number(x.amount || 0),
        0
      );


  /* TOTAL EXPENSES */

  const exp =
    data
      .filter(
        x =>
          x.type === "expense"
      )
      .reduce(
        (s, x) =>
          s +
          Number(x.amount || 0),
        0
      );


  setSensitiveValue(
    "income",
    money(inc)
  );


  setSensitiveValue(
    "expenses",
    money(exp)
  );


  /* TRANSACTION COUNT */

  if ($("count")) {

    $("count").textContent =
      data.length;

  }


  /* =========================================
     CASH INCOME
     ========================================= */

  renderGroup(
    "cashIncomeRows",
    cashIncome,
    "income",
    "+",
    "No cash income yet."
  );


  /* =========================================
     CASH EXPENSES
     ========================================= */

  renderGroup(
    "cashExpenseRows",
    cashExpenses,
    "expense",
    "-",
    "No cash expenses yet."
  );


  /* =========================================
     CASH WITHDRAWALS
     ========================================= */

  renderGroup(
    "cashWithdrawalRows",
    cashWithdrawals,
    "withdrawal",
    "-",
    "No cash withdrawals yet."
  );


  /* =========================================
     CASH TOTALS
     ========================================= */

  if ($("cashIncomeTotal")) {

    $("cashIncomeTotal").textContent =
      money(
        sum(cashIncome)
      );

  }


  if ($("cashExpenseTotal")) {

    $("cashExpenseTotal").textContent =
      money(
        sum(cashExpenses)
      );

  }


  if ($("cashWithdrawalTotal")) {

    $("cashWithdrawalTotal").textContent =
      money(
        sum(cashWithdrawals)
      );

  }


  /* =========================================
     THIS MONTH
     ========================================= */

  const ym =
    today().slice(0, 7);


  if ($("monthSpend")) {

    $("monthSpend").textContent =
      money(

        data
          .filter(
            x =>
              x.account === "cash" &&
              x.type === "expense" &&
              String(x.date)
                .startsWith(ym)
          )
          .reduce(
            (s, x) =>
              s +
              Number(x.amount || 0),
            0
          )

      );

  }


  /* =========================================
     TOP CATEGORY
     ========================================= */

  const cats = {};


  cashExpenses.forEach(
    x => {

      cats[x.category] =
        (cats[x.category] || 0) +
        Number(x.amount || 0);

    }
  );


  const top =
    Object.entries(cats)
      .sort(
        (a, b) =>
          b[1] - a[1]
      )[0];


  if ($("topCategory")) {

    $("topCategory").textContent =
      top
        ? `${top[0]} (${money(top[1])})`
        : "—";

  }

}


/* =========================================
   SUM
   ========================================= */

function sum(rows) {

  return rows.reduce(
    (s, x) =>
      s +
      Number(x.amount || 0),
    0
  );

}


/* =========================================
   RENDER TRANSACTION GROUP
   ========================================= */

function renderGroup(
  containerId,
  rows,
  cssClass,
  sign,
  emptyText
) {

  const container =
    $(containerId);


  if (!container) return;


  if (!rows.length) {

    container.innerHTML =
      `<div class="transaction-empty">
        ${esc(emptyText)}
      </div>`;

    return;

  }


  container.innerHTML =
    rows
      .map(
        x => `

          <div class="transaction-row">

            <span>
              ${esc(x.date)}
            </span>

            <span>
              ${esc(x.category)}
            </span>

            <span>
              ${esc(x.note || "—")}
            </span>

            <span class="amount ${cssClass}">
              ${sign}${money(x.amount)}
            </span>

            <span>

              <button
                class="row-delete"
                data-delete-id="${esc(x.id)}"
                type="button"
              >
                Delete
              </button>

            </span>

          </div>

        `
      )
      .join("");

}


/* =========================================
   DELETE TRANSACTION
   =========================================

   THIS IS THE PART THAT WAS MISSING
   FROM YOUR ORIGINAL app.js.
*/

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-delete-id]"
      );


    if (!button) return;


    event.preventDefault();
    event.stopPropagation();


    const id =
      String(
        button.dataset.deleteId
      );


    const before =
      data.length;


    data =
      data.filter(
        x =>
          String(x.id) !== id
      );


    if (
      data.length === before
    ) {

      return;

    }


    saveData();


    renderFunds();

    render();

  }
);


/* =========================================
   ADD TRANSACTION
   ========================================= */

const form =
  $("form");


if (form) {

  form.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      const account =
        $("account").value;


      const type =
        $("type").value;


      const amount =
        Number(
          $("amount").value
        );


      const date =
        $("date").value;


      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        alert(
          "Please enter a valid amount."
        );

        return;

      }


      if (!date) {

        alert(
          "Please select a date."
        );

        return;

      }


      /* CREATE TRANSACTION */

      data.push({

        id:
          `${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`,

        account:
          account,

        type:
          type,

        amount:
          amount,

        category:
          $("category").value,

        date:
          date,

        note:
          $("note")
            .value
            .trim()

      });


      /* SAVE */

      saveData();


      /* RESET FORM */

      form.reset();


      if ($("date")) {

        $("date").value =
          today();

      }


      /* REFRESH */

      renderFunds();

      render();

    }
  );

}


/* =========================================
   INITIAL DATE
   ========================================= */

if ($("date")) {

  $("date").value =
    today();

}


/* =========================================
   FILTERS
   ========================================= */

$("monthFilter")
  ?.addEventListener(
    "change",
    render
  );


$("typeFilter")
  ?.addEventListener(
    "change",
    render
  );


/* =========================================
   OTHER ACCOUNT NAME
   ========================================= */

$("editOtherNameBtn")
  ?.addEventListener(
    "click",
    event => {

      event.preventDefault();
      event.stopPropagation();


      const current =
        localStorage.getItem(
          "lapmobOtherName"
        ) ||
        "Other";


      const newName =
        prompt(
          "Enter a name for this account:",
          current
        );


      if (
        newName &&
        newName.trim()
      ) {

        localStorage.setItem(
          "lapmobOtherName",
          newName.trim()
        );


        renderFunds();

      }

    }
  );


/* =========================================
   INITIAL RENDER
   ========================================= */

renderFunds();

render();