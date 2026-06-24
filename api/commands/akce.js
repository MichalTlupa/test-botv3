/**
 * COMMAND HANDLER: Plánování akcí - S interaktivními tlačítky
 * /akce-plan [nazev] [cas] [popis]
 * Vytvoří Embed s 3 tlačítky pro hlášení se na akci
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222';
const AKCE_CHANNEL_ID = process.env.AKCE_CHANNEL_ID || '3333333333';

/**
 * Handler pro /akce-plan
 * Vytvoří novou akci s interaktivními tlačítky
 */
export async function handleAkcePlan(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user, channel_id } = interaction;

    const nazev = data.options.find((opt) => opt.name === 'nazev')?.value;
    const cas = data.options.find((opt) => opt.name === 'cas')?.value;
    const popis = data.options.find((opt) => opt.name === 'popis')?.value;

    // Validace
    if (!nazev || !cas || !popis) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Chybějí povinné parametry')],
      });
    }

    // Generování ID pro akci
    const akceId = Math.random().toString(36).substring(7);

    // Vytvoření struktury akce
    const akceData = {
      id: akceId,
      nazev: nazev,
      cas: cas,
      popis: popis,
      vytvorenoKdy: new Date().toISOString(),
      vytvorenoKym: user.username,
      pripraveni: [], // Lidé kteří jdou
      nahradnici: [], // Náhradníci
      nemuzu: [], // Lidé co nemohou
      status: 'aktivni',
      messageId: null, // Bude doplněno později
    };

    // Uložení akce do KV
    const akceKey = `akce:${akceId}`;
    await kv.set(akceKey, akceData, { ex: 604800 }); // 7 dní

    // Vytvoření Embed zprávy s tlačítky
    const akceEmbed = createEmbed(
      `📋 NOVÁ OPERACE - ${nazev}`,
      `
      **${nazev}**
      
      ⏰ **Čas:** ${cas}
      
      📝 **Popis:**
      ${popis}
      
      ---
      
      **STAV OPERACE:**
      
      🟢 **Připraveni (Základní tým):** 0 lidí
      🟡 **Náhradníci / Hlídka:** 0 lidí
      🔴 **Nemohou:** 0 lidí
      `,
      '#8B0000'
    );

    // Vytvoření komponenty s tlačítky
    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            label: '🟢 Jdu (Základní tým)',
            style: 3, // Zelené tlačítko
            custom_id: `akceprihlaska-${akceId}-pripraveni`,
          },
          {
            type: 2,
            label: '🟡 Náhradník / Hlídka',
            style: 2, // Modrá tlačítko
            custom_id: `akceprihlaska-${akceId}-nahradnici`,
          },
          {
            type: 2,
            label: '🔴 Nemůžu',
            style: 4, // Červené tlačítko
            custom_id: `akceprihlaska-${akceId}-nemuzu`,
          },
        ],
      },
    ];

    // Odeslání zprávy s tlačítky na AKCE_CHANNEL
    const messageData = {
      embeds: [akceEmbed],
      components: components,
      content: '📢 **NOVÁ OPERACE!** Vyberte si svou roli v tlačítky níže:',
    };

    const messageResponse = await sendMessageToChannel(AKCE_CHANNEL_ID, messageData);
    const messageJson = await messageResponse.json();

    if (messageResponse.ok && messageJson.id) {
      // Uložení message ID do akce
      akceData.messageId = messageJson.id;
      await kv.set(akceKey, akceData, { ex: 604800 });
    }

    // Logování
    const logEmbed = createEmbed(
      '📋 NOVÁ AKCE NAPLÁNOVÁNA',
      `
      **${user.username}** naplánoval novou operaci
      
      Název: ${nazev}
      Čas: ${cas}
      Popis: ${popis}
      `,
      '#0099FF'
    );

    await sendMessageToChannel(LOGS_CHANNEL_ID, { embeds: [logEmbed] });

    // Potvrzení tvůrci
    const confirmEmbed = createSuccessEmbed(
      'OPERACE NAPLÁNOVÁNA',
      `
      ✅ Operace "${nazev}" byla vytvořena a sdílena
      
      **Čas:** ${cas}
      **Popis:** ${popis}
      
      ID Akce: \`${akceId}\`
      
      Čekáme na hlášení se ostatních členů!
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u akce-plan:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro button interactions u akcí
 * (Volaný z hlavního interactions.js souboru)
 */
export async function handleAkceButton(res, interaction, customId) {
  try {
    const [, akceId, buttonType] = customId.split('-');
    const { user } = interaction;

    // Načtení akce z KV
    const akceKey = `akce:${akceId}`;
    let akce = await kv.get(akceKey);

    if (!akce) {
      return res.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [createErrorEmbed('Akce nenalezena v databázi')],
          flags: 64, // Ephemeral
        },
      });
    }

    // Inicializace polí pokud neexistují
    if (!akce.pripraveni) akce.pripraveni = [];
    if (!akce.nahradnici) akce.nahradnici = [];
    if (!akce.nemuzu) akce.nemuzu = [];

    const userName = user.username;

    // Odstranění z ostatních kategorií
    akce.pripraveni = akce.pripraveni.filter((u) => u !== userName);
    akce.nahradnici = akce.nahradnici.filter((u) => u !== userName);
    akce.nemuzu = akce.nemuzu.filter((u) => u !== userName);

    // Přidání do relevantní kategorie
    if (buttonType === 'pripraveni') {
      akce.pripraveni.push(userName);
    } else if (buttonType === 'nahradnici') {
      akce.nahradnici.push(userName);
    } else if (buttonType === 'nemuzu') {
      akce.nemuzu.push(userName);
    }

    // Uložení zpět do KV
    await kv.set(akceKey, akce, { ex: 604800 });

    // Aktualizace embedu se nových daty
    const updatedEmbed = createEmbed(
      `📋 ${akce.nazev}`,
      `
      **${akce.nazev}**
      
      ⏰ **Čas:** ${akce.cas}
      
      📝 **Popis:**
      ${akce.popis}
      
      ---
      
      **STAV OPERACE:**
      
      🟢 **Připraveni (Základní tým):** ${akce.pripraveni.length} lidí
      ${akce.pripraveni.length > 0 ? akce.pripraveni.map((u) => `  • ${u}`).join('\n') : '  (Nikdo)'}
      
      🟡 **Náhradníci / Hlídka:** ${akce.nahradnici.length} lidí
      ${akce.nahradnici.length > 0 ? akce.nahradnici.map((u) => `  • ${u}`).join('\n') : '  (Nikdo)'}
      
      🔴 **Nemohou:** ${akce.nemuzu.length} lidí
      ${akce.nemuzu.length > 0 ? akce.nemuzu.map((u) => `  • ${u}`).join('\n') : '  (Nikdo)'}
      
      ---
      
      **CELKEM:** ${akce.pripraveni.length + akce.nahradnici.length + akce.nemuzu.length} přihlášených
      `,
      '#8B0000'
    );

    // Odeslání ephemeral potvrzení uživateli
    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          createSuccessEmbed(
            '✅ PŘIHLÁŠKA PŘIJATA',
            `
            Jméno: ${userName}
            Status: ${
              buttonType === 'pripraveni'
                ? '🟢 Jdu do základního týmu'
                : buttonType === 'nahradnici'
                  ? '🟡 Budu náhradník'
                  : '🔴 Nemohu jít'
            }
            `
          ),
        ],
        flags: 64, // Ephemeral - vidí jen ten uživatel
      },
    });
  } catch (error) {
    console.error('❌ Chyba u akce buttonu:', error);
    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
        flags: 64,
      },
    });
  }
}

/**
 * Zobrazit seznam všech aktivních akcí
 */
export async function displayAktivniAkce(res, interaction) {
  try {
    // Scan všech akcí - v praxi by jsi měl seznam akcí
    const akceListEmbed = createEmbed(
      '📋 AKTIVNÍ OPERACE',
      `
      Pro zobrazení aktivních operací můžeš použít /akce-list
      `,
      '#8B0000'
    );

    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [akceListEmbed],
      },
    });
  } catch (error) {
    console.error('❌ Chyba u aktivní akcí:', error);
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
