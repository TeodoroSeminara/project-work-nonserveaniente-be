// Import pacchetto mysql2
const mysql = require("mysql2");

// Collegamento db, con richiami da .env per dati privati
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

// log per check connessione db
connection.connect((err) => {
    if (err) throw err;
    console.log("Connected to MySQL");

});

module.exports = connection;