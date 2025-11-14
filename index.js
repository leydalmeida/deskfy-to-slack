import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Enviar mensagem ao Slack
async function sendToSlack(text) {
  await axios.post(SLACK_WEBHOOK_URL, { text });
}

app.post("/deskfy", async (req, res) => {
  const { event, data } = req.body;

  console.log("Webhook recebido:", event);

  try {
    // ------------------------------
    // CAMPOS COMUNS
    // ------------------------------

    // Título bruto + tratado
    // Agora usamos taskTitle como fallback pra suportar NEW_TASK_COMMENT
    const rawTitle = data?.title || data?.taskTitle || "";
    const title = rawTitle.trim() || "Sem título";

    // Status
    const status = data?.status || "Sem status";

    // Tags
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const tagsList = tags.length > 0 ? tags.join(", ") : "Nenhuma tag";

    // ID da tarefa
    const taskId =
      data?.id ||
      data?.taskId ||
      data?.task?.id ||
      null;

    // Link oficial da tarefa
    const taskUrl = taskId
      ? `https://app.deskfy.io/workflow/home?createRequest=&request=${taskId}`
      : null;

    // ------------------------------
    // 🔥 FILTRAGEM POR GEO NO TÍTULO
    // ------------------------------

    const lowerTitle = title.toLowerCase();

    // GEOs permitidas
    const allowedPrefixes = [
      "[geo no]",
      "[geo ne]",
      "[geo rj]",
      "[geo sul]"
    ];

    const startsWithAllowedGeo = allowedPrefixes.some((prefix) =>
      lowerTitle.startsWith(prefix)
    );

    // Se o título NÃO começar com uma GEO permitida → ignora tudo
    if (!startsWithAllowedGeo) {
      console.log("Ignorado: GEO não permitida no título →", title);
      return res.status(200).json({ ignored: "geo_nao_permitida" });
    }

    // ------------------------------
    // IGNORAR COMPLETAMENTE NEW_TASK
    // ------------------------------
    if (event === "NEW_TASK") {
      console.log("Ignorado: evento NEW_TASK (Nova tarefa criada)");
      return res.status(200).json({ ignored: "new_task" });
    }

    // ------------------------------
    // EVENTOS QUE VAMOS ENVIAR
    // ------------------------------

    if (event === "UPDATE_TASK") {
      await sendToSlack(
        [
          "🔄 *Tarefa atualizada!*",
          `*️⃣ *Título:* ${title}`,
          `📌 *Novo status:* ${status}`,
          `🏷️ *Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    if (event === "NEW_TASK_COMMENT") {
      const author = data?.author?.name || "Alguém";
      const comment = data?.comment || "(comentário vazio)";

      await sendToSlack(
        [
          `💬 *Novo comentário em:* ${title}`,
          `👤 *Autor:* ${author}`,
          `📝 *Comentário:* ${comment}`,
          `🏷️ *Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    if (event === "UPDATE_BRIEFING") {
      await sendToSlack(
        [
          "📝 *Briefing atualizado!*",
          `*️⃣ *Tarefa:* ${title}`,
          `🏷️ *Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar para o Slack:", error);
    res.status(500).json({ error: "Erro ao enviar para o Slack" });
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000."));
