require("dotenv").config();
const express = require("express")
const app = express();
const port = 3000;

// importiamo globalmente il middleware di gestione errore server
const errorHandler = require("./middlewares/errorHandler");
// importiamo globalmente il middleware di gestione 404 per rotta inesistente
const notFound = require("./middlewares/notFound");

//Importo ImagePath

const imagePath = require("./middlewares/ImagePath")

// importiamo rotta products
const productRouter = require("./routers/productRouter")


// rotta invoice
const invoiceRouter = require("./routers/invoiceRouter");

// rotta payment
const paymentRouter = require("./routers/paymentRouter");

// importiamo CORS
const cors = require("cors");


app.use(cors({ origin: process.env.HOST }));



// usiamo il middleware static di express (per rendere disponibile i file statici)
app.use(express.static('public'));

// registro il body-parser per "application/json"
app.use(express.json());

app.use(imagePath);

// invoices
app.use("/api/nonserveaniente/invoices", invoiceRouter);

// payments
app.use("/api/nonserveaniente/payments", paymentRouter);

// product
app.use("/api/nonserveaniente", productRouter);

// impostiamo la rotta di home
app.get("/api", (req, res) => {
    console.log("hai richiesto la rotta di index");

    res.send('<h1>Ecco la home della API della nostra libreria</h1>')
})

// mettiamo in ascolto il server sulla porta definita
app.listen(port, () => {
    console.log(`Nonserveaniente app listening on port ${port}`);
});