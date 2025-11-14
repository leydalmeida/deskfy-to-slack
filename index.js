import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Cache de títulos para comentários sem título
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

    const taskUrl = taskId
      ? `https://app.deskfy.io/workflow/home?createRequest=&request=${taskId}`
      : null;

    // ------------------------------
    // TÍTULO COM CACHE + ID COMO BACKUP
    // ------------------------------

    let rawTitle = data?.title || data?.taskTitle || "";

    if (rawTitle.trim()) {
      titleCache[taskId] = rawTitle.trim();
    }

    const title =
      rawTitle.trim() ||
      titleCache[taskId] ||
      (taskId ? `Tarefa ${taskId}` : "Sem título");

    const lowerTitle = title.toLowerCase();

    // ------------------------------
    // TAGS
    // ------------------------------

    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const tagsList = tags.length > 0 ? tags.join(", ") : "Nenhuma tag";

    // ------------------------------
    // STATUS + TRADUÇÕES
    // ------------------------------

    const status = data?.status || "Sem status";

    const statusMap = {
      INBOX: "Entrada",
      PROGRESS: "Em produção",
      REVIEW: "Em revisão",
      APPROVED: "Aprovado",
      DONE: "Concluído",
      ARCHIVED: "Arquivado",
      CANCELED: "Cancelado",
      STANDBY: "Em espera",

      WAITING_USER_ADJUST: "Aguardando ajustes",
      AWAITING_USER_APPROVAL: "Aguardando aprovação do cliente",
      AWAITING_USER_FEEDBACK: "Aguardando feedback do cliente",

      DESIGNING: "Design em andamento",
      REVISION_DESIGN: "Revisão interna",
      SENT_TO_REVIEW: "Enviado para revisão",
      PENDING_INFORMATION: "Aguardando informações",
      EDITING: "Ajustando arte",

      ON_HOLD: "Pausado",
      REJECTED: "Rejeitado",
      RETURNED: "Devolvido ao designer",
      NEEDS_APPROVAL: "Requer aprovação",
      QUALITY_CHECK: "Controle de qualidade"
    };

    const statusTranslated = statusMap[status] || status;

    // ------------------------------
    // ❌ FILTRO: BLOQUEAR GEOS PROIBIDAS
    // ------------------------------

    const forbiddenStrings = ["geo co", "geo sp", "geo mg", "cdd"];

    const containsForbidden = forbiddenStrings.some((txt) =>
      lowerTitle.includes(txt)
    );

    if (containsForbidden) {
      console.log("Ignorado por GEO proibida →", title);
      return res.status(200).json({ ignored: "geo_forbidden" });
    }

    // ------------------------------
    // EVENTOS
    // ------------------------------

    // 🆕 NOVA TAREFA
    if (event === "NEW_TASK") {
      await sendToSlack(
        [
          "🆕 *Nova tarefa criada!*",
          `*Título:* ${title}`,
          `*Status:* ${statusTranslated}`,
          `*Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    // 🔄 ATUALIZAÇÃO DE TAREFA
    if (event === "UPDATE_TASK") {
      await sendToSlack(
        [
          "🔄 *Tarefa atualizada!*",
          `*Título:* ${title}`,
          `*Novo status:* ${statusTranslated}`,
          `*Tags:* ${tagsList}`,
          taskUrl ? `🔗 <${taskUrl}|Abrir tarefa>` : ""
        ].join("\n")
      );
    }

    // 💬 NOVO COMENTÁRIO
    if (event === "NEW_TASK_COMMENT") {

      const author = data?.author?.name || "Alguém";

      // ❌ BLOQUEAR QUALQUER AUTOR COM "(Printa)" NO NOME
      if (author.toLowerCase().includes("(printa)")) {
        console.log("Ignorado: comentário de autor bloqueado (Printa) →", author);
        return res.status(200).json({ ignored: "comment_blocked_printa" });
      }

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

    // 📝 BRIEFING ATUALIZADO
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
    res.status(
