/**
 * COMMAND HANDLER: Blacklist - Nežádoucí osoby
 * /blacklist-add [jmeno_ic] [steam_hex/discord_id] [duvod]
 * /blacklist-list - Zobrazí seznam všech osob na blacklistu
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222';

// Důvody pro blacklist
const BLACKLIST_DUVODY = {
  zrada: '🗡️ Zrada - Spolupráce s nepřítelem',
  fical: '👮 Fízlování - Spolupráce s policií',
  kradzez: '💰 Krádež - Podvod nebo krádež od frakce',
  neplaceni: '💸 Neplacení - Dluh bez snahy splatit',
  soupet: '🔴 Nepříjemná osoba - Problematické chování',
  jine: '❓ Jiný důvod',
};

/**
 * Handler pro /blacklist-add
 * Přidání osoby na blacklist
 */
export async function handleBlacklistAdd(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user } = interaction;

    const jmeno = data.options.find((opt) => opt.name === 'jmeno_ic')?.value;
    const steam_discord = data.options.find((opt) => opt.name === 'steam_hex/discord_id')?.value;
    const duvod = data.options.find((opt) => opt.name === 'duvod')?.value;

    // Validace
    if (!jmeno || !steam_discord || !duvod) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Chybějí povinné parametry')],
      });
    }

    // Kontrola, zda osoba již není na blacklistu
    const blacklistKey = `blacklist:${jmeno.toLowerCase()}`;
    const existing = await kv.get(blacklistKey);

    if (existing && !existing.removed) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`${jmeno} je již na blacklistu!`)],
      });
    }

    // Vytvoření záznamu
    const blacklistData = {
      jmeno: jmeno,
      steam_discord: steam_discord,
      duvod: duvod,
      duvodLabel: BLACKLIST_DUVODY[duvod] || duvod,
      pridanDne: new Date().toISOString(),
      pridanUzivatelem: user.username,
      status: 'aktivni',
    };

    // Uložení do KV
    await kv.set(blacklistKey, blacklistData, { ex: 31536000 }); // 1 rok

    // Přidání do indexu
    const indexKey = 'blacklist:index';
    let index = await kv.get(indexKey);
    if (!index) index = [];
    if (!index.includes(jmeno.toLowerCase())) {
      index.push(jmeno.toLowerCase());
    }
    await kv.set(indexKey, index);

    // Velký alert
    const alertEmbed = createEmbed(
      '🚨 BLACKLIST ALERT 🚨',
      `
      **NOVÁ OSOBA NA BLACKLISTU**
      
      ⚠️ Všichni si to pozorně přečtěte! ⚠️
      
      Jméno/IC: ${jmeno}
      Steam/Discord: ${steam_discord}
      Důvod: ${BLACKLIST_DUVODY[duvod] || duvod}
      
      **PŘÍKAZ:** Tuto osobu IHNED blokovat. Žádný kontakt, žádná obchodování, žádné mercy.
      Pokud ji potkáš, okamžitě nahlaste vedení.
      `,
      '#8B0000'
    );

    // Logování do kanálu
    await sendMessageToChannel(LOGS_CHANNEL_ID, {
      content: '🚨 BLACKLIST ALERT - Všichni si to přečtěte!',
      embeds: [alertEmbed],
    });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      'OSOBA PŘIDÁNA NA BLACKLIST',
      `
      ✅ ${jmeno} byl/a přidána na černou listinu
      
      **Jméno/IC:** ${jmeno}
      **Steam/Discord:** ${steam_discord}
      **Důvod:** ${BLACKLIST_DUVODY[duvod] || duvod}
      
      Alert byl poslán do chatu. Všichni nyní vědí, aby s touto osobou nekomunikovali.
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u blacklist-add:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro /blacklist-list
 * Zobrazí seznam všech osob na blacklistu
 */
export async function handleBlacklistList(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    // Načtení indexu
    const indexKey = 'blacklist:index';
    const index = await kv.get(indexKey);

    if (!index || index.length === 0) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createEmbed('🚫 BLACKLIST', 'Žádné osoby na blacklistu', '#8B0000')],
      });
    }

    // Načtení všech osob na blacklistu
    const osoby = [];

    for (const osobaId of index) {
      const blacklistKey = `blacklist:${osobaId}`;
      const osoba = await kv.get(blacklistKey);
      if (osoba && osoba.status === 'aktivni') {
        osoby.push(osoba);
      }
    }

    // Seřazení podle data přidání (nejnovější první)
    osoby.sort((a, b) => new Date(b.pridanDne) - new Date(a.pridanDne));

    // Vytvoření Embed zprávy
    const blacklistEmbed = createEmbed(
      '🚫 BLACKLIST - NEŽÁDOUCÍ OSOBY',
      `
      **SEZNAM OSOB, KTERÝM NENÍ DOVOLENO VE FRAKCI**
      
      Počet osob: ${osoby.length}
      
      ⚠️ Pokud s těmito osobami komuniukuješ, budeš potrestán! ⚠️
      `,
      '#4B0000'
    );

    const fields = [];

    osoby.forEach((osoba) => {
      fields.push({
        name: `${osoba.duvodLabel}`,
        value: `
        👤 Jméno: ${osoba.jmeno}
        🆔 Steam/Discord: ${osoba.steam_discord}
        📅 Přidáno: ${new Date(osoba.pridanDne).toLocaleDateString('cs-CZ')}
        👤 Kdo přidal: ${osoba.pridanUzivatelem}
        `,
        inline: false,
      });
    });

    // Varovná zpráva
    fields.push({
      name: '⚠️ VAROVNÁ ZPRÁVA',
      value:
        'Jakýkoliv kontakt s těmito osobami = trest. Pokud jsi si vědom/a, že jsi je viděl/a, okamžitě to nahlaste vedení!',
      inline: false,
    });

    blacklistEmbed.fields = fields;

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [blacklistEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u blacklist-list:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Kontrola, zda je osoba na blacklistu
 * Vrací: true/false
 */
export async function isNaBlacklistu(jmeno) {
  const blacklistKey = `blacklist:${jmeno.toLowerCase()}`;
  const data = await kv.get(blacklistKey);
  return data && data.status === 'aktivni';
}

/**
 * Odebrání z blacklistu (amnestie)
 */
export async function removeZBlacklistu(jmeno) {
  const blacklistKey = `blacklist:${jmeno.toLowerCase()}`;
  const data = await kv.get(blacklistKey);

  if (data) {
    data.status = 'removed';
    data.removedDne = new Date().toISOString();
    await kv.set(blacklistKey, data);
    return true;
  }

  return false;
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
