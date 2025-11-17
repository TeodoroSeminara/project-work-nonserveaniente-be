const express = require("express");

// importiamo il controller
const productController = require('../controllers/productController');
// importa upload
const upload = require('../controllers/upload')

// settiamo il router
const router = express.Router();

// index
router.get('/', productController.index);

// show by slug — attenzione: questa rotta ora gestisce lo slug come unico identificatore!
router.get('/:slug', productController.show);

// crea prodotto
router.post('/', upload.array('images'), productController.storeProduct);

// elimina prodotto by slug
router.delete('/:slug', productController.deleteProduct);

// Update info prodotto (PATCH/PUT)
router.put('/:slug', upload.array('images'), productController.updateProduct);

// Aggiungi immagini a un prodotto esistente
router.post('/:slug/images', upload.array('images'), productController.addImages);

module.exports = router;
