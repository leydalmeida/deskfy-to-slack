import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Guardar títulos reais por taskId
const titleCache = {};

async function sendToSlack(text) {
  await axios.post(SLACK_WEBHOOK_URL, { text });
}

app.post("/deskfy", async (req, res) => {
  const { event, data } = req.body;

  console.log("Evento recebido:", event);

  try {
    // ------------------------------
    // IDENTIFICAÇÃO DA TAREFA
    // ------------------------------

    const taskId =
      data?.id ||
      data?.taskId ||
      data?.task?.id ||
      null;

    const status = data?.status || "Sem status";

    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const tagsList = tags.length > 0 ? tags.join(", ") : "Nenhuma tag";

    const taskUrl = taskId
      ? `https://app.deskfy.io/workflow/home?createRequest=&request=${taskId}`
      : null;

    // ------------------------------
    // 🔥 TÍTULO — LÓGICA COMPLETA E ROBUSTA
    // ------------------------------

    // Tenta pegar título do Deskfy
    let rawTitle = data?.title || data?.taskTitle || "";

    // Se vier título válido → salva no cache
    if (rawTitle.trim()) {
      titleCache[taskId] = rawTitle.trim();
    }

    // Determina título final
    const title =
      (rawTitle.trim() ||
      titleCache[taskId] ||  // título já salvo de outro evento
      (taskId ? `Tarefa ${taskId}` : "Sem título"));  // <-- USAR ID COMO TÍTULO

    const lowerTitle = title.toLowerCase();

    // ------------------------------
    // ❌ FILTRO DE GEO PROIBIDA
    // ------------------------------

    const forbiddenStrings = ["geo co", "geo sp", "geo mg", "cdd"];

    const containsForbidden = forbiddenStrings.some((txt) =>
      lowerTitle.includes(txt)
    );

    if (containsForbidden) {
      console.log("Ignorado por filtro de GEO proibida →", title);
      return res.status(200).json({ ignored: "geo_forbidden" });
    }

    // ------------------------------
    // EVENTOS
    // ------------------------------

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
