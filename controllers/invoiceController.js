const connection = require('../data/db');
const {
    sendOrderConfirmationToCustomer,
    sendOrderNotificationToStore,
} = require('../utils/mailer');

// helper per order_number
function generateOrderNumber() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePart =
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
    const randPart = Math.floor(Math.random() * 1000);
    return `ORD-${datePart}-${timePart}-${randPart}`;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// INDEX – tutte le fatture (solo intestazione, senza righe)
function index(req, res) {
    const sql = `
    SELECT *
    FROM invoices
    ORDER BY created_at DESC
  `;
    connection.query(sql, (err, result) => {
        if (err) return res.status(500).json({ error: "Errore nel recupero delle fatture" });
        return res.json(result);
    });
}

// SHOW – fattura + righe prodotto
function show(req, res) {
    const invoiceId = req.params.id;

    const invoiceSql = `SELECT * FROM invoices WHERE id = ?`;
    connection.query(invoiceSql, [invoiceId], (errInv, invRows) => {
        if (errInv) {
            return res.status(500).json({ error: "Errore nel recupero della fattura" });
        }

        if (invRows.length === 0) {
            return res.status(404).json({ error: "Fattura non trovata" });
        }

        const invoice = invRows[0];

        const itemsSql = `
      SELECT *
      FROM product_invoice
      WHERE invoice_id = ?
      ORDER BY id ASC
    `;

        connection.query(itemsSql, [invoiceId], (errItems, itemsRows) => {
            if (errItems) {
                return res.status(500).json({ error: "Errore nel recupero delle righe fattura" });
            }

            return res.json({
                invoice,
                items: itemsRows,
            });
        });
    });
}

