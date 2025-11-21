// controllers/braintreeController.js
const braintree = require("braintree");
const connection = require("../data/db");
const { storeInvoice } = require("./invoiceController");

// Configurazione Braintree
const gateway = new braintree.BraintreeGateway({
    environment:
        process.env.BRAINTREE_ENVIRONMENT === "production"
            ? braintree.Environment.Production
            : braintree.Environment.Sandbox,
    merchantId: process.env.BRAINTREE_MERCHANT_ID,
    publicKey: process.env.BRAINTREE_PUBLIC_KEY,
    privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

// GET /token
async function getToken(req, res) {
    try {
        const response = await gateway.clientToken.generate({});
        return res.json({ clientToken: response.clientToken });
    } catch (err) {
        console.error("Errore generazione clientToken:", err);
        return res.status(500).json({ error: "Errore generazione client token" });
    }
}

// POST /checkout
function checkout(req, res) {
    const {
        paymentMethodNonce,

        // dati per la fattura
        shipping_address,
        shipping_cap,
        shipping_city,
        shipping_description,
        billing_address,
        billing_cap,
        billing_city,
        billing_description,
        name,
        surname,
        phone,
        email,
        shipping_cost,
        items,
    } = req.body;

    if (!paymentMethodNonce) {
        return res.status(400).json({ error: "paymentMethodNonce mancante" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items mancante o vuoto" });
    }

    const productSlugs = items.map((it) => it.slug);
    const placeholders = productSlugs.map(() => "?").join(",");
    const sql = `SELECT id, slug, price FROM products WHERE slug IN (${placeholders})`;

    connection.query(sql, productSlugs, (err, rows) => {
        if (err) {
            console.error("Errore query prodotti:", err);
            return res.status(500).json({ error: "Errore recupero prodotti" });
        }

        if (rows.length !== productSlugs.length) {
            return res
                .status(400)
                .json({ error: "Alcuni prodotti non esistono nel database" });
        }

        const priceMap = {};
        rows.forEach((row) => {
            priceMap[row.slug] = Number(row.price);
        });

        let itemsTotal = 0;
        for (const it of items) {
            const price = priceMap[it.slug];
            const qty = Number(it.quantity || 0);

            if (!price || qty <= 0) {
                return res
                    .status(400)
                    .json({ error: "Dati items non validi (prezzo o quantità)" });
            }

            itemsTotal += price * qty;
        }

        const shipCost = Number(shipping_cost || 0);
        const totalAmount = itemsTotal + shipCost;

        console.log("Totale calcolato lato server:", totalAmount);

        gateway.transaction.sale(
            {
                amount: totalAmount.toFixed(2),
                paymentMethodNonce,
                options: {
                    submitForSettlement: true,
                },
            },
            (errBt, result) => {
                console.log("Braintree result.success:", result && result.success);
                console.log("Braintree status:", result?.transaction?.status);
                console.log("Processor response code:", result?.transaction?.processorResponseCode);
                console.log("Processor response text:", result?.transaction?.processorResponseText);
                if (errBt || !result.success) {
                    console.error("Pagamento Braintree fallito:", errBt || result);
                    return res.status(422).json({
                        success: false,
                        message: "Pagamento non completato",
                        error: errBt || { message: result.message },
                    });
                }

                const transactionId = result.transaction.id;

                // preparo il body per storeInvoice
                const newBody = {
                    shipping_address,
                    shipping_cap,
                    shipping_city,
                    shipping_description,
                    billing_address,
                    billing_cap,
                    billing_city,
                    billing_description,
                    name,
                    surname,
                    phone,
                    email,
                    shipping_cost,
                    items,
                    payment_provider: "braintree",
                    payment_transaction_id: transactionId,
                };

                const fakeReq = { ...req, body: newBody };

                // delego la creazione della fattura
                return storeInvoice(fakeReq, res);
            }
        );
    });
}

module.exports = {
    getToken,
    checkout,
};