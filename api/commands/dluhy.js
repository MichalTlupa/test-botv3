/**
 * COMMAND HANDLER: Dlužníci - Tracking lidí zvenčí, co nám dluží
 * /dluh-pridat [jmeno_ic] [castka] [datum_splatnosti] [kontakt]
 * /dluh-list - Zobrazí seznam dlužníků
 * /dluh-smazat [jmeno_ic] - Smaže dlužníka po zaplacení
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222';

/**
 * Handler pro /dluh-pridat
 * Přidání nového dlužníka do databáze
 */
export async function handleDluhPridat(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user } = interaction;

    const jmeno = data.options.find((opt) => opt.name === 'jmeno_ic')?.value;
    const castka = parseInt(data.options.find((opt) => opt.name === 'castka')?.value);
    const datumSplatnosti = data.options.find((opt) => opt.name === 'datum_splatnosti')?.value;
    const kontakt = data.options.find((opt) => opt.name === 'kontakt')?.value;

    // Validace
    if (!jmeno || !castka || !datumSplatnosti || !kontakt) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Chybějí povinné parametry')],
      });
    }

    if (castka <= 0) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Částka musí být větší než 0')],
      });
    }

    // Kontrola, zda dlužník již existuje
    const dluhKey = `dluznik:${jmeno.toLowerCase()}`;
    const existing = await kv.get(dluhKey);

    if (existing) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Dlužník ${jmeno} již existuje v databázi`)],
      });
    }

    // Vytvoření záznamu
    const dluznikData = {
      jmeno: jmeno,
      castka: castka,
      datumSplatnosti: datumSplatnosti,
      kontakt: kontakt,
      vytvorenoDne: new Date().toISOString(),
      vytvorenilUzivatelem: user.username,
      status: 'aktivni',
    };

    // Uložení do KV
    await kv.set(dluhKey, dluznikData, { ex: 7776000 }); // 90 dní

    // Přidání do indexu (seznam všech dlužníků)
    const indexKey = 'dluhy:index';
    let index = await kv.get(indexKey);
    if (!index) index = [];
    index.push(jmeno.toLowerCase());
    await kv.set(indexKey, index);

    // Logování
    const logEmbed = createEmbed(
      '📋 NOVÝ DLUŽNÍK PŘIDÁN',
      `
      **${user.username}** přidal nového dlužníka
      
      Jméno/IC: ${jmeno}
      Dlužená částka: ${castka.toLocaleString('cs-CZ')} Kč
      Datum splatnosti: ${datumSplatnosti}
      Kontakt: ${kontakt}
      `,
      '#FF0000'
    );

    await sendMessageToChannel(LOGS_CHANNEL_ID, { embeds: [logEmbed] });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      'DLUŽNÍK PŘIDÁN',
      `
      ✅ Nový dlužník byl zaregistrován
      
      **Jméno/IC:** ${jmeno}
      **Dluh:** ${castka.toLocaleString('cs-CZ')} Kč
      **Splatnost:** ${datumSplatnosti}
      **Kontakt:** ${kontakt}
      
      📌 Nezapomeň ho později navštívit!
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u dluh-pridat:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro /dluh-list
 * Zobrazí seznam všech dlužníků
 */
export async function handleDluhList(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    // Načtení indexu
    const indexKey = 'dluhy:index';
    const index = await kv.get(indexKey);

    if (!index || index.length === 0) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createEmbed('📋 SEZNAM DLUŽNÍKŮ', 'Žádní dlužníci v databázi', '#8B0000')],
      });
    }

    // Načtení všech dlužníků
    const dluznici = [];
    const dnesDatum = new Date();

    for (const dluznikId of index) {
      const dluhKey = `dluznik:${dluznikId}`;
      const dluznik = await kv.get(dluhKey);
      if (dluznik && dluznik.status !== 'smazan') {
        dluznici.push(dluznik);
      }
    }

    // Seřazení podle data splatnosti
    dluznici.sort((a, b) => new Date(a.datumSplatnosti) - new Date(b.datumSplatnosti));

    // Vytvoření Embed zprávy
    const seznamEmbed = createEmbed(
      '📋 SEZNAM DLUŽNÍKŮ',
      `
      **SLEDOVÁNÍ DLUHŮ**
      Počet dlužníků: ${dluznici.length}
      `,
      '#8B0000'
    );

    const fields = [];
    let celkovyDluh = 0;

    dluznici.forEach((d) => {
      const datumSplat = new Date(d.datumSplatnosti);
      const poSplatnosti = datumSplat < dnesDatum;

      const icon = poSplatnosti ? '🔴' : '🟠';
      const status = poSplatnosti ? ' ⚠️ PO SPLATNOSTI!' : '';

      fields.push({
        name: `${icon} ${d.jmeno}`,
        value: `
        💰 Dluh: ${d.castka.toLocaleString('cs-CZ')} Kč
        📅 Splatnost: ${d.datumSplatnosti}${status}
        📞 Kontakt: ${d.kontakt}
        `,
        inline: false,
      });

      celkovyDluh += d.castka;
    });

    // Přidání sumáře
    fields.push({
      name: '💰 CELKOVÝ DLUH',
      value: `${celkovyDluh.toLocaleString('cs-CZ')} Kč`,
      inline: false,
    });

    fields.push({
      name: '⚠️ VAROVÁNÍ',
      value: 'Členy se RED statusem (🔴) je třeba "navštívit" a vybrat jejich dluh!',
      inline: false,
    });

    seznamEmbed.fields = fields;

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [seznamEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u dluh-list:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro /dluh-smazat
 * Smaže dlužníka z databáze po zaplacení
 */
export async function handleDluhSmazat(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user } = interaction;

    const jmeno = data.options.find((opt) => opt.name === 'jmeno_ic')?.value;

    if (!jmeno) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Musíš zadat jméno/IC dlužníka')],
      });
    }

    // Hledání dlužníka
    const dluhKey = `dluznik:${jmeno.toLowerCase()}`;
    const dluznik = await kv.get(dluhKey);

    if (!dluznik) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Dlužník ${jmeno} nenalezen`)],
      });
    }

    // Smazání ze seznamu
    const indexKey = 'dluhy:index';
    let index = await kv.get(indexKey);
    index = index.filter((id) => id !== jmeno.toLowerCase());
    await kv.set(indexKey, index);

    // Označení jako smazaného
    dluznik.status = 'smazan';
    dluznik.smazanDne = new Date().toISOString();
    dluznik.smazanUzivatelem = user.username;
    await kv.set(dluhKey, dluznik);

    // Logování - splacení
    const logEmbed = createEmbed(
      '✅ DLUH SPLACEN',
      `
      **${user.username}** označil dluh jako splacený
      
      Dlužník: ${dluznik.jmeno}
      Částka: ${dluznik.castka.toLocaleString('cs-CZ')} Kč
      Původní splatnost: ${dluznik.datumSplatnosti}
      `,
      '#00AA00'
    );

    await sendMessageToChannel(LOGS_CHANNEL_ID, { embeds: [logEmbed] });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      'DLUH SMAZÁN',
      `
      ✅ Dlužník ${dluznik.jmeno} byl odstraněn z evidence
      
      **Částka která byla splacena:** ${dluznik.castka.toLocaleString('cs-CZ')} Kč
      
      Dobrá robota! Frakce получит svoje peníze.
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u dluh-smazat:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

// Pomocné funkce
async function sendMessageToChannel(channelId, messageData) {
  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageData),
  });
}

async function sendFollowup(token, interactionToken, messageData) {
  const url = `https://discord.com/api/v10/webhooks/${token}/${interactionToken}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messageData),
  });
}
