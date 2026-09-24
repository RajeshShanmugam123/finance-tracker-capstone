// ===== CONFIG =====
const msalConfig = {
  auth: {
    clientId: "6b646105-c238-43b1-b8e2-1a14308859fd",
    authority: "https://login.microsoftonline.com/867a92ee-eb81-4c9e-9cef-be7077837a05",
    redirectUri: window.location.origin + window.location.pathname
  }
};

const apiScope = "api://d8b8cba2-48d8-4331-8974-df5c0295faef/access_as_user";
const apiBaseUrl = "https://rs-finance-func-28873.azurewebsites.net/api";

const msalInstance = new msal.PublicClientApplication(msalConfig);
let currentAccount = null;

// ===== LOGIN =====
document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    const loginResponse = await msalInstance.loginPopup({ scopes: [apiScope] });
    currentAccount = loginResponse.account;
    showApp();
  } catch (err) {
    console.error("Login failed:", err);
    alert("Login failed: " + err.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  msalInstance.logoutPopup();
});

function showApp() {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("userName").textContent = currentAccount.username;
  loadTransactions();
}

// ===== GET ACCESS TOKEN =====
async function getToken() {
  const request = { scopes: [apiScope], account: currentAccount };
  try {
    const response = await msalInstance.acquireTokenSilent(request);
    return response.accessToken;
  } catch (err) {
    const response = await msalInstance.acquireTokenPopup(request);
    return response.accessToken;
  }
}

// ===== ADD TRANSACTION =====
document.getElementById("addBtn").addEventListener("click", async () => {
  const amount = document.getElementById("amount").value;
  const category = document.getElementById("category").value;
  const type = document.getElementById("type").value;
  const description = document.getElementById("description").value;

  if (!amount || !category) {
    alert("Please fill in amount and category");
    return;
  }

  const token = await getToken();
  const userId = currentAccount.username;

  await fetch(`${apiBaseUrl}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ userId, amount: Number(amount), category, type, description })
  });

  document.getElementById("amount").value = "";
  document.getElementById("category").value = "";
  document.getElementById("description").value = "";

  loadTransactions();
});

// ===== LOAD TRANSACTIONS =====
async function loadTransactions() {
  const token = await getToken();
  const userId = currentAccount.username;

  const res = await fetch(`${apiBaseUrl}/transactions/${encodeURIComponent(userId)}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const transactions = await res.json();

  const container = document.getElementById("transactions");
  container.innerHTML = "";

  transactions.forEach(txn => {
    const div = document.createElement("div");
    div.className = "txn";
        div.innerHTML = `
      <div>
        <div>${txn.category}${txn.description ? " · " + txn.description : ""}</div>
        <div class="txn-info">${new Date(txn.date).toLocaleDateString()}</div>
      </div>
      <div class="amount ${txn.type}">${txn.type === "expense" ? "-" : "+"}₹${txn.amount}</div>
    `;
    container.appendChild(div);
  });
}

// ===== CHECK IF ALREADY LOGGED IN ON PAGE LOAD =====
window.addEventListener("load", () => {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
    showApp();
  }
});