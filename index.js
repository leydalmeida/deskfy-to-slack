import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

app.post("/deskfy", async (req, res) => {
  // pega tudo que o Deskfy mandou
  const { event, data } = req.body;

  console.log("🚚 Webhook recebido do Deskfy:", event, data);

  try {
    // manda TUDO pro Slack, independente do event
    await axios.post(SLACK_WEBHOOK_URL, {
      text: `🔔 *Evento recebido do Deskfy*\n*Tipo:* \`${event}\`\n\n*Payload completo:*\n\`\`\`${JSON.stringify(
        data,
        null,
        2
      )}\`\`\``
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar para o Slack:", error?.message || error);
    res.status(500).json({ error: "Erro ao enviar para o Slack" });
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000."));
