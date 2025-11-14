import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function sendToSlack(text) {
  await axios.post(SLACK_WEBHOOK_URL, { text });
}

app.post("/deskfy", async (req, res) => {
  const { event, data } = req.body;

  console.log("Evento recebido:", event);

  try {
    // ------------------------------
    // CAMPOS PADRÃO
    // ------------------------------

    // Título (Deskfy às vezes manda title, às vezes taskTitle)
    const rawTitle = data?.title || data?.taskTitle || "Sem título";
    const title = rawTitle.trim();

    // Status
    const status = data?.status || "Sem status";

    // Tags
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const tagsList = tags.length > 0 ? tags.join(", ") : "Nenhuma tag";

    // ID da tarefa — Deskfy manda de formas diferentes
    const taskId =
      data?.id ||
      data?.taskId ||
      data?.task?.id ||
      null;

    // Link correto
    const taskUrl = taskId
      ? `https://app.deskfy.io/workflow/home?createRequest=&request=${taskId}`
      : null;

    // ------------------------------
    // FORMATAÇÕES POR EVENTO
    // ------------------------------

    // NOVA TAREFA
    if (event === "NEW_TASK") {
      await sendToSlack(
        [
          "🆕 *Nova tarefa criada!*",
          `*Título:* ${title}`,
          `*Status:* ${status}`,
          `*Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    // ATUALIZAÇÃO DE TAREFA
    if (event === "UPDATE_TASK") {
      await sendToSlack(
        [
          "🔄 *Tarefa atualizada!*",
          `*Título:* ${title}`,
          `*Novo status:* ${status}`,
          `*Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    // NOVO COMENTÁRIO
    if (event === "NEW_TASK_COMMENT") {
      const author = data?.author?.name || "Alguém";
      const comment = data?.comment || "(sem conteúdo)";

      await sendToSlack(
        [
          "💬 *Novo comentário em tarefa!*",
          `*Título:* ${title}`,
          `*Autor:* ${author}`,
          `*Comentário:* ${comment}`,
          `*Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    // BRIEFING ATUALIZADO
    if (event === "UPDATE_BRIEFING") {
      await sendToSlack(
        [
          "📝 *Briefing atualizado!*",
          `*Título:* ${title}`,
          `*Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Erro ao enviar pro Slack:", error);
    res.status(500).json({ error: "Erro ao enviar pro Slack" });
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000."));
