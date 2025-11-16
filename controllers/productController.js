const connection = require('../data/db');

// INDEX
function index(req, res) {
  const sql = `
      SELECT p.*, 
      MIN(pi.image_url) AS image_url
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      GROUP BY p.id`;
  connection.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: "Database error sei un coglione" });
    const products = result.map((product) => {
      return {
        ...product,
        image_url: req.imagePath + product.image_url,
      };
    });
    res.json(products);
  });
}

// SHOW

// la show serve a mostrare le immagini associate al prodotto nella pagina dettaglio prodotto DettaglioProdotto.jsx
function show(req, res) {
  const id = req.params.id;

  const productSql = `
      SELECT p.*, pi.image_url
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = ?`
    ;

  connection.query(productSql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(404).json({ error: "Prodotto not found" });

    // Prendi i dati del prodotto dalla prima riga
    const { id, name, description, price } = results[0];
    // Crea un array con tutte le immagini
    const images = results.map(row => req.imagePath + row.image_url);

    // Prepara l'oggetto prodotto con il campo images array
    const product = { id, name, description, price, images };

    return res.json(product);
  });
}

// STORE 

function storeProduct(req, res) {
  // Prendo i dati testuali (da campi form)
  const { name, description, price } = req.body;

  // Query per aggiungere il prodotto al db
  const sqlProdotto = "INSERT INTO products (name, description, price) VALUES (?, ?, ?)";
  connection.query(sqlProdotto, [name, description, price], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Errore nel salvataggio prodotto" });
    }

    // Id del prodotto appena creato
    const productId = result.insertId;

    // Se hai caricato delle immagini (array di files)
    if (req.files && req.files.length > 0) {
      // Preparo array delle info da inserire nel db immagini
      const imagesToInsert = req.files.map(file => [productId, file.filename]);
      // Costruisco la query per salvare tutte le immagini in una volta
      const sqlImmagini = "INSERT INTO product_images (product_id, image_url) VALUES ?";
      connection.query(sqlImmagini, [imagesToInsert], (err2) => {
        if (err2) {
          return res.status(500).json({ error: "Errore nel salvataggio immagini" });
        }
        // Rispondere con successo, id prodotto e nomi file immagini
        return res.json({
          success: true,
          product_id: productId,
          immagini: imagesToInsert.map(i => i[1])
        });
      });
    } else {
      // Nessuna immagine caricata, rispondi solo con id prodotto
      return res.json({
        success: true,
        product_id: productId
      });
    }
  });
}


//UPDATE E MODIFY/PATCH


//DELETE 

/* function delete(req,res) {
    const id = req.params.id

    const productSQL = 'DELETE * FROM products WHERE id = ?'


} */

module.exports = { index, show, storeProduct };