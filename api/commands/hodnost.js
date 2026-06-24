/**
 * COMMAND HANDLER: Management členů - Systém hodností
 * /hodnost [uživatel] [set: Nováček/Ověřený/Elite/Vedení]
 * Interní systém hodností pro sledování hierarchie
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222';

// Hierarchie hodností
const HODNOSTI = {
  novaček: { label: '👶 Nováček', level: 1, popis: 'Nově přijatý člen. Bez zvláštních oprávnění.' },
  overeny: { label: '✅ Ověřený', level: 2, popis: 'Důvěryhodný člen. Má přístup k základním operacím.' },
  elite: { label: '⭐ Elite', level: 3, popis: 'Vysoko kvalifikovaný člen. Může vést malé operace.' },
  vedeni: { label: '👑 Vedení', level: 4, popis: 'Vedoucí člen. Má úplnou kontrolu.' },
};

/**
 * Handler pro /hodnost
 * Nastaví nebo zobrazí hodnost člena
 */
export async function handleHodnost(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user } = interaction;

    const targetUser = data.options.find((opt) => opt.name === 'uživatel')?.value;
    const novaHodnost = data.options.find((opt) => opt.name === 'hodnost')?.value;

    if (!targetUser) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Musíš zadat uživatele')],
      });
    }

    // Pokud nezadá hodnost - zobrazit aktuální
    if (!novaHodnost) {
      return await displayHodnost(res, interaction, targetUser);
    }

    // Validace hodnosti
    const hodnostData = HODNOSTI[novaHodnost.toLowerCase()];
    if (!hodnostData) {
      const dostupne = Object.keys(HODNOSTI).join(', ');
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Neznámá hodnost. Dostupné: ${dostupne}`)],
      });
    }

    // Načtení stávající hodnosti
    const hodnostKey = `clen:hodnost:${targetUser}`;
    const staraHodnost = await kv.get(hodnostKey);

    // Uložení nové hodnosti
    const hodnostRecord = {
      userId: targetUser,
      hodnost: novaHodnost.toLowerCase(),
      nastavenoKdy: new Date().toISOString(),
      nastavenoKym: user.username,
      level: hodnostData.level,
    };

    await kv.set(hodnostKey, hodnostRecord, { ex: 31536000 }); // 1 rok

    // Logování do kanálu
    const logEmbed = createEmbed(
      '📊 ZMĚNA HODNOSTI',
      `
      **${user.username}** změnil hodnost člena
      
      Uživatel: <@${targetUser}>
      Stará hodnost: ${staraHodnost ? HODNOSTI[staraHodnost.hodnost]?.label : '❓ Neurčena'} 
      Nová hodnost: ${hodnostData.label}
      `,
      '#0099FF'
    );

    await sendMessageToChannel(LOGS_CHANNEL_ID, { embeds: [logEmbed] });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      'HODNOST NASTAVENA',
      `
      ✅ Hodnost člena <@${targetUser}> byla změněna
      
      **Nová hodnost:** ${hodnostData.label}
      **Popis:** ${hodnostData.popis}
      **Úroveň:** ${hodnostData.level} z 4
      
      Gratulace!
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u hodnosti:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Zobrazení hodnosti člena
 */
async function displayHodnost(res, interaction, userId) {
  try {
    const hodnostKey = `clen:hodnost:${userId}`;
    const hodnostData = await kv.get(hodnostKey);

    if (!hodnostData) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createEmbed('👤 HODNOST ČLENA', `<@${userId}> nemá nastavenou hodnost\n\nHodnost musí nastavit vedení.`, '#8B0000')],
      });
    }

    const hodnostInfo = HODNOSTI[hodnostData.hodnost];

    const displayEmbed = createEmbed(
      '👤 HODNOST ČLENA',
      `
      **${hodnostInfo.label}**
      
      ${hodnostInfo.popis}
      
      Úroveň: ${'⭐'.repeat(hodnostInfo.level)}
      Nastaveno: ${new Date(hodnostData.nastavenoKdy).toLocaleDateString('cs-CZ')}
      Nastavil/a: ${hodnostData.nastavenoKym}
      `,
      '#0099FF'
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [displayEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u display hodnosti:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Kontrola úrovně člena
 * Vrací: level (1-4) nebo 0 pokud nemá hodnost
 */
export async function getHodnostLevel(userId) {
  const hodnostKey = `clen:hodnost:${userId}`;
  const data = await kv.get(hodnostKey);
  return data ? data.level : 0;
}

/**
 * Zobrazení hierarchie frakce
 */
export async function displayHierachie(res, interaction) {
  try {
    const hierarchieEmbed = createEmbed(
      '👑 HIERARCHIE FRAKCE',
      `
      **STRUKTURA MOCI V NAŠÍ FRAKCI**
      `,
      '#8B0000'
    );

    const fields = [];

    Object.entries(HODNOSTI).forEach(([key, data]) => {
      fields.push({
        name: data.label,
        value: `
        Úroveň: ${data.level}
        ${data.popis}
        `,
        inline: false,
      });
    });

    hierarchieEmbed.fields = fields;

    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [hierarchieEmbed],
      },
    });
  } catch (error) {
    console.error('❌ Chyba u hierarchie:', error);
    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
      },
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
