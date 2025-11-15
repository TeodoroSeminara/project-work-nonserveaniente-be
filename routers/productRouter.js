const express = require("express");

// importiamo il controller
const productController = require('../controllers/productController');

// settiamo il router
const router = express.Router();

// index
router.get('/', productController.index)

// show
router.get('/:id', productController.show)

// store review 

/* router.post('/:id/reviews', productController.storeReview) */

module.exports = router;