
const { DefaultAzureCredential } = require("@azure/identity");
const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_ENDPOINT;
const databaseId = "FinanceTrackerDB";
const containerId = "Transactions";

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const container = client.database(databaseId).container(containerId);

module.exports = async function (context, req) {
    const method = req.method;

    try {
        if (method === "POST") {
            // Add a new transaction
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
                type, // "income" or "expense"
                description: description || "",
                date: new Date().toISOString()
            };

            const { resource } = await container.items.create(transaction);

            context.res = {
                status: 201,
                body: resource
            };

        } else if (method === "GET") {
            // List transactions for a user
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