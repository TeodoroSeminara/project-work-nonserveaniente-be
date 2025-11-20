// routers/braintreeRouter.js
const express = require("express");
const router = express.Router();
const braintree = require("braintree");

const connection = require("../data/db");
const { storeInvoice } = require("../controllers/invoiceController");

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

// GET /token per la Drop-in UI
router.get("/token", async (req, res) => {
  try {
    const response = await gateway.clientToken.generate({});
    return res.json({ clientToken: response.clientToken });
  } catch (err) {
    console.error("Errore generazione clientToken:", err);
    return res.status(500).json({ error: "Errore generazione client token" });
  }
});

// POST /checkout: calcola totale, paga con braintree e poi crea la fattura
router.post("/checkout", (req, res) => {
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

  // VALIDAZIONI MINIME
  if (!paymentMethodNonce) {
    return res.status(400).json({ error: "paymentMethodNonce mancante" });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items mancante o vuoto" });
  }

  // ✅ CORRETTO: usa slug invece di product_id
  const productSlugs = items.map((it) => it.slug);

  // recupero prezzi dal DB usando slug
  const placeholders = productSlugs.map(() => "?").join(",");
  const sql = `SELECT id, slug, price FROM products WHERE slug IN (${placeholders})`;

  connection.query(sql, productSlugs, (err, rows) => {
    if (err) {
      console.error("Errore query prodotti:", err);
      return res.status(500).json({ error: "Errore recupero prodotti" });
    }

    // ✅ CORRETTO: confronta con productSlugs
    if (rows.length !== productSlugs.length) {
      return res
        .status(400)
        .json({ error: "Alcuni prodotti non esistono nel database" });
    }

    // ✅ CORRETTO: mappa slug -> price
    const priceMap = {};
    rows.forEach((row) => {
      priceMap[row.slug] = Number(row.price);
    });

    // calcolo totale items
    let itemsTotal = 0;
    for (const it of items) {
      // ✅ CORRETTO: usa slug per il lookup
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

    // ora pago con Braintree usando il totale calcolato
    gateway.transaction.sale(
      {
        amount: totalAmount.toFixed(2),
        paymentMethodNonce,
        options: {
          submitForSettlement: true,
        },
      },
      (errBt, result) => {
        if (errBt || !result.success) {
          console.error("Pagamento Braintree fallito:", errBt || result);
          return res.status(422).json({
            success: false,
            message: "Pagamento non completato",
            error: errBt || result,
          });
        }

        // pagamento ok
        const transactionId = result.transaction.id;

        req.body = {
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

        // delego la creazione della fattura a storeInvoice
        return storeInvoice(req, res);
      }
    );
  });
});

module.exports = router;