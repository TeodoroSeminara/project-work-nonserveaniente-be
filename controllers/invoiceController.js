const connection = require('../data/db');

// INDEX – tutte le fatture
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

// SHOW – una fattura per id
function show(req, res) {
    const invoiceId = req.params.id;

    const sql = `SELECT * FROM invoices WHERE id = ?`;
    connection.query(sql, [invoiceId], (err, result) => {
        if (err) return res.status(500).json({ error: "Errore nel recupero della fattura" });
        if (result.length === 0) {
            return res.status(404).json({ error: "Fattura non trovata" });
        }
        return res.json(result[0]);
    });
}

// STORE – crea nuova fattura
function storeInvoice(req, res) {
    console.log("BODY RICEVUTO PER CREATE INVOICE:", req.body);
    const {
        order_number,
        total_amount,
        shipping_cost = 0.0,
        status = 'pending',
        shipping_address,
        shipping_cap,
        shipping_city,
        shipping_description = null,
        billing_address = null,
        billing_cap = null,
        billing_city = null,
        billing_description = null,
        name,
        surname,
        phone,
        email,
    } = req.body;

    // Validazione minima
    if (!order_number || !total_amount || !shipping_address || !shipping_cap || !shipping_city || !name || !surname || !phone || !email) {
        return res.status(400).json({ error: "Campi obbligatori mancanti" });
    }

    const sql = `
    INSERT INTO invoices (
      order_number,
      total_amount,
      shipping_cost,
      status,
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
      email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        order_number,
        total_amount,
        shipping_cost,
        status,
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
    ];

    connection.query(sql, params, (err, result) => {
        if (err) {
            console.error("Errore MySQL nella creazione fattura:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: "fattura già esistente" });
            }
            return res.status(500).json({ error: "Errore nella creazione della fattura" });
        }

        return res.status(201).json({
            success: true,
            created_invoice_id: result.insertId,
        });
    });
}

// UPDATE – aggiorna una fattura (PUT)
function updateInvoice(req, res) {
    const invoiceId = req.params.id;

    const {
        order_number,
        total_amount,
        shipping_cost,
        status,
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
    } = req.body;

    const sql = `
    UPDATE invoices
    SET
      order_number = ?,
      total_amount = ?,
      shipping_cost = ?,
      status = ?,
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
    WHERE id = ?
  `;

    const params = [
        order_number,
        total_amount,
        shipping_cost,
        status,
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
        invoiceId,
    ];

    connection.query(sql, params, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: "order_number già esistente" });
            }
            return res.status(500).json({ error: "Errore nell'aggiornamento della fattura" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Fattura non trovata" });
        }

        return res.json({
            success: true,
            updated_invoice_id: invoiceId,
        });
    });
}

// DELETE – elimina una fattura + record collegati
function deleteInvoice(req, res) {
    const invoiceId = req.params.id;

    // Prima cancelliamo payments e product_invoice collegati,
    // poi la fattura (per evitare problemi con le foreign key)
    connection.query(
        'DELETE FROM payments WHERE invoice_id = ?',
        [invoiceId],
        (err1) => {
            if (err1) return res.status(500).json({ error: "Errore nell'eliminazione dei pagamenti collegati" });

            connection.query(
                'DELETE FROM product_invoice WHERE invoice_id = ?',
                [invoiceId],
                (err2) => {
                    if (err2) return res.status(500).json({ error: "Errore nell'eliminazione delle righe prodotto-fattura collegate" });

                    connection.query(
                        'DELETE FROM invoices WHERE id = ?',
                        [invoiceId],
                        (err3, result) => {
                            if (err3) return res.status(500).json({ error: "Errore nell'eliminazione della fattura" });

                            if (result.affectedRows === 0) {
                                return res.status(404).json({ error: "Fattura non trovata" });
                            }

                            return res.json({
                                success: true,
                                deleted_invoice_id: invoiceId,
                            });
                        }
                    );
                }
            );
        }
    );
}

module.exports = {
    index,
    show,
    storeInvoice,
    updateInvoice,
    deleteInvoice,
};