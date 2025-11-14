const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  try {
    // Garante que o body esteja em objeto JS
    let data = req.body;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error("Erro ao parsear body:", e);
      }
    }

    // 1. Extrair campos importantes (ajuste os nomes conforme o payload real do Deskfy)
    const jobId = data?.id || data?.job_id || null;
    const rawTitle = data?.name || data?.title || "";
    const status = data?.status || "";
    const designer = data?.author_name || "";
    const message = data?.message || "";
    const action = data?.event || "update";

    // 2. Filtros de GEO (bloqueados)
    const geoBloqueados = ["GEO CO", "GEO SP", "GEO MG", "CDD"];
    if (geoBloqueados.some(g => rawTitle.includes(g))) {
      return res.status(200).json({ ok: true, reason: "GEO bloqueado" });
    }

    // 3. Bloqueio de autores específicos
    const bloqueados = [
      "Designer - Thaynara Moreira",
      "Luiz Augusto Albuquerque (Printa)",
      "Designer/Gráfica - Caio Otto (Printa)"
    ];
    if (bloqueados.some(n => designer.includes(n))) {
      return res.status(200).json({ ok: true, reason: "Autor bloqueado" });
    }

    // 4. Título bonitinho
    const titulo =
      (rawTitle && rawTitle.trim()) ||
      (jobId ? `Tarefa #${jobId}` : "Tarefa sem título");

    // 5. Traduzir status
    const statusTraduzido =
      {
        WAITING_USER_ADJUST: "Aguardando ajustes",
        WAITING_APPROVAL: "Aguardando aprovação",
        IN_PROGRESS: "Em produção",
        FINISHED: "Finalizado",
        DELIVERED: "Entregue",
      }[status] || status || "Sem status";

    // 6. Montar texto padrão para o canal de log
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

    // 7. Enviar mensagem de LOG para #org-cardapios
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: process.env.SLACK_CHANNEL_ORG_CARDAPIOS,
        text: slackText,
      }),
    });

    // 8. Criar/atualizar CARD na lista (canal de cards)
    await syncListCard({
      jobId,
      titulo,
      status: statusTraduzido,
      designer,
      message,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

// ==========================
// Função que cuida da "lista"
// ==========================
async function syncListCard({ jobId, titulo, status, designer, message }) {
  if (!jobId) {
    console.log("Sem jobId, não vou criar/atualizar card.");
    return;
  }

  const key = `deskfy:${jobId}`;
  const existing = await kv.get(key);

  const text = [
    `*${titulo}*`,
    `ID: ${jobId}`,
    `Status: *${status}*`,
    designer ? `Designer: ${designer}` : null,
    `Mensagem: ${message || "-"}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!existing) {
    // -------- CARD NOVO --------
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: process.env.SLACK_CHANNEL_LISTA,
        text,
      }),
    }).then((r) => r.json());

    if (!response.ok) {
      console.error("Erro ao criar card na lista:", response);
      return;
    }

    // Salva para atualizar depois (canal + ts da mensagem)
    await kv.set(key, {
      channel: process.env.SLACK_CHANNEL_LISTA,
      ts: response.ts,
    });
  } else {
    // -------- ATUALIZAR CARD EXISTENTE --------
    const { channel, ts } = existing;

    await fetch("https://slack.com/api/chat.update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channel || process.env.SLACK_CHANNEL_LISTA,
        ts,
        text,
      }),
    });
  }
}
