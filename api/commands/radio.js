/**
 * COMMAND HANDLER: Rádiový systém
 * /vysilackamain - Hlavní frekvence
 * /vysilackasec - Sekundární frekvence
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { createEmbed, createSuccessEmbed } from '../interactions.js';

// Konstanty pro frekvence - NEJDŮLEŽITĚJŠÍ - měníš zde
const MAIN_FREQUENCY = '87.5 FM';
const SEC_FREQUENCY = '89.2 FM';
const CHANNEL_ID_RADIO = process.env.CHANNEL_ID_RADIO || '1234567890'; // ID kanálu pro radio

/**
 * Handler pro /vysilackamain
 * Zobrazí aktuální hlavní frekvenci
 */
export async function handleVysilackamain(res, interaction) {
  const embed = createEmbed(
    '📻 HLAVNÍ VYSÍLAČKA',
    `
    🔴 **AKTIVNÍ FREKVENCE**
    \`\`\`
    Frekvence: ${MAIN_FREQUENCY}
    Status: 🟢 ONLINE
    Typ: Hlavní komunikační linka
    Zajištění: Šifrovaný kanál
    \`\`\`
    
    ⚠️ **PRAVIDLA POUŽÍVÁNÍ**
    • Mluvit pouze o pracovních záležitostech
    • Nepoužívat Real Names
    • Maximální délka zprávy: 30 sekund
    • NIKDY nekomunikovat s cizími frakcemi
    `,
    '#8B0000'
  );

  embed.fields = [
    {
      name: '🛡️ Bezpečnost',
      value: 'Komunikace je monitorovaná. Všechny rozhovory jsou archivovány.',
      inline: false,
    },
    {
      name: '📍 Pokyny',
      value: 'V případě podezření na výslechu kontaktuj okamžitě vedení.',
      inline: false,
    },
  ];

  return res.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      embeds: [embed],
    },
  });
}

/**
 * Handler pro /vysilackasec
 * Zobrazí sekundární frekvenci
 */
export async function handleVysilackasec(res, interaction) {
  const embed = createEmbed(
    '📻 SEKUNDÁRNÍ VYSÍLAČKA',
    `
    🟠 **AKTIVNÍ FREKVENCE**
    \`\`\`
    Frekvence: ${SEC_FREQUENCY}
    Status: 🟢 ONLINE
    Typ: Nouzová linka (Razie, Únos, Krize)
    Zajištění: Super-šifrovaný kanál
    \`\`\`
    
    ⚠️ **POVOLENÍ K POUŽÍVÁNÍ**
    • Pouze při aktivní krizi
    • Jen vedení a určení členové
    • Zákaz zneužívání - trest 50,000 Kč
    • Aktivace: Řekni slovo "RADIO KRIICH"
    `,
    '#8B0000'
  );

  embed.fields = [
    {
      name: '🚨 Nouzové situace',
      value: 'Razie HQ, únos člena, útok ze strany, infiltrace...',
      inline: false,
    },
    {
      name: '👮 Odpočívejte v klidu',
      value: 'Tato frekvence je příliš důležitá na žertování.',
      inline: false,
    },
  ];

  return res.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      embeds: [embed],
    },
  });
}

/**
 * Aktualizace frekvence
 * Příkaz /frekvence-zmena [nova_frekvence]
 * (Pouze pro vedení)
 */
export async function updateFrequency(newMain = null, newSec = null) {
  if (newMain) MAIN_FREQUENCY = newMain;
  if (newSec) SEC_FREQUENCY = newSec;

  console.log(`📡 Frekvence aktualizovány - Main: ${MAIN_FREQUENCY}, Sec: ${SEC_FREQUENCY}`);

  return { status: 'ok', main: MAIN_FREQUENCY, sec: SEC_FREQUENCY };
}
