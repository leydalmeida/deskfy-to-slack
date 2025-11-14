import { kv } from "@vercel/kv";
import axios from "axios";

export default async function handler(req, res) {
  try {
    // Se vier string, converte pra JSON
    let data = req.body;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (error) {
        console.error("Erro ao parsear JSON:", error);
      }
    }

    // Extrai campos do Deskfy
    const jobId = data?.id || data?.job_id || null;
    const rawTitle = data?.name || data?.title || "";
    const status = data?.status || "";
    const designer = data?.author_name || "";
    const message = data?.message || "";
    const action = data?.event || "update";

    // Filtros de GEO
    const geoBloqueados = ["GEO CO", "GEO SP", "GEO MG", "CDD"];
    if (geoBloqueados.some((g) => rawTitle.includes(g))) {
      return res.status(200).json({ ok: true, reason: "GEO bloqueado" });
    }

    // Bloqueio de autores
    const bloqueados = [
      "Designer - Thaynara Moreira",
      "Luiz Augusto Albuquerque (Printa)",
      "Designer/Gráfica - Caio Otto (Printa)",
    ];
    if (bloqueados.some((n) => designer.includes(n))) {
      return res.status(200).json({ ok: true, reason: "Autor bloqueado" });
    }

    // Título tratado
    const titulo =
      rawTitle?.trim() || (jobId ? `Tarefa #${jobId}` : "Tarefa sem título");

    // Tradução de status
    const statusTraduzido =
      {
        WAITING_USER_ADJUST: "Aguardando ajustes",
        WAITING_APPROVAL: "Aguardando aprovação",
        IN_PROGRESS: "Em produção",
        FINISHED: "Finalizado",
        DELIVERED: "Entregue",
      }[status] || status || "Sem status";

    // Mensagem de log
    const slackText = [
      `*${titulo}*`,
      jobId ? `ID: ${jobId}` : null,
      `Status: *${statusTraduzido}*`,
      designer ? `Designer: ${designer}` : null,
      `Ação: ${action}`,
      `Mensagem: ${message || "-"}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Envia para o canal de LOG
    await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: process.env.SLACK_CHANNEL_ORG_CARDAPIOS,
        text: slackText,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Envia/atualiza card na lista
    await syncListCard({
      jobId,
      titulo,
      status: statusTraduzido,
      designer,
      message,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro geral:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ===============================
// CARD DA LISTA (CRUD by ID)
// ===============================
async function syncListCard({ jobId, titulo, status, designer, message }) {
  if (!jobId) {
    console.log("Sem jobId, não criar/atualizar card.");
    return;
  }

  const key = `deskfy:${jobId}`;

  const existing = await kv.get(key);

  const cardText = [
    `*${titulo}*`,
    `ID: ${jobId}`,
    `Status: *${status}*`,
    designer ? `Designer: ${designer}` : null,
    `Mensagem: ${message || "-"}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!existing) {
    // Criar card
    const resp = await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: process.env.SLACK_CHANNEL_LISTA,
        text: cardText,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const created = resp.data;

    if (!created.ok) {
      console.error("Erro ao criar card:", created);
      return;
    }

    // Salva onde está o card
    await kv.set(key, {
      channel: process.env.SLACK_CHANNEL_LISTA,
      ts: created.ts,
    });
  } else {
    // Atualizar card
    const { channel, ts } = existing;

    await axios.post(
      "https://slack.com/api/chat.update",
      {
        channel,
        ts,
        text: cardText,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  }
}