// STORE – crea fattura + righe product_invoice
function storeInvoice(req, res) {
    const {
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
        /* status, */
        items,
        payment_provider,
        payment_transaction_id
    } = req.body;

    // validazioni base
    if (!shipping_address || !shipping_cap || !shipping_city) {
        return res.status(400).json({ error: "shipping_address, shipping_cap e shipping_city sono obbligatori" });
    }
    if (!name || !surname || !phone || !email) {
        return res.status(400).json({ error: "name, surname, phone ed email sono obbligatori" });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "L'email inserita non è valida" });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Devi specificare almeno una riga nella fattura (items)" });
    }

    const shipCost = Number(shipping_cost || 0);
    if (isNaN(shipCost) || shipCost < 0) {
        return res.status(400).json({ error: "shipping_cost non valido" });
    }

    if (items.some(it => !it.product_id || !it.quantity)) {
        return res.status(400).json({ error: "Ogni elemento di items deve avere product_id e quantity" });
    }

    const productIds = items.map(it => it.product_id);
    //const invoiceStatus = status || 'pending';
    const order_number = generateOrderNumber();
    console.log('order_number che sto generando:', order_number);

    // transazione
    connection.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: "Errore nell'avvio della transazione" });
        }

        // 1) recupero prodotti per prezzi/nome
        const productsSql = `
      SELECT id, name, price
      FROM products
      WHERE id IN (?)
    `;

        connection.query(productsSql, [productIds], (errProd, prodRows) => {
            if (errProd) {
                return connection.rollback(() => {
                    res.status(500).json({ error: "Errore nel recupero dei prodotti" });
                });
            }

            if (!prodRows || prodRows.length !== productIds.length) {
                return connection.rollback(() => {
                    res.status(400).json({ error: "Uno o più product_id negli items non esistono" });
                });
            }

            const productMap = {};
            prodRows.forEach(p => {
                productMap[p.id] = p;
            });

            // 2) prepariamo righe product_invoice e totale
            let totalItems = 0;
            const lines = [];

            for (const it of items) {
                const p = productMap[it.product_id];
                const qty = Number(it.quantity);
                if (!p) {
                    return connection.rollback(() => {
                        res.status(400).json({ error: `Prodotto con id ${it.product_id} non trovato` });
                    });
                }
                if (isNaN(qty) || qty <= 0) {
                    return connection.rollback(() => {
                        res.status(400).json({ error: "quantity deve essere un numero positivo" });
                    });
                }

                const unit_price = Number(p.price);
                const price_for_quantity = qty * unit_price;
                totalItems += price_for_quantity;

                lines.push({
                    product_id: p.id,
                    name_product: p.name,
                    quantity: qty,
                    unit_price,
                    price_for_quantity,
                });
            }

            const total_amount = (totalItems + shipCost).toFixed(2);

            // 3) inseriamo la fattura
            const invSql = `
        INSERT INTO invoices (
          order_number,
          total_amount,
          shipping_cost,
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
          payment_provider,
          payment_transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
      `; //eliminato status il giorno 20/11/2025

            const invParams = [
                order_number,
                total_amount,
                shipCost,
                /* invoiceStatus, */
                shipping_address,
                shipping_cap,
                shipping_city,
                shipping_description || null,
                billing_address || null,
                billing_cap || null,
                billing_city || null,
                billing_description || null,
                name,
                surname,
                phone,
                email,
                payment_provider || null,
                payment_transaction_id || null,
            ];

            connection.query(invSql, invParams, (errInv, invResult) => {
                if (errInv) {
                    console.error("ERRORE INSERT fattura:", errInv);
                    console.log("PARAMETRI PASSATI ALL'INSERT:", invParams);
                    return connection.rollback(() => {
                        res.status(500).json({
                            error: "Errore nella creazione della fattura",
                            details: errInv.sqlMessage,
                        });
                    });
                }

                const invoiceId = invResult.insertId;

                // 4) inseriamo le righe in product_invoice
                const values = lines.map(l => [
                    invoiceId,
                    l.product_id,
                    l.quantity,
                    l.unit_price,
                    l.price_for_quantity.toFixed(2),
                    l.name_product,
                ]);

                const linesSql = `
          INSERT INTO product_invoice (
            invoice_id,
            product_id,
            quantity,
            unit_price,
            price_for_quantity,
            name_product
          ) VALUES ?
        `;

                connection.query(linesSql, [values], (errLines) => {
                    if (errLines) {
                        return connection.rollback(() => {
                            res.status(500).json({ error: "Errore nell'inserimento delle righe fattura" });
                        });
                    }

                    connection.commit(errCommit => {
                        if (errCommit) {
                            return connection.rollback(() => {
                                res.status(500).json({ error: "Errore nel commit della transazione" });
                            });
                        }

                        // prepariamo i dati della mail
                        const invoiceForEmail = {
                            id: invoiceId,
                            order_number,
                            total_amount,
                            shipping_cost: shipCost.toFixed(2),
                            //status: invoiceStatus,
                            shipping_address,
                            shipping_cap,
                            shipping_city,
                            shipping_description: shipping_description || null,
                            billing_address: billing_address || null,
                            billing_cap: billing_cap || null,
                            billing_city: billing_city || null,
                            billing_description: billing_description || null,
                            name,
                            surname,
                            phone,
                            email,
                            created_at: new Date(),
                        };

                        const itemsForEmail = lines.map(l => ({
                            product_id: l.product_id,
                            name_product: l.name_product,
                            quantity: l.quantity,
                            unit_price: l.unit_price,
                            price_for_quantity: l.price_for_quantity,
                        }));

                        sendOrderConfirmationToCustomer(invoiceForEmail, itemsForEmail)
                            .catch(err => console.error("Errore invio mail al cliente:", err));

                        sendOrderNotificationToStore(invoiceForEmail, itemsForEmail)
                            .catch(err => console.error("Errore invio mail allo store:", err));

                        return res.status(201).json({
                            success: true,
                            message: "Fattura creata correttamente",
                            invoice: {
                                id: invoiceId,
                                order_number,
                                total_amount,
                                shipping_cost: shipCost.toFixed(2),
                                //status: invoiceStatus,
                                name,
                                surname,
                                email,
                            },
                            items: lines.map(l => ({
                                product_id: l.product_id,
                                name_product: l.name_product,
                                quantity: l.quantity,
                                unit_price: l.unit_price.toFixed(2),
                                price_for_quantity: l.price_for_quantity.toFixed(2),
                            })),
                        });
                    });
                });
            });
        });
    });
}

