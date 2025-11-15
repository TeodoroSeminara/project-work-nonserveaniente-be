/* const connection = require('../data/db');

// INDEX
function index(req, res) {
  const sql = 'SELECT * FROM products';
  connection.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    const products = result.map((movie) => {
      return {
        ...product,
        image: req.imagePath + movie.image,
      };
    });
    res.json(products);
  });
}

// SHOW
function show(req, res) {
  const id = req.params.id;

  const movieSql = `SELECT M.*, ROUND(AVG(R.vote)) AS average_vote
    FROM movies M 
    LEFT JOIN reviews R 
    ON R.movie_id = M.id 
    WHERE M.id = ?`

  const reviewSql = 'SELECT * FROM reviews WHERE movie_id = ?';

  connection.query(movieSql, [id], (err, movieResult) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (movieResult.length === 0) return res.status(404).json({ error: "Movie not found" });

    const singleMovie = {...movieResult[0] };
    singleMovie.image = req.imagePath + singleMovie.image;

    connection.query(reviewSql, [id], (err, reviewResult) => {
      if (err) return res.status(500).json({ error: "Database error" });

      singleMovie.reviews = reviewResult;
      singleMovie.average_vote = parseInt(singleMovie.average_vote);
      return res.json(singleMovie); 
    });
  });
}

// STORE 

function storeReview(req, res) {

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

}


//DELETE 

function delete(req,res) {
    const id = req.params.id

    const productSQL = 'DELETE * FROM products WHERE id = ?'


}

module.exports = { index, show, storeReview }; */