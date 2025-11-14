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

  console.log("Webhook recebido:", event, data);

  try {
    // ------------------------------
    // CAMPOS COMUNS
    // ------------------------------

    // Título (Deskfy pode mandar title OU taskTitle)
    const rawTitle = data?.title || data?.taskTitle || "Sem título";
    const title = rawTitle.trim() || "Sem título";

    // Status (às vezes não vem)
    const status = data?.status || "Sem status";

    // Tags (pode vir vazio ou undefined)
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const tagsList = tags.length > 0 ? tags.join(", ") : "Nenhuma tag";

    // Task ID (Deskfy envia de várias formas)
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
    // EVENTOS
    // ------------------------------

    // 1) NOVA TAREFA
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

    // 2) TAREFA ATUALIZADA
    if (event === "UPDATE_TASK") {
      await sendToSlack(
        [
          "🔄 *Tarefa atual*
