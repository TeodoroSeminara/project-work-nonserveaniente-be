const multer = require('multer');
const path = require('path');

// Definisci dove e come salvare i file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // salva nella cartella
        cb(null, 'public/images');
    },
    filename: function (req, file, cb) {
        // nome file unico generato con la data + il nome originale
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

module.exports = upload;
