const express = require("express");
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// index – tutti i pagamenti
router.get('/', paymentController.index);

// show – singolo pagamento
router.get('/:id', paymentController.show);

// store – crea pagamento
router.post('/', paymentController.storePayment);

// update – aggiorna pagamento
router.put('/:id', paymentController.updatePayment);
// volendo anche patch
// router.patch('/:id', paymentController.updatePayment);

// delete – elimina pagamento
router.delete('/:id', paymentController.deletePayment);

module.exports = router;