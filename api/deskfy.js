import axios from "axios";

/**
 * Função auxiliar para ler/gravar no Redis via REST API (Upstash).
 */
const redis = {
  async get(key) {
    const url = `${process.env.UPSTASH_REDIS_REST_API_URL}/get/${key}`;
    const resp = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_API_TOKEN}`,
      },
    });
    return resp.data.result ? JSON.parse(resp.data.result) : null;
  },

  async set(key, value) {
    const url = `${process.env.UPSTASH_REDIS_REST_API_URL}/set/${key}`;
    await axios.post(
      url,
      JSON.stringify(value),
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  },
};

export default async function handler(req, res) {
  try {
    let data = req.body;

    if (!data || Object.keys(data).length === 0) {
      try {
        data = JSON.parse(req.body);
      } catch (e) {
        // ignora
      }
    }

    // Campos do Deskfy
    const jobId = data?.id || data?.job_id || null;
    const rawTitle = data?.name || data?.title || "";
    const designer = data?.author_name || "";
    const status = data?.status || "";
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

    // Titulo normalizado
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

    // Mensagem de log no canal principal
    const logText = [
      `*${titulo}*`,
      jobId ? `ID: ${jobId}` : null,
      `Status: *${statusTraduzido}*`,
      designer ? `Designer: ${designer}` : null,
      `Ação: ${action}`,
      `Mensagem: ${message || "-"}`,
    ]
      .filter(Boolean)
      .join("\n");

    await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: process.env.SLACK_CHANNEL_ORG_CARDAPIOS,
        text: logText,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Agora vamos criar/atualizar o card de lista
    await syncListCard({
      jobId,
      titulo,
      statusTraduzido,
      designer,
      message,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro no handler:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Criar/atualizar card na lista
 */
async function syncListCard({ jobId, titulo, statusTraduzido, designer, message }) {
  if (!jobId) return;

  const key = `deskfy:${jobId}`;

  const existing = await redis.get(key);

  const cardText = [
    `*${titulo}*`,
    `ID: ${jobId}`,
    `Status: *${statusTraduzido}*`,
    designer ? `Designer: ${designer}` : null,
    `Mensagem: ${message || "-"}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!existing) {
    // Criar card novo
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

    await redis.set(key, {
      channel: process.env.SLACK_CHANNEL_LISTA,
      ts: resp.data.ts,
    });

    return;
  }

  // Atualizar card existente
  await axios.post(
    "https://slack.com/api/chat.update",
    {
      channel: existing.channel,
      ts: existing.ts,
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
