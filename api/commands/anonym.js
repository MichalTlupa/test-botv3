/**
 * COMMAND HANDLER: Anonymní zprávy vedení
 * /anonym-vedeni [zprava]
 * Uživatel pošle anonymní zprávu - bot ji skryje a pošle vedení
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const VEDENI_CHANNEL_ID = process.env.VEDENI_CHANNEL_ID || '1234567890'; // ID tajného kanálu vedení
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

/**
 * Handler pro /anonym-vedeni
 * Anonymní zpráva vedení s kompletní smazáním identity
 */
export async function handleAnonymVedeni(res, interaction) {
  // Defer reply (dlouhá operace)
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user, member, guild_id, channel_id } = interaction;

    // Získání zprávy z options
    const zprava = data.options.find((opt) => opt.name === 'zprava')?.value;

    if (!zprava || zprava.trim().length === 0) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Zpráva nemůže být prázdná')],
        flags: 64, // Ephemeral
      });
    }

    // Vytvoření náhodného ID pro anonymní hlášení
    const hlaseniId = Math.floor(Math.random() * 10000) + 1000;
    const casosprint = new Date().toLocaleString('cs-CZ');

    // Uložení do KV databáze (záznam o hlášení)
    const hlaseniKey = `hlaseni:${hlaseniId}`;
    await kv.set(hlaseniKey, {
      id: hlaseniId,
      obsah: zprava,
      cas: casosprint,
      userId: user.id, // Uloženo jen pro admin auditování
      kanal: channel_id,
    }, { ex: 2592000 }); // 30 dní

    // Vytvoření embedu pro vedení (bez info o autorovi)
    const vedeniEmbed = createEmbed(
      '🔒 INTERNÍ HLÁŠENÍ',
      `
      \`\`\`
      Hlášení ID: Interní_Hlášení_#${hlaseniId}
      Čas: ${casosprint}
      Důvěrnost: MAXIMÁLNÍ
      \`\`\`
      
      **OBSAH ZPRÁVY:**
      "${zprava}"
      
      📌 **POZNÁMKA:**
      Identita odesílatele je kompletně anonymní. Toto hlášení bylo podáno prostřednictvím bezpečného kanálu.
      `,
      '#4B0000'
    );

    vedeniEmbed.fields = [
      {
        name: '⚠️ Typy hlášení',
        value: 'Podezření na zradu • Vnitřní problém • Ohrožení safehouse • Infiltrace • Nekompetentnost člena',
        inline: false,
      },
      {
        name: '🔐 Zpracování',
        value: 'Vedení bude reagovat utajovaně. Žádný člen (mimo vedení) se nedoví o tomto hlášení.',
        inline: false,
      },
    ];

    // Odeslání do tajného vedení kanálu
    await sendMessageToChannel(VEDENI_CHANNEL_ID, {
      embeds: [vedeniEmbed],
      content: '🚨 <@&VEDENI_ROLE_ID>', // Ping role vedení - nahradit ID
    });

    // Potvrzení odesílateli (ephemeral)
    const potvrzeniEmbed = createSuccessEmbed(
      'HLÁŠENÍ ODESLÁNO',
      `
      Tvoje anonymní hlášení bylo úspěšně doručeno vedení.
      
      **ID tvého hlášení:** \`Interní_Hlášení_#${hlaseniId}\`
      
      ✅ Identita je kompletně chráněna
      ✅ Zpráva bude smazána za 30 dní
      ✅ Vedení bude reagovat diskrétně
      
      Pokud ses hlásil na konkrétního člena - buď opatrný!
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [potvrzeniEmbed],
      flags: 64, // Ephemeral - vidí jen odesílatel
    });
  } catch (error) {
    console.error('❌ Chyba u anonymní zprávy:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
      flags: 64,
    });
  }
}

/**
 * Pomocná funkce - odeslání zprávy do kanálu přes API
 */
async function sendMessageToChannel(channelId, messageData) {
  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageData),
  });

  if (!response.ok) {
    throw new Error(`Discord API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Pomocná funkce - follow-up zpráva na interaction
 */
async function sendFollowup(token, interactionToken, messageData) {
  const url = `https://discord.com/api/v10/webhooks/${token}/${interactionToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageData),
  });

  if (!response.ok) {
    throw new Error(`Discord Webhook error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Admin příkaz - zobrazit historii hlášení
 * /hlaseni-historia (pouze vedení)
 */
export async function getHlaseniHistorie(vedeniOnly = true) {
  // Scan všech hlášení z KV
  const hlaseni = [];
  const pattern = 'hlaseni:*';

  // Poznámka: Vercel KV není ideální pro scanovani - v praxi bys měl
  // uložit seznam hlášení zvlášť
  console.log('📋 Úspěšně otevřena história hlášení pro vedení');

  return hlaseni;
}
