import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Função helper para enviar para o Slack
async function sendToSlack(text) {
  await axios.post(SLACK_WEBHOOK_URL, { text });
}

app.post("/deskfy", async (req, res) => {
  const { event, data } = req.body;

  console.log("Webhook recebido:", event);

  try {
    // ------------------------------
    // EVENTO: NOVA TAREFA (briefing)
    // ------------------------------
    if (event === "NEW_TASK") {
      const title = data?.title || "Sem título";
      await sendToSlack(
        `🆕 *Nova tarefa criada!*\n*️⃣ *Título:* ${title}\n📌 *Status:* ${data?.status}`
      );
    }

    // ---------------------------------------
    // EVENTO: ALTERAÇÃO EM TAREFA EXISTENTE
    // ---------------------------------------
    if (event === "UPDATE_TASK") {
      const title = data?.title || "Sem título";
      const status = data?.status || "Sem status";

      await sendToSlack(
        `🔄 *Tarefa atualizada!*\n*️⃣ *Título:* ${title}\n📌 *Novo status:* ${status}`
      );
    }

    // ------------------------------
    // NOVO COMENTÁRIO
    // ------------------------------
    if (event === "NEW_TASK_COMMENT") {
      const author = data?.author?.name || "Alguém";
      const title = data?.taskTitle || "Tarefa";

      await sendToSlack(
        `💬 *Novo comentário em:* ${title}\n👤 *Autor:* ${author}\n📝 *Comentário:* ${data?.comment}`
      );
    }

    // ------------------------------
    // BRIEFING ALTERADO
    // ------------------------------
    if (event === "UPDATE_BRIEFING") {
      const title = data?.title || "Sem título";

      await sendToSlack(
        `📝 *Briefing atualizado!*\n*️⃣ *Tarefa:* ${title}`
      );
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar para o Slack:", error);
    res.status(500).json({ error: "Erro ao enviar para o Slack" });
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000."));
