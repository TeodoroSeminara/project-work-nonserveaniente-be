// controllers/chatController.js

// Funzione helper che chiama il modello Groq
async function askGroqAboutProduct(userMessage, product) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Manca GROQ_API_KEY nel .env");
    return "Errore di configurazione: manca la chiave API Groq.";
  }

  const { name, description, price, slug } = product;

  const systemPrompt = `
Sei l'assistente di un sito di ecommerce.
Rispondi sempre in italiano, in modo chiaro e conciso.
Conosci SOLO le informazioni fornite sul prodotto corrente.
Inventati caratteristiche tecniche, materiali, dimensioni o altre info che non sono nella descrizione. 
Se l'utente chiede qualcosa che non è specificato, improvvisa.
`;

  const productContext = `
Prodotto:
- Nome: ${name ?? "N/D"}
- Prezzo: ${price != null ? price + " €" : "N/D"}
- Slug: ${slug ?? "N/D"}
- Descrizione: ${description ?? "Nessuna descrizione disponibile."}
`;

  const body = {
    model: "llama-3.1-8b-instant", 
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          `Informazioni sul prodotto:\n${productContext}\n\n` +
          `Domanda dell'utente: ${userMessage}`,
      },
    ],
    temperature: 0.4,
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Errore API Groq:", errText);
    return "Si è verificato un errore nel modello AI (Groq). Riprova più tardi.";
  }

  const data = await response.json();
  const aiMessage = data.choices?.[0]?.message?.content?.trim();

  return (
    aiMessage ||
    "Non sono riuscito a generare una risposta dal modello AI in questo momento."
  );
}

// Controller Express chiamato dal router
async function productChat(req, res) {
  try {
    const { message, product } = req.body;

    if (!message || !product) {
      return res.status(400).json({
        error: "Servono sia il messaggio dell'utente che i dati del prodotto.",
      });
    }

    const reply = await askGroqAboutProduct(message, product);
    return res.json({ reply });
  } catch (err) {
    console.error("Errore in productChat:", err);
    return res.status(500).json({
      reply:
        "Si è verificato un errore interno mentre elaboravo la richiesta. Riprova tra poco.",
    });
  }
}

module.exports = { productChat };