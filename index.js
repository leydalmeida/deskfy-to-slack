import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function sendToSlack(text) {
  await axios.post(SLACK_WEBHOOK_URL, { text });
}

app.post("/deskfy", async (req, res) => {
  console.log("Webhook bruto recebido:", req.body);

  try {
    await sendToSlack(
      [
        "🔔 *Evento recebido do Deskfy*",
        `\`\`\`${JSON.stringify(req.body, null, 2)}\`\`\``
      ].join("\n")
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar para o Slack:", error?.message || error);
    res.status(500).json({ error: "Erro ao enviar para o Slack" });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000.");
});
