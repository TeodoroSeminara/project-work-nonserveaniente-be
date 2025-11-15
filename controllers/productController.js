const connection = require('../data/db');
// SELECT * FROM products
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

/* function show(req, res) {
    const id = req.params.id;

    const productSql = `SELECT * FROM products p JOIN product_images pi ON p.id=pi.product_id WHERE p.id=pi.product_id`;

    
    connection.query(productSql, [id], (err, productResult) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (productResult.length === 0) return res.status(404).json({ error: "Prodotto not found" });

        const singleProduct = { ...productResult[0] };
        singleProduct.image_url = req.imagePath + singleProduct.image_url;
        return res.json(singleProduct);

    });
} */

// STORE 

/* function storeReview(req, res) {

    // recuperiamo id da param
    const id = req.params.id;

    // recuperiamo i dati nel body
    const { name, vote, text } = req.body;

    // prepariamo la query per la chiamata al DB
    const sql = 'INSERT INTO `reviews` (`name`, `vote`, `text`, `movie_id`) VALUES (?,?,?,?)';

    // eseguiamo la query (con check preventivo dei dati)
    connection.query(sql, [name, vote, text, id], (err, result) => {
        // se c'è errore server DB
        if (err) return res.status(500).json({ error: 'Database queri failed' });
        // se va tutto bene
        res.status(201);
        res.json({ id: result.insertId, message: 'Review added' });
    })

} */


//DELETE 

/* function delete(req,res) {
    const id = req.params.id

    const productSQL = 'DELETE * FROM products WHERE id = ?'


} */

module.exports = { index, show };