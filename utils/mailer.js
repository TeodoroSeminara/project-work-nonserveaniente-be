// mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, 
    auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS, 
    },
    
});

// debug
transporter.verify((error, success) => {
    if (error) {
        console.error("Errore configurazione SMTP:", error);
    } else {
        console.log("SMTP pronto per inviare email");
    }
});

// Costruisce il riepilogo prodotti in testo + html
function buildOrderSummaryLines(items) {
    // items: array tipo [{ name_product, quantity, unit_price, price_for_quantity }, ...]
    let textLines = [];
    let htmlLines = [];

    for (const it of items) {
        const lineText = `${it.quantity}x ${it.name_product} - €${Number(it.price_for_quantity).toFixed(2)}`;
        const lineHtml = `<li>${it.quantity}x ${it.name_product} - €${Number(it.price_for_quantity).toFixed(2)}</li>`;
        textLines.push(lineText);
        htmlLines.push(lineHtml);
    }

    return {
        text: textLines.join("\n"),
        html: htmlLines.join(""),
    };
}

// Mail al cliente
async function sendOrderConfirmationToCustomer(invoice, items) {
    const { text, html } = buildOrderSummaryLines(items);

    const plainText = `
Ciao ${invoice.name},

grazie per il tuo ordine su Non Serve A Niente! 🖤

Numero ordine: ${invoice.order_number}
Totale: €${invoice.total_amount}
Spedizione: €${invoice.shipping_cost}

Riepilogo prodotti:
${text}

Indirizzo di spedizione:
${invoice.shipping_address}
${invoice.shipping_cap} ${invoice.shipping_city}

Se hai domande, rispondi pure a questa mail.

A presto,
Non Serve A Niente
  `.trim();

    const htmlBody = `
    <h1>Grazie per il tuo ordine, ${invoice.name}!</h1>
    <p>Abbiamo ricevuto il tuo ordine su <strong>Non Serve A Niente</strong>.</p>
    <p><strong>Numero ordine:</strong> ${invoice.order_number}</p>
    <p><strong>Totale:</strong> €${invoice.total_amount}</p>
    <p><strong>Spedizione:</strong> €${invoice.shipping_cost}</p>

    <h3>Riepilogo prodotti</h3>
    <ul>
      ${html}
    </ul>

    <h3>Indirizzo di spedizione</h3>
    <p>
      ${invoice.shipping_address}<br/>
      ${invoice.shipping_cap} ${invoice.shipping_city}
    </p>

    <p>Se hai domande, non fartele.</p>
    <p>Ci auguriamo che tu voglia investire ancora in cose inutili,<br/>Non Serve A Niente</p>
  `;

    await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: invoice.email,
        subject: `Conferma ordine #${invoice.order_number}`,
        text: plainText,
        html: htmlBody,
    });
}

// Mail allo shop
async function sendOrderNotificationToStore(invoice, items) {
    const { text, html } = buildOrderSummaryLines(items);

    const storeEmail = process.env.STORE_EMAIL;

    const plainText = `
Nuovo ordine ricevuto su Non Serve A Niente

Numero ordine: ${invoice.order_number}
Data: ${invoice.created_at || "N/A"}

Cliente: ${invoice.name} ${invoice.surname}
Email: ${invoice.email}
Telefono: ${invoice.phone}

Totale: €${invoice.total_amount}
Spedizione: €${invoice.shipping_cost}

Prodotti:
${text}

Indirizzo di spedizione:
${invoice.shipping_address}
${invoice.shipping_cap} ${invoice.shipping_city}

Indirizzo di fatturazione:
${invoice.billing_address || "-"}
${invoice.billing_cap || ""} ${invoice.billing_city || ""}
  `.trim();

    const htmlBody = `
    <h2>Nuovo ordine ricevuto</h2>
    <p><strong>Numero ordine:</strong> ${invoice.order_number}</p>
    <p><strong>Data:</strong> ${invoice.created_at || "N/A"}</p>

    <h3>Cliente</h3>
    <p>
      ${invoice.name} ${invoice.surname}<br/>
      Email: ${invoice.email}<br/>
      Telefono: ${invoice.phone}
    </p>

    <h3>Totale</h3>
    <p><strong>Totale:</strong> €${invoice.total_amount}<br/>
    <strong>Spedizione:</strong> €${invoice.shipping_cost}</p>

    <h3>Prodotti</h3>
    <ul>
      ${html}
    </ul>

    <h3>Indirizzo di spedizione</h3>
    <p>
      ${invoice.shipping_address}<br/>
      ${invoice.shipping_cap} ${invoice.shipping_city}
    </p>

    <h3>Indirizzo di fatturazione</h3>
    <p>
      ${invoice.billing_address || "-"}<br/>
      ${invoice.billing_cap || ""} ${invoice.billing_city || ""}
    </p>
  `;

    await transporter.sendMail({
        from: process.env.STORE_FROM_EMAIL,
        to: storeEmail,
        subject: `Nuovo ordine #${invoice.order_number}`,
        text: plainText,
        html: htmlBody,
    });
}

module.exports = {
    sendOrderConfirmationToCustomer,
    sendOrderNotificationToStore,
};