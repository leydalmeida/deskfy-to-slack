import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

app.post("/deskfy", async (req, res) => {
  const { event, data } = req.body;

  try {
    if (event === "NEW_TASK") {
      await axios.post(SLACK_WEBHOOK_URL, {
        text: `📌 *Nova tarefa criada!*\n*Título:* ${data.title}\n*Status:* ${data.status}\n*Autor:* ${data.author.name}`
      });
    }

    if (event === "UPDATE_TASK") {
      await axios.post(SLACK_WEBHOOK_URL, {
        text: `🔄 *Tarefa atualizada!*\n*Título:* ${data.title}\n*Novo status:* ${data.status}`
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao enviar para o Slack" });
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000."))
