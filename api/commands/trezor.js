/**
 * COMMAND HANDLER: Trezor - Management peněz
 * /trezor-info - Zobrazí stav kasy
 * /trezor-pohyb [typ] [akce] [částka] [důvod] - Zaznamená finanční operaci
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222'; // Kanál pro logy

// Typy peněz v trezoru
const PENÍZE_TYPY = {
  ciste: { label: 'Čisté peníze 💵', color: '#00AA00' },
  spinave: { label: 'Špinavé peníze 💸', color: '#FF7700' },
  vyprane: { label: 'Vyprané peníze 💷', color: '#0099FF' },
};

/**
 * Inicializace trezoru - musí se zavolat jednou
 */
export async function initTrezor() {
  const trezorKey = 'frakce:trezor';
  const existing = await kv.get(trezorKey);

  if (!existing) {
    await kv.set(trezorKey, {
      ciste: 0,
      spinave: 0,
      vyprane: 0,
      lastUpdate: new Date().toISOString(),
    });
    console.log('✅ Trezor inicializován');
  }
}

/**
 * Handler pro /trezor-info
 * Zobrazí aktuální stav všech peněz
 */
export async function handleTrezorInfo(res, interaction) {
  try {
    // Inicializace trezoru
    await initTrezor();

    // Načtení stavu z KV
    const trezorKey = 'frakce:trezor';
    const trezor = await kv.get(trezorKey);

    if (!trezor) {
      return res.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [createErrorEmbed('Trezor není inicializován')],
        },
      });
    }

    // Výpočet celkových peněz
    const celkem = trezor.ciste + trezor.spinave + trezor.vyprane;

    // Vytvoření Embed zprávy
    const trezorEmbed = createEmbed(
      '💰 STAV TREZORU',
      `
      **FINANČNÍ PŘEHLED FRAKCE**
      
      Poslední aktualizace: ${trezor.lastUpdate}
      `,
      '#8B0000'
    );

    // Přidání polí s jednotlivými typy
    trezorEmbed.fields = [
      {
        name: '✅ Čisté peníze (Legální)',
        value: `\`\`\`${trezor.ciste.toLocaleString('cs-CZ')} Kč\`\`\``,
        inline: true,
      },
      {
        name: '🔴 Špinavé peníze (Nelegální)',
        value: `\`\`\`${trezor.spinave.toLocaleString('cs-CZ')} Kč\`\`\``,
        inline: true,
      },
      {
        name: '💎 Vyprané peníze (Legalizované)',
        value: `\`\`\`${trezor.vyprane.toLocaleString('cs-CZ')} Kč\`\`\``,
        inline: true,
      },
      {
        name: '📊 CELKEM',
        value: `\`\`\`${celkem.toLocaleString('cs-CZ')} Kč\`\`\``,
        inline: false,
      },
      {
        name: '📈 Podíl peněz',
        value: `
        • Čisté: ${((trezor.ciste / celkem) * 100).toFixed(1)}%
        • Špinavé: ${((trezor.spinave / celkem) * 100).toFixed(1)}%
        • Vyprané: ${((trezor.vyprane / celkem) * 100).toFixed(1)}%
        `,
        inline: false,
      },
      {
        name: '⚠️ Varování',
        value: 'Udržuj špinavé peníze pod kontrolou! Příliš mnoho jich může přivolat pozornost policie.',
        inline: false,
      },
    ];

    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [trezorEmbed],
      },
    });
  } catch (error) {
    console.error('❌ Chyba u trezoru:', error);
    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
      },
    });
  }
}

/**
 * Handler pro /trezor-pohyb
 * Zaznamená finanční operaci
 */
export async function handleTrezorPohyb(res, interaction) {
  // Defer - dlouhá operace s databází
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    await initTrezor();

    const { data, user } = interaction;

    // Extrakce parametrů
    const typ = data.options.find((opt) => opt.name === 'typ')?.value; // ciste/spinave/vyprane
    const akce = data.options.find((opt) => opt.name === 'akce')?.value; // vklad/vyber
    const castka = parseInt(data.options.find((opt) => opt.name === 'castka')?.value);
    const duvod = data.options.find((opt) => opt.name === 'duvod')?.value;

    // Validace
    if (!typ || !akce || !castka || !duvod) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Chybějí povinné parametry')],
      });
    }

    if (castka <= 0) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Částka musí být větší než 0')],
      });
    }

    // Načtení trezoru
    const trezorKey = 'frakce:trezor';
    const trezor = await kv.get(trezorKey);

    // Kontrola dostupnosti peněz při výběru
    if (akce === 'vyber' && trezor[typ] < castka) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Není dost ${PENÍZE_TYPY[typ].label}!\nDostupné: ${trezor[typ].toLocaleString('cs-CZ')} Kč`)],
      });
    }

    // Provádění operace
    if (akce === 'vklad') {
      trezor[typ] += castka;
    } else if (akce === 'vyber') {
      trezor[typ] -= castka;
    }

    // Aktualizace času
    trezor.lastUpdate = new Date().toISOString();

    // Uložení zpět do KV
    await kv.set(trezorKey, trezor);

    // Logování do kanálu
    const logEmbed = createEmbed(
      `${akce === 'vklad' ? '➕ VKLAD' : '➖ VÝBĚR'}`,
      `
      **${user.username}** provedl operaci s ${PENÍZE_TYPY[typ].label}
      
      Akce: ${akce === 'vklad' ? 'Vklad ➕' : 'Výběr ➖'}
      Typ: ${PENÍZE_TYPY[typ].label}
      Částka: ${castka.toLocaleString('cs-CZ')} Kč
      Důvod: ${duvod}
      
      Nový stav: ${trezor[typ].toLocaleString('cs-CZ')} Kč
      `,
      PENÍZE_TYPY[typ].color
    );

    await sendMessageToChannel(LOGS_CHANNEL_ID, {
      embeds: [logEmbed],
    });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      `${akce === 'vklad' ? 'VKLAD PŘIJAT' : 'VÝBĚR SCHVÁLEN'}`,
      `
      ✅ Operace byla úspěšně provedena
      
      **Typ:** ${PENÍZE_TYPY[typ].label}
      **Akce:** ${akce === 'vklad' ? 'Vklad ➕' : 'Výběr ➖'}
      **Částka:** ${castka.toLocaleString('cs-CZ')} Kč
      **Důvod:** ${duvod}
      
      **Nový stav ${typ}:** ${trezor[typ].toLocaleString('cs-CZ')} Kč
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u trezoru-pohybu:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Konverze peněz mezi typy
 * /trezor-konverze [z_typu] [na_typ] [castka]
 */
export async function convertPeníze(zTypu, naTyp, castka) {
  await initTrezor();

  const trezorKey = 'frakce:trezor';
  const trezor = await kv.get(trezorKey);

  if (trezor[zTypu] < castka) {
    return { error: `Není dost ${zTypu}` };
  }

  trezor[zTypu] -= castka;
  trezor[naTyp] += castka;
  trezor.lastUpdate = new Date().toISOString();

  await kv.set(trezorKey, trezor);

  return { success: true, trezor };
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
