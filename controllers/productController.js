const connection = require('../data/db');
const fs = require('fs');
const path = require('path');

// Funzione per generare slug
function generateSlug(name) {
  return name
    // lettere minuscole
    .toLowerCase()
    // sostituisce gli spazi con -
    .replace(/ /g, '-')
    // cerco tutto quello che è tra [] ^ negazione tutto quello che non è, \w lettere-numeri-underscore_, permette il trattino = qualsiasi carattere che NON sia lettera, numero, underscore o trattino il + uno o più di quelli appena trovati
    .replace(/[^\w-]+/g, '')
    // se ci sono più - di fila --- li sostituisce con uno unico 
    .replace(/-+/g, '-')
    // toglie i - da inizio e fine stringa 
    .replace(/^-+|-+$/g, '');
}

// INDEX - restituisce anche lo slug
function index(req, res) {
  const sql = `
    SELECT p.*, 
      MIN(pi.image_url) AS image_url
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
    GROUP BY p.id`;
  connection.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    const products = result.map((product) => {
      return {
        name: product.name,
        description: product.description,
        price: product.price,
        slug: product.slug, // --- AGGIUNTO: restituisce slug
        image_url: req.imagePath + product.image_url,
      };
    });
    res.json(products);
  });
}

// SHOW by slug (nuova funzione per vedere prodotto via slug)
function show(req, res) {
  const slug = req.params.slug;
  const productSql = `
    SELECT p.*, pi.image_url
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
    WHERE p.slug = ?`
    ;
  connection.query(productSql, [slug], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(404).json({ error: "Prodotto not found" });

    // Prendi i dati dalla prima riga
    const { name, description, price, slug } = results[0];
    const images = results.map(row => req.imagePath + row.image_url);

    // id NON restituito!
    const product = { name, description, price, slug, images };
    return res.json(product);
  });
}

// STORE - insert con slug
function storeProduct(req, res) {
  const { name, description, price } = req.body;
  const slug = generateSlug(name);

  const sqlProdotto = "INSERT INTO products (name, description, price, slug) VALUES (?, ?, ?, ?)";
  connection.query(sqlProdotto, [name, description, price, slug], (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Errore nel salvataggio prodotto" });
    }

    const productId = result.insertId;

    if (req.files && req.files.length > 0) {
      const imagesToInsert = req.files.map(file => [productId, file.filename]);
      const sqlImmagini = "INSERT INTO product_images (product_id, image_url) VALUES ?";
      connection.query(sqlImmagini, [imagesToInsert], (err2) => {
        if (err2) return res.status(500).json({ error: "Errore nel salvataggio immagini" });
        return res.json({
          success: true,
          slug,
          immagini: imagesToInsert.map(i => i[1])
        });
      });
    } else {
      return res.json({
        success: true,
        slug
      });
    }
  });
}

// DELETE by slug
function deleteProduct(req, res) {
  const slug = req.params.slug;
  // Trova l'id tramite slug
  connection.query('SELECT id FROM products WHERE slug = ?', [slug], (err, results) => {
    if (err) return res.status(500).json({ error: "Errore ricerca prodotto" });
    if (results.length === 0) return res.status(404).json({ error: "Prodotto not found" });
    const productId = results[0].id;

    // Cancella tutte le immagini collegate
    connection.query(
      'SELECT image_url FROM product_images WHERE product_id = ?',
      [productId],
      (err2, images) => {
        if (err2) return res.status(500).json({ error: "Errore ricerca immagini" });

        images.forEach(img => {
          const filePath = path.join(__dirname, '../public/images/', img.image_url);
          try {
            fs.unlinkSync(filePath);
          } catch (e) { }
        });

        // Cancella il prodotto principale (cascade cancella immagini dal db)
        connection.query(
          'DELETE FROM products WHERE id = ?',
          [productId],
          (err3, result) => {
            if (err3) return res.status(500).json({ error: "Errore eliminazione prodotto" });
            return res.json({ success: true, deleted_slug: slug });
          }
        );
      }
    );
  });
}

// UPDATE prodotto by slug
function updateProduct(req, res) {
  const slug = req.params.slug;
  const { name, description, price } = req.body;
  // Opzionale: genera nuovo slug se hai cambiato "name"
  const newSlug = name ? generateSlug(name) : slug;

  // Trova product ID via slug
  connection.query('SELECT id FROM products WHERE slug = ?', [slug], (err, results) => {
    if (err) return res.status(500).json({ error: "Errore ricerca prodotto" });
    if (results.length === 0) return res.status(404).json({ error: "Prodotto not found" });
    const productId = results[0].id;

    // Update prodotto - update fields and possibly slug
    const sqlUpdate = "UPDATE products SET name = ?, description = ?, price = ?, slug = ? WHERE id = ?";
    connection.query(sqlUpdate, [name, description, price, newSlug, productId], (err2) => {
      if (err2) return res.status(500).json({ error: "Errore update prodotto" });
      return res.json({ success: true, updated_slug: newSlug });
    });
  });
}

// AGGIUNGI IMMAGINI a prodotto esistente by slug
function addImages(req, res) {
  const slug = req.params.slug;

  connection.query('SELECT id FROM products WHERE slug = ?', [slug], (err, results) => {
    if (err) return res.status(500).json({ error: "Errore ricerca prodotto" });
    if (results.length === 0) return res.status(404).json({ error: "Prodotto not found" });
    const productId = results[0].id;

    // Se hai caricato immagini
    if (req.files && req.files.length > 0) {
      const imagesToInsert = req.files.map(file => [productId, file.filename]);
      const sql = "INSERT INTO product_images (product_id, image_url) VALUES ?";
      connection.query(sql, [imagesToInsert], (err2) => {
        if (err2) return res.status(500).json({ error: "Errore inserimento immagini" });
        return res.json({
          success: true,
          slug,
          immagini: imagesToInsert.map(i => i[1])
        });
      });
    } else {
      return res.status(400).json({ error: "Nessuna immagine caricata" });
    }
  });
}


module.exports = { index, show, storeProduct, deleteProduct, updateProduct, addImages };
