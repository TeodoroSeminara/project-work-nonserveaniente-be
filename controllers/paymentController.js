const connection = require('../data/db');

// INDEX – tutti i pagamenti
function index(req, res) {
  const sql = `
    SELECT *
    FROM payments
    ORDER BY created_at DESC
  `;
  connection.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: "Errore nel recupero dei pagamenti" });
    return res.json(result);
  });
}

// SHOW – un pagamento per id
function show(req, res) {
  const paymentId = req.params.id;

  const sql = `SELECT * FROM payments WHERE id = ?`;
  connection.query(sql, [paymentId], (err, result) => {
    if (err) return res.status(500).json({ error: "Errore nel recupero del pagamento" });
    if (result.length === 0) {
      return res.status(404).json({ error: "Pagamento non trovato" });
    }
    return res.json(result[0]);
  });
}

// STORE – crea nuovo pagamento
function storePayment(req, res) {
  const {
    invoice_id,
    amount,
    payment_method = 'credit_card',
    status = 'pending',
  } = req.body;

  if (!invoice_id || !amount) {
    return res.status(400).json({ error: "invoice_id e amount sono obbligatori" });
  }

  const sql = `
    INSERT INTO payments (invoice_id, amount, payment_method, status)
    VALUES (?, ?, ?, ?)
  `;

  const params = [invoice_id, amount, payment_method, status];

  connection.query(sql, params, (err, result) => {
    if (err) {
      // possibile errore di foreign key se invoice_id non esiste
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: "invoice_id non valido" });
      }
      return res.status(500).json({ error: "Errore nella creazione del pagamento" });
    }

    return res.status(201).json({
      success: true,
      created_payment_id: result.insertId,
    });
  });
}

// UPDATE – aggiorna pagamento (PUT)
function updatePayment(req, res) {
  const paymentId = req.params.id;

  const {
    invoice_id,
    amount,
    payment_method,
    status,
  } = req.body;

  const sql = `
    UPDATE payments
    SET
      invoice_id = ?,
      amount = ?,
      payment_method = ?,
      status = ?
    WHERE id = ?
  `;

  const params = [invoice_id, amount, payment_method, status, paymentId];

  connection.query(sql, params, (err, result) => {
    if (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: "invoice_id non valido" });
      }
      return res.status(500).json({ error: "Errore nell'aggiornamento del pagamento" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pagamento non trovato" });
    }

    return res.json({
      success: true,
      updated_payment_id: paymentId,
    });
  });
}

// DELETE – elimina pagamento
function deletePayment(req, res) {
  const paymentId = req.params.id;

  connection.query(
    'DELETE FROM payments WHERE id = ?',
    [paymentId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Errore nell'eliminazione del pagamento" });

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Pagamento non trovato" });
      }

      return res.json({
        success: true,
        deleted_payment_id: paymentId,
      });
    }
  );
}

module.exports = {
  index,
  show,
  storePayment,
  updatePayment,
  deletePayment,
};