// UPDATE – aggiorna fattura + righe (sostituisce completamente le righe)
function updateInvoice(req, res) {
    const invoiceId = req.params.id;
    const {
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
        //status,
        items,
    } = req.body;

    if (!shipping_address || !shipping_cap || !shipping_city) {
        return res.status(400).json({ error: "shipping_address, shipping_cap e shipping_city sono obbligatori" });
    }
    if (!name || !surname || !phone || !email) {
        return res.status(400).json({ error: "name, surname, phone ed email sono obbligatori" });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "L'email inserita non è valida" });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Devi specificare almeno una riga nella fattura (items)" });
    }

    const shipCost = Number(shipping_cost || 0);
    if (isNaN(shipCost) || shipCost < 0) {
        return res.status(400).json({ error: "Costo spedizione non valido" });
    }

    if (items.some(it => !it.product_id)) {
        return res.status(400).json({ error: "Non c'è nessun prodotto" });
    }
    if (items.some(it => !it.quantity)) {
        return res.status(400).json({ error: "La quantità deve essere superiore a 0" });
    }

    const productIds = items.map(it => it.product_id);
    //const invoiceStatus = status || 'pending';

    connection.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: "Errore nell'avvio della transazione" });
        }

        // controlliamo che la fattura esista
        connection.query(
            'SELECT id FROM invoices WHERE id = ?',
            [invoiceId],
            (errCheck, rowsCheck) => {
                if (errCheck) {
                    return connection.rollback(() => {
                        res.status(500).json({ error: "Errore nel controllo della fattura" });
                    });
                }
                if (rowsCheck.length === 0) {
                    return connection.rollback(() => {
                        res.status(404).json({ error: "Fattura non trovata" });
                    });
                }

                // 1) recupero prodotti
                const productsSql = `
          SELECT id, name, price
          FROM products
          WHERE id IN (?)`;

                connection.query(productsSql, [productIds], (errProd, prodRows) => {
                    if (errProd) {
                        return connection.rollback(() => {
                            res.status(500).json({ error: "Errore nel recupero dei prodotti" });
                        });
                    }

                    if (!prodRows || prodRows.length !== productIds.length) {
                        return connection.rollback(() => {
                            res.status(400).json({ error: "Uno o più product_id negli items non esistono" });
                        });
                    }

                    const productMap = {};
                    prodRows.forEach(p => {
                        productMap[p.id] = p;
                    });

                    let totalItems = 0;
                    const lines = [];

                    for (const it of items) {
                        const p = productMap[it.product_id];
                        const qty = Number(it.quantity);
                        if (!p) {
                            return connection.rollback(() => {
                                res.status(400).json({ error: `Prodotto con id ${it.product_id} non trovato` });
                            });
                        }
                        if (isNaN(qty) || qty <= 0) {
                            return connection.rollback(() => {
                                res.status(400).json({ error: "quantity deve essere un numero positivo" });
                            });
                        }

                        const unit_price = Number(p.price);
                        const price_for_quantity = qty * unit_price;
                        totalItems += price_for_quantity;

                        lines.push({
                            product_id: p.id,
                            name_product: p.name,
                            quantity: qty,
                            unit_price,
                            price_for_quantity,
                        });
                    }

                    const total_amount = (totalItems + shipCost).toFixed(2);

                    // 2) aggiorniamo la fattura
                    const invSql = `
            UPDATE invoices
            SET
              total_amount = ?,
              shipping_cost = ?,
              shipping_address = ?,
              shipping_cap = ?,
              shipping_city = ?,
              shipping_description = ?,
              billing_address = ?,
              billing_cap = ?,
              billing_city = ?,
              billing_description = ?,
              name = ?,
              surname = ?,
              phone = ?,
              email = ?
            WHERE id = ?          `;

                    const invParams = [
                        total_amount,
                        shipCost,
                        //invoiceStatus,
                        shipping_address,
                        shipping_cap,
                        shipping_city,
                        shipping_description || null,
                        billing_address || null,
                        billing_cap || null,
                        billing_city || null,
                        billing_description || null,
                        name,
                        surname,
                        phone,
                        email,
                        invoiceId,
                    ];

                    connection.query(invSql, invParams, (errInv) => {
                        if (errInv) {
                            return connection.rollback(() => {
                                res.status(500).json({ error: "Errore nell'aggiornamento della fattura" });
                            });
                        }

                        // 3) cancelliamo le righe attuali e reinseriamo
                        const delLinesSql = 'DELETE FROM product_invoice WHERE invoice_id = ?';
                        connection.query(delLinesSql, [invoiceId], (errDel) => {
                            if (errDel) {
                                return connection.rollback(() => {
                                    res.status(500).json({ error: "Errore nell'eliminazione delle righe esistenti" });
                                });
                            }

                            const values = lines.map(l => [
                                invoiceId,
                                l.product_id,
                                l.quantity,
                                l.unit_price,
                                l.price_for_quantity.toFixed(2),
                                l.name_product,
                            ]);

                            const linesSql = `
                INSERT INTO product_invoice (
                  invoice_id,
                  product_id,
                  quantity,
                  unit_price,
                  price_for_quantity,
                  name_product
                ) VALUES ?
              `;

                            connection.query(linesSql, [values], (errLines) => {
                                if (errLines) {
                                    return connection.rollback(() => {
                                        res.status(500).json({ error: "Errore nell'inserimento delle nuove righe fattura" });
                                    });
                                }

                                connection.commit(errCommit => {
                                    if (errCommit) {
                                        return connection.rollback(() => {
                                            res.status(500).json({ error: "Errore nel commit della transazione" });
                                        });
                                    }

                                    return res.json({
                                        success: true,
                                        message: "Fattura aggiornata correttamente",
                                        invoice_id: invoiceId,
                                    });
                                });
                            });
                        });
                    });
                });
            }
        );
    });
}

