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
    // Campos comuns
    // ------------------------------
    const title = data?.title?.trim() || "Sem título";
    const status = data?.status || "Sem status";

    // Tags (antes era "tipo de cardápio")
    const tagsList =
      Array.isArray(data?.tags) && data.tags.length > 0
        ? data.tags.join(", ")
        : "Nenhuma tag";

    // ------------------------------
    // EVENTO: NOVA TAREFA (briefing)
    // ------------------------------
    if (event === "NEW_TASK") {
      await sendToSlack(
        [
          "🆕 *Nova tarefa criada!*",
          `*️⃣ *Título:* ${title}`,
          `📌 *Status:* ${status}`,
          `🏷️ *Tags:* ${tagsList}`
        ].join("\n")
      );
    }

    // ---------------------------------------
    // EVENTO: ALTERAÇÃO EM TAREFA EXISTENTE
    // ---------------------------------------
    if (event === "UPDATE_TASK") {
      await sendToSlack(
        [
          "🔄 *Tarefa atualizada!*",
          `*️⃣ *Título:* ${title}`,
          `📌 *Novo status:* ${status}`,
          `🏷️ *Tags:* ${tagsList}`
        ].join("\n")
      );
    }

    // ------------------------------
    // NOVO COMENTÁRIO
    // ------------------------------
    if (event === "NEW_TASK_COMMENT") {
      const author = data?.author?.name || "Alguém";
      const taskTitle = data?.taskTitle?.trim() || title || "Tarefa";
      const comment = data?.comment || "(comentário vazio)";

      await sendToSlack(
        [
          `💬 *Novo comentário em:* ${taskTitle}`,
          `👤 *Autor:* ${author}`,
          `📝 *Comentário:* ${comment}`
        ].join("\n")
      );
    }

    // ------------------------------
    // BRIEFING ATUALIZADO
    // ------------------------------
    if (event === "UPDATE_BRIEFING") {
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
