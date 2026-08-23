const $ = id => document.getElementById(id);


/* =========================================
   BALANCE EYE
   ========================================= */

const hiddenBalances = JSON.parse(
  localStorage.getItem("lapmobHiddenBalances") || "{}"
);


function setSensitiveValue(id, value) {

  const element =
    $(id);


  if (!element) return;


  element.dataset.value =
    value;


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


  const element =
    $(id);


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
      event.target.closest(
        ".eye-toggle"
      );


    if (!button) return;


    event.preventDefault();
    event.stopPropagation();


    toggleBalance(
      button.dataset.target
    );

  }
);


/* =========================================
   ACCOUNT
   ========================================= */

const accountKey =
  document.body.dataset.accountPage;


/* =========================================
   LOAD DATA
   ========================================= */

function loadData() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          "lapmobData"
        ) ||
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
   SAVE DATA
   ========================================= */

function saveData(data) {

  localStorage.setItem(
    "lapmobData",
    JSON.stringify(data)
  );

}


/* =========================================
   HELPERS
   ========================================= */

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
   CALCULATE ACCOUNT BALANCE
   =========================================

   IMPORTANT:

   DO NOT write this balance into
   lapmobFunds.

   The account page only displays
   the balance based on transactions.
*/

function calculateAccountBalance(
  account,
  data
) {

  return data.reduce(
    (balance, transaction) => {

      if (
        transaction.account !==
        account
      ) {

        return balance;

      }


      const amount =
        Number(
          transaction.amount
        );


      if (
        !Number.isFinite(amount) ||
        amount < 0
      ) {

        return balance;

      }


      if (
        transaction.type ===
        "income"
      ) {

        return balance + amount;

      }


      if (
        transaction.type ===
          "expense" ||
        transaction.type ===
          "withdrawal"
      ) {

        return balance - amount;

      }


      return balance;

    },
    0
  );

}


/* =========================================
   RENDER
   ========================================= */

function render() {

  const data =
    loadData();


  const transactions =
    data.filter(
      x =>
        x.account ===
        accountKey
    );


  const income =
    transactions.filter(
      x =>
        x.type === "income"
    );


  const expenses =
    transactions.filter(
      x =>
        x.type === "expense"
    );


  const withdrawals =
    transactions.filter(
      x =>
        x.type === "withdrawal"
    );


  const sum =
    rows =>
      rows.reduce(
        (s, x) =>
          s +
          Number(x.amount || 0),
        0
      );


  /* CURRENT BALANCE */

  const balance =
    calculateAccountBalance(
      accountKey,
      data
    );


  setSensitiveValue(
    "pageBalance",
    money(balance)
  );


  /* INCOME */

  setSensitiveValue(
    "pageIncome",
    money(
      sum(income)
    )
  );


  /* EXPENSE */

  setSensitiveValue(
    "pageExpense",
    money(
      sum(expenses)
    )
  );


  /* WITHDRAWAL */

  setSensitiveValue(
    "pageWithdrawal",
    money(
      sum(withdrawals)
    )
  );


  /* TOTALS */

  if ($("pageIncomeTotal")) {

    $("pageIncomeTotal").textContent =
      money(
        sum(income)
      );

  }


  if ($("pageExpenseTotal")) {

    $("pageExpenseTotal").textContent =
      money(
        sum(expenses)
      );

  }


  if ($("pageWithdrawalTotal")) {

    $("pageWithdrawalTotal").textContent =
      money(
        sum(withdrawals)
      );

  }


  /* TRANSACTIONS */

  renderGroup(
    "incomeRows",
    income,
    true
  );


  renderGroup(
    "expenseRows",
    expenses,
    false
  );


  renderGroup(
    "withdrawalRows",
    withdrawals,
    false
  );

}


/* =========================================
   RENDER TRANSACTION GROUP
   ========================================= */

function renderGroup(
  id,
  rows,
  positive
) {

  const container =
    $(id);


  if (!container) return;


  if (!rows.length) {

    container.innerHTML =
      '<div class="transaction-empty">' +
      'No transactions yet.' +
      '</div>';

    return;

  }


  const sortedRows =
    [...rows].sort(
      (a, b) =>
        String(b.date)
          .localeCompare(
            String(a.date)
          )
    );


  container.innerHTML =
    sortedRows
      .map(
        x => {

          const amountClass =
            positive
              ? "income"
              : x.type ===
                "withdrawal"
                ? "withdrawal"
                : "expense";


          const sign =
            positive
              ? "+"
              : "-";


          return `

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

              <span
                class="amount ${amountClass}"
              >
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

          `;

        }
      )
      .join("");

}


/* =========================================
   DELETE TRANSACTION
   ========================================= */

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


    const data =
      loadData();


    const newData =
      data.filter(
        x =>
          String(x.id) !==
          id
      );


    /* Nothing changed */

    if (
      newData.length ===
      data.length
    ) {

      return;

    }


    /* SAVE */

    saveData(
      newData
    );


    /* REFRESH PAGE */

    render();

  }
);


/* =========================================
   BACK TO DASHBOARD
   ========================================= */

const backButton =
  $("backBtn");


if (backButton) {

  backButton.addEventListener(
    "click",
    () => {

      window.location.href =
        "index.html";

    }
  );

}


/* =========================================
   OTHER ACCOUNT NAME
   ========================================= */

const editOther =
  $("editOtherNameBtn");


if (editOther) {

  editOther.addEventListener(
    "click",
    () => {

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


        location.reload();

      }

    }
  );

}


if (
  accountKey ===
  "other"
) {

  editOther
    ?.classList
    .remove("hidden");

}


/* =========================================
   ADD TRANSACTION
   ========================================= */

const transactionForm =
  $("accountTransactionForm");


if (transactionForm) {

  transactionForm.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      const data =
        loadData();


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


      /* ADD */

      data.push({

        id:
          `${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`,

        account:
          accountKey,

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

      saveData(
        data
      );


      /* RESET */

      event.target.reset();


      if ($("date")) {

        $("date").value =
          new Date()
            .toISOString()
            .slice(0, 10);

      }


      /* REFRESH */

      render();

    }
  );

}


/* =========================================
   INITIAL DATE
   ========================================= */

if ($("date")) {

  $("date").value =
    new Date()
      .toISOString()
      .slice(0, 10);

}


/* =========================================
   INITIAL RENDER
   ========================================= */

render();