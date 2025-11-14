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

    // Título: usa title e, se não tiver, taskTitle (comentário)
    const rawTitle = data?.title || data?.taskTitle || "";
    const title = rawTitle.trim() || "Sem título";

    // Status
    const status = data?.status || "Sem status";

    // Tags
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const tagsList = tags.length > 0 ? tags.join(", ") : "Nenhuma tag";

    // GEOs permitidas (por TAG)
    const allowedGeoTags = ["GEO NO", "GEO NE", "GEO RJ", "GEO SUL"];
    const hasAllowedGeoTag = tags.some((tag) => allowedGeoTags.includes(tag));

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
    // 1) IGNORAR COMPLETAMENTE NEW_TASK
    // ------------------------------
    if (event === "NEW_TASK") {
      console.log("Ignorado: evento NEW_TASK (Nova tarefa criada)");
      return res.status(200).json({ ignored: "new_task" });
    }

    // ------------------------------
    // 2) EVENTOS DE STATUS / BRIEFING
    //    → filtram por GEO NO TÍTULO
    // ------------------------------
    if (event === "UPDATE_TASK" || event === "UPDATE_BRIEFING") {
      const lowerTitle = title.toLowerCase();

      // bloquear 'sem título' nesses eventos
      if (lowerTitle === "sem título") {
        console.log("Ignorado: título 'Sem título' em UPDATE_*");
        return res.status(200).json({ ignored: "sem_titulo" });
      }

      const allowedPrefixes = [
        "[geo no]",
        "[geo ne]",
        "[geo rj]",
        "[geo sul]"
      ];

      const startsWithAllowedGeo = allowedPrefixes.some((prefix) =>
        lowerTitle.startsWith(prefix)
      );

      if (!startsWithAllowedGeo) {
        console.log("Ignorado UPDATE_*: GEO não permitida no título →", title);
        return res.status(200).json({ ignored: "geo_nao_permitida" });
      }

      // Se passou pelos filtros, envia:
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

      return res.status(200).json({ ok: true });
    }

    // ------------------------------
    // 3) NEW_TASK_COMMENT
    //    → filtra por GEO NAS TAGS, não no título
    // ------------------------------
    if (event === "NEW_TASK_COMMENT") {
      // Se não tiver geo permitida nas tags, ignora comentário
      if (!hasAllowedGeoTag) {
        console.log("Ignorado COMMENT: GEO não permitida nas tags →", tags);
        return res.status(200).json({ ignored: "geo_tags_nao_permitida" });
      }

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

      return res.status(200).json({ ok: true });
    }

    // Se for outro evento qualquer que não tratamos:
    console.log("Evento não tratado:", event);
    res.status(200).json({ ok: true, ignored: "evento_nao_tratado" });
  } catch (error) {
    console.error("Erro ao enviar para o Slack:", error);
    res.status(500).json({ error: "Erro ao enviar para o Slack" });
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000."));