// DELETE – elimina fattura + righe product_invoice (+ eventuali pagamenti collegati)
function deleteInvoice(req, res) {
    const invoiceId = req.params.id;

    connection.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: "Errore nell'avvio della transazione" });
        }

        // prima eliminiamo i pagamenti 
        /* const delPaymentsSql = 'DELETE FROM payments WHERE invoice_id = ?';
        connection.query(delPaymentsSql, [invoiceId], (errPay) => {
            if (errPay) {
                return connection.rollback(() => {
                    res.status(500).json({ error: "Errore nell'eliminazione dei pagamenti collegati" });
                });
            }  al momento, sgancio payments dalla delete*/

        // poi le righe di product_invoice
        const delLinesSql = 'DELETE FROM product_invoice WHERE invoice_id = ?';
        connection.query(delLinesSql, [invoiceId], (errLines) => {
            if (errLines) {
                return connection.rollback(() => {
                    res.status(500).json({ error: "Errore nell'eliminazione delle righe fattura" });
                });
            }

            // infine la fattura
            const delInvSql = 'DELETE FROM invoices WHERE id = ?';
            connection.query(delInvSql, [invoiceId], (errInv, resultInv) => {
                if (errInv) {
                    return connection.rollback(() => {
                        res.status(500).json({ error: "Errore nell'eliminazione della fattura" });
                    });
                }

                if (resultInv.affectedRows === 0) {
                    return connection.rollback(() => {
                        res.status(404).json({ error: "Fattura non trovata" });
                    });
                }

                connection.commit(errCommit => {
                    if (errCommit) {
                        return connection.rollback(() => {
                            res.status(500).json({ error: "Errore nel commit della transazione" });
                        });
                    }

                    return res.json({
                        success: true,
                        deleted_invoice_id: invoiceId,
                    });
                });
            });
        });
    });
};

module.exports = {
    index,
    show,
    storeInvoice,
    updateInvoice,
    deleteInvoice,
};
