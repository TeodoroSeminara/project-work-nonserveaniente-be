const express = require("express");

// importiamo il controller
const productController = require('../controllers/productController');
// importa upload
const upload = require('../controllers/upload')

// settiamo il router
const router = express.Router();

// index
router.get('/', productController.index)

// show
router.get('/:id', productController.show)

// store review 

router.post('/', upload.array('images'), productController.storeProduct);

// delete
router.delete('/:id', productController.deleteProduct);


module.exports = router;