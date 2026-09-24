const { DefaultAzureCredential } = require("@azure/identity");
const { CosmosClient } = require("@azure/cosmos");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const endpoint = process.env.COSMOS_ENDPOINT;
const databaseId = "FinanceTrackerDB";
const containerId = "Transactions";

const TENANT_ID = "867a92ee-eb81-4c9e-9cef-be7077837a05";
const BACKEND_APP_ID = "d8b8cba2-48d8-4331-8974-df5c0295faef";

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const container = client.database(databaseId).container(containerId);

const jwksClientInstance = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`
});

function getSigningKey(header, callback) {
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function validateToken(authHeader) {
  return new Promise((resolve, reject) => {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reject(new Error("Missing or invalid Authorization header"));
    }
    const token = authHeader.substring(7);

    jwt.verify(token, getSigningKey, {
      audience: `api://${BACKEND_APP_ID}`,
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

module.exports = async function (context, req) {
  const method = req.method;

  // Validate token first, before doing anything else
  try {
    await validateToken(req.headers["authorization"]);
  } catch (err) {
    context.log.error("Token validation failed:", err.message);
    context.res = {
      status: 401,
      body: { error: "Unauthorized: " + err.message }
    };
    return;
  }

  try {
    if (method === "POST") {
      const { userId, amount, category, type, description } = req.body;

      if (!userId || !amount || !category || !type) {
        context.res = {
          status: 400,
          body: { error: "userId, amount, category, and type are required" }
        };
        return;
      }

      const transaction = {
        id: `${userId}-${Date.now()}`,
        userId,
        amount,
        category,
        type,
        description: description || "",
        date: new Date().toISOString()
      };

      const { resource } = await container.items.create(transaction);

      context.res = {
        status: 201,
        body: resource
      };

    } else if (method === "GET") {
      const userId = context.bindingData.userId || req.query.userId;

      if (!userId) {
        context.res = {
          status: 400,
          body: { error: "userId is required" }
        };
        return;
      }

      const querySpec = {
        query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.date DESC",
        parameters: [{ name: "@userId", value: userId }]
      };

      const { resources } = await container.items.query(querySpec).fetchAll();

      context.res = {
        status: 200,
        body: resources
      };

    } else {
      context.res = {
        status: 405,
        body: { error: "Method not allowed" }
      };
    }
  } catch (err) {
    context.log.error(err);
    context.res = {
      status: 500,
      body: { error: err.message }
    };
  }
};