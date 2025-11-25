// mailer.js
const path = require("path");
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
    console.log("PATH IMG:", path.join(__dirname, '..', 'data', 'nsan-banner.png'));
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

Indirizzo di fatturazione: 
${invoice.billing_address}
${invoice.billing_cap} ${invoice.billing_city}

Se hai domande, rispondi pure a questa mail.

A presto,
Non Serve A Niente
  `.trim();

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background-color:#f7f7f7; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px;">

<img src="cid:nsan-banner"
             alt="Non Serve A Niente"
             style="width:100%; margin-bottom:25px; border-radius:8px;" />

      <h1 style="color:#000; font-size:24px; margin-bottom:10px;">
        🎉 Grazie per il tuo ordine, ${invoice.name}!
      </h1>

      <p style="font-size:16px; line-height:1.5; color:#333;">
        Il tuo acquisto su <strong>Non Serve A Niente</strong> è andato a buon fine.  
        Preparati a ricevere cose meravigliosamente inutili. 🖤
      </p>

      <div style="margin:25px 0; padding:15px; background:#fafafa; border-left:4px solid #f47b73;">
        <p style="margin:0; font-size:16px;">
          <strong>Numero ordine:</strong> ${invoice.order_number}<br/>
          <strong>Totale:</strong> €${invoice.total_amount}<br/>
          <strong>Spedizione:</strong> €${invoice.shipping_cost}
        </p>
      </div>

      <h2 style="font-size:20px; margin-top:30px;">🛒 Riepilogo prodotti</h2>
      <ul style="padding-left:20px; color:#333; font-size:15px; line-height:1.5;">
        ${html}
      </ul>

      <h2 style="font-size:20px; margin-top:30px;">📦 Indirizzo di spedizione</h2>
      <p style="font-size:16px; line-height:1.5; color:#333;">
        ${invoice.shipping_address}<br/>
        ${invoice.shipping_cap} ${invoice.shipping_city}
      </p>

      <h2 style="font-size:20px; margin-top:30px;">📦 Indirizzo di fatturazione</h2>
      <p style="font-size:16px; line-height:1.5; color:#333;">
      ${invoice.billing_address}<br/>
        ${invoice.billing_cap} ${invoice.billing_city}
      </p>

      <div style="margin-top:30px; padding:20px; background:#f47b73; color:#fff; text-align:center; border-radius:6px;">
        <p style="margin:0; font-size:16px; line-height:1.6;">
          Hai domande?  
          Non fartele.<br/>
          (Oppure rispondi a questa mail, va bene lo stesso.)
        </p>
      </div>

      <p style="margin-top:25px; font-size:15px; color:#555; text-align:center;">
        Grazie per aver investito in cose inutili 💸<br/>
        <strong>Non Serve A Niente</strong>
      </p>

    </div>
  </div>
  `;
  
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: invoice.email,
    subject: `Conferma ordine #${invoice.order_number}`,
    text: plainText,
    html: htmlBody,
    attachments: [
      {
        filename: 'nsan-banner.png',
        path: path.join(__dirname, '..', 'data', 'nsan-banner.png'),
        cid: 'nsan-banner'
      }
    ]
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
