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

// SHOW con lo slug, al posto dell'id va usato il nome slug
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
// function storeProduct(req, res) {
//   const { name, description, price } = req.body;
//   const slug = generateSlug(name);

//   const sqlProdotto = "INSERT INTO products (name, description, price, slug) VALUES (?, ?, ?, ?)";
//   connection.query(sqlProdotto, [name, description, price, slug], (err, result) => {
//     if (err) {
//       return res.status(500).json({ error: "Errore nel salvataggio prodotto" });
//     }

//     const productId = result.insertId;

//     if (req.files && req.files.length > 0) {
//       const imagesToInsert = req.files.map(file => [productId, file.filename]);
//       const sqlImmagini = "INSERT INTO product_images (product_id, image_url) VALUES ?";
//       connection.query(sqlImmagini, [imagesToInsert], (err2) => {
//         if (err2) return res.status(500).json({ error: "Errore nel salvataggio immagini" });
//         return res.json({
//           success: true,
//           slug,
//           immagini: imagesToInsert.map(i => i[1])
//         });
//       });
//     } else {
//       return res.json({
//         success: true,
//         slug
//       });
//     }
//   });
// }

function storeProduct(req, res) {
  const { name, description, price } = req.body;
  let baseSlug = generateSlug(name);

  // Step 1: cerca slug simili
  const sqlCheckSlug = `
    SELECT slug FROM products WHERE slug = ? OR slug LIKE CONCAT(?, '-%')
  `;
  connection.query(sqlCheckSlug, [baseSlug, baseSlug], (err, results) => {
    if (err) return res.status(500).json({ error: "Errore controllo slug" });

    let finalSlug = baseSlug;

    if (results.length > 0) {
      // Filtra solo gli slug esistenti e trova il numero massimo
      // Esempio: slug, slug-1, slug-2, slug-12
      let maxN = 0;
      results.forEach(row => {
        const match = row.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
        if (match) {
          const n = parseInt(match[1]);
          if (n > maxN) maxN = n;
        } else if (row.slug === baseSlug) {
          maxN = 1; // almeno uno slug base già c'è
        }
      });
      finalSlug = `${baseSlug}-${maxN + 1}`;
    }

    // Step 2: inserisci prodotto con lo slug calcolato
    const sqlProdotto = "INSERT INTO products (name, description, price, slug) VALUES (?, ?, ?, ?)";
    connection.query(sqlProdotto, [name, description, price, finalSlug], (err2, result) => {
      if (err2) {
        return res.status(500).json({ error: "Errore nel salvataggio prodotto" });
      }

      const productId = result.insertId;

      if (req.files && req.files.length > 0) {
        const imagesToInsert = req.files.map(file => [productId, file.filename]);
        const sqlImmagini = "INSERT INTO product_images (product_id, image_url) VALUES ?";
        connection.query(sqlImmagini, [imagesToInsert], (err3) => {
          if (err3) return res.status(500).json({ error: "Errore nel salvataggio immagini" });
          return res.json({
            success: true,
            slug: finalSlug,
            immagini: imagesToInsert.map(i => i[1])
          });
        });
      } else {
        return res.json({
          success: true,
          slug: finalSlug
        });
      }
    });
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

// function deleteProduct(req, res) {
//   const id = req.params.id;
//   // Cancella immagini collegate
//   connection.query('SELECT image_url FROM product_images WHERE product_id = ?', [id], (err2, images) => {
//     if (err2) return res.status(500).json({ error: "Errore ricerca immagini" });

//     images.forEach(img => {
//       if (img.image_url) {
//         const filePath = path.join(__dirname, '../public/images/', img.image_url);
//         try { fs.unlinkSync(filePath); } catch (e) { }
//       }
//     });

//     // Cancella prodotto principale
//     connection.query('DELETE FROM products WHERE id = ?', [id], (err3, result) => {
//       if (err3) return res.status(500).json({ error: "Errore eliminazione prodotto" });
//       return res.json({ success: true, deleted_id: id });
//     });
//   });
// }


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

// Funzione filteredIndex aggiornata per gestire filtri multipli
function filteredIndex(req, res) {
  const {
    category,    // può essere "1,2,3"
    utility,     // può essere "1,3,5"
    price_min,
    price_max,
    id_from,
    id_to,
    name,
    sort,
    limit,
    offset
  } = req.query;

  let where = [];
  let params = [];

  // CATEGORY - gestisce valori multipli
  if (category) {
    const categoryIds = category.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
    if (categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(',');
      where.push(`p.category_id IN (${placeholders})`);
      params.push(...categoryIds);
    }
  }

  // UTILITY - gestisce valori multipli
  if (utility) {
    const utilityValues = utility.split(',').map(u => parseInt(u.trim())).filter(u => !isNaN(u));
    if (utilityValues.length > 0) {
      const placeholders = utilityValues.map(() => '?').join(',');
      where.push(`p.usefulness IN (${placeholders})`);
      params.push(...utilityValues);
    }
  }

  // PRICE RANGE
  if (price_min) {
    where.push("p.price >= ?");
    params.push(parseFloat(price_min));
  }
  if (price_max) {
    where.push("p.price <= ?");
    params.push(parseFloat(price_max));
  }

  // ID RANGE
  if (id_from) {
    where.push("p.id >= ?");
    params.push(parseInt(id_from));
  }
  if (id_to) {
    where.push("p.id <= ?");
    params.push(parseInt(id_to));
  }

  // NAME SEARCH
  if (name) {
    where.push("p.name LIKE ?");
    params.push(`%${name}%`);
  }

  // BASE QUERY con JOIN immagini
  let sql = `
    SELECT p.*, 
      MIN(pi.image_url) AS image_url
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
  `;

  // Aggiungi WHERE se ci sono filtri
  if (where.length > 0) {
    sql += " WHERE " + where.join(" AND ");
  }

  sql += " GROUP BY p.id";

  // SORTING

  if (sort === "random") { sql += " ORDER BY RAND()"; }
  else if (sort === "price_asc") { sql += " ORDER BY p.price ASC"; }
  else if (sort === "price_desc") sql += " ORDER BY p.price DESC";
  else if (sort === "name_asc") sql += " ORDER BY p.name ASC";
  else if (sort === "name_desc") sql += " ORDER BY p.name DESC";
  else if (sort === "id_desc") sql += " ORDER BY p.id DESC";
  else if (sort === "id_asc") sql += " ORDER BY p.id ASC";
  else sql += " ORDER BY p.id ASC";

  // LIMIT / OFFSET per paginazione
  const lim = parseInt(limit) || 12;
  const off = parseInt(offset) || 0;
  sql += " LIMIT ? OFFSET ?";
  params.push(lim, off);

  // Esegui query
  connection.query(sql, params, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    // Formatta i risultati
    const products = result.map(product => ({
      name: product.name,
      description: product.description,
      price: product.price,
      slug: product.slug,
      utility: product.utility,
      category_id: product.category_id,
      image_url: product.image_url
        ? `${req.imagePath}${product.image_url}`
        : null,
    }));

    return res.json(products);
  });
}

function getCategories(req, res) {
  const sql = `SELECT id, name FROM categories ORDER BY id ASC`;
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.json(results);
  });
}

module.exports = { show, storeProduct, deleteProduct, updateProduct, addImages, filteredIndex, getCategories };
