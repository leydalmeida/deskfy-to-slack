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

    // Título
    const rawTitle = data?.title || "";
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
    // 🔥 FILTROS DE TÍTULO
    // ------------------------------

    const lowerTitle = title.toLowerCase();

    // 1. Bloquear títulos "sem título"
    if (lowerTitle === "sem título") {
      console.log("Ignorado: título vazio ou 'sem título'");
      return res.status(200).json({ ignored: "sem_titulo" });
    }

    // 2. Bloquear títulos que começam com GEO SP / MG / CO
    const blockedPrefixes = ["[geo sp]", "[geo mg]", "[geo co]"];
    const startsWithBlockedGeo = blockedPrefixes.some((prefix) =>
      lowerTitle.startsWith(prefix)
    );

    if (startsWithBlockedGeo) {
      console.log("Ignorado: GEO bloqueada no título → ", title);
      return res.status(200).json({ ignored: "geo_bloqueada" });
    }

    // ------------------------------
    // EVENTOS
    // ------------------------------

    if (event === "NEW_TASK") {
      await sendToSlack(
        [
          "🆕 *Nova tarefa criada!*",
          `*️⃣ *Título:* ${title}`,
          `📌 *Status:* ${status}`,
          `🏷️ *Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

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
      const taskTitle = data?.taskTitle?.trim() || title;

      await sendToSlack(
        [
          `💬 *Novo comentário em:* ${taskTitle}`,
          `👤 *Autor:* ${author}`,
          `📝 *Comentário:* ${comment}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    if (event === "UPDATE_BRIEFING") {
      await sendToSlack(
        [
          "📝 *Briefing atualizado!*",
          `*️⃣ *Tarefa:* ${title}`,
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
