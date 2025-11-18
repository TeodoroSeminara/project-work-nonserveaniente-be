const express = require("express");
const invoiceController = require('../controllers/invoiceController');

const router = express.Router();

// index – tutte le fatture
router.get('/', invoiceController.index);

// show – singola fattura
router.get('/:id', invoiceController.show);

// store – crea fattura
router.post('/', invoiceController.storeInvoice);

// update – aggiorna fattura
router.put('/:id', invoiceController.updateInvoice);
// patch - aggiorna parzialmente fattura
router.patch('/:id', invoiceController.updateInvoice);

// delete – elimina fattura
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;