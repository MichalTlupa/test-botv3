/**
 * COMMAND HANDLER: Trestní a pokutný systém
 * /trest [uživatel] [důvod] [pokuta/trest]
 * /tresty-vypis [uživatel] - Zobrazí historii prohřešků
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222';

// Typy trestů
const TYPY_TRESTU = {
  suhlas: { label: '💬 Ústní napomenutí', typ: 'napomenutí', penize: 0 },
  pokutas_5000: { label: '💰 Pokuta 5,000 Kč', typ: 'pokuta', penize: 5000 },
  pokutas_25000: { label: '💰 Pokuta 25,000 Kč', typ: 'pokuta', penize: 25000 },
  pokutas_50000: { label: '💰 Pokuta 50,000 Kč', typ: 'pokuta', penize: 50000 },
  pokutas_100000: { label: '💰 Pokuta 100,000 Kč', typ: 'pokuta', penize: 100000 },
  snizeni_pozice: { label: '⬇️ Snížení pozice', typ: 'snížení', penize: 0 },
  vyloučeni: { label: '🚫 Dočasné vyloučení (3 dny)', typ: 'vyloučení', penize: 0 },
};

// Důvody pro trest
const DUVODY_TRESTU = {
  neposlusalost: '🗣️ Neposlušnost vůči vedení',
  pozde_prichod: '⏰ Pozdní příchod na operaci',
  neuspesna_operace: '❌ Selhání v operaci',
  kradez: '💸 Krádež od frakce',
  zrada: '🗡️ Podezření na zradu',
  neprimerefene_chovani: '😡 Nepřiměřené chování',
  poruseni_pravidel: '⚖️ Porušení pravidel frakce',
  zanechal_veci: '🚨 Zanechal důležité věci',
  jine: '❓ Jiný důvod',
};

/**
 * Handler pro /trest
 * Udělí členovi trest nebo pokutu
 */
export async function handleTrest(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user } = interaction;

    const targetUser = data.options.find((opt) => opt.name === 'uživatel')?.value;
    const duvod = data.options.find((opt) => opt.name === 'duvod')?.value;
    const typTrestu = data.options.find((opt) => opt.name === 'pokuta/trest')?.value;

    // Validace
    if (!targetUser || !duvod || !typTrestu) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Chybějí povinné parametry')],
      });
    }

    // Ověření typu trestu
    const trestData = TYPY_TRESTU[typTrestu];
    if (!trestData) {
      const dostupne = Object.keys(TYPY_TRESTU).join(', ');
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Neznámý typ trestu. Dostupné: ${dostupne}`)],
      });
    }

    // Vytvoření záznamu o trestu
    const trestId = Math.random().toString(36).substring(7);
    const trestRecord = {
      id: trestId,
      userId: targetUser,
      duvod: duvod,
      duvodLabel: DUVODY_TRESTU[duvod] || duvod,
      typTrestu: typTrestu,
      trestLabel: trestData.label,
      penize: trestData.penize,
      kdy: new Date().toISOString(),
      kym: user.username,
      status: 'aktivni',
    };

    // Uložení trestu do KV
    const trestKey = `trest:${trestId}`;
    await kv.set(trestKey, trestRecord, { ex: 31536000 }); // 1 rok

    // Přidání do indexu trestu pro daného uživatele
    const clenevaIndexKey = `clen:tresty:${targetUser}`;
    let index = await kv.get(clenevaIndexKey);
    if (!index) index = [];
    index.push(trestId);
    await kv.set(clenevaIndexKey, index);

    // Alert - oznámení trestu
    const alertEmbed = createEmbed(
      '⚖️ TREST UDĚLEN',
      `
      **ČLEN PŘIJAL TREST NEBO POKUTU**
      
      👤 Postižený člen: <@${targetUser}>
      👮 Soudce: ${user.username}
      
      📋 **DŮVOD:**
      ${DUVODY_TRESTU[duvod] || duvod}
      
      💼 **TREST:**
      ${trestData.label}
      ${trestData.penize > 0 ? `\n💰 Pokuta: ${trestData.penize.toLocaleString('cs-CZ')} Kč` : ''}
      
      ⏰ Čas: ${new Date().toLocaleString('cs-CZ')}
      `,
      '#FF0000'
    );

    // Odeslání do logu
    await sendMessageToChannel(LOGS_CHANNEL_ID, { embeds: [alertEmbed] });

    // Pokuta se odečte z kasy
    if (trestData.penize > 0) {
      try {
        const trezorKey = 'frakce:trezor';
        const trezor = await kv.get(trezorKey);
        if (trezor) {
          trezor.ciste += trestData.penize;
          trezor.lastUpdate = new Date().toISOString();
          await kv.set(trezorKey, trezor);
        }
      } catch (e) {
        console.log('⚠️ Nepodařilo se přidat pokutu do trezoru');
      }
    }

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      'TREST UDĚLEN',
      `
      ✅ Trest byl úspěšně udělen
      
      **Postižený:** <@${targetUser}>
      **Důvod:** ${DUVODY_TRESTU[duvod] || duvod}
      **Trest:** ${trestData.label}
      ${trestData.penize > 0 ? `\n**Pokuta:** ${trestData.penize.toLocaleString('cs-CZ')} Kč (přidáno do kasy)` : ''}
      
      Disciplína je důležitá pro činnost frakce!
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u trestu:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro /tresty-vypis
 * Zobrazí historii prohřešků daného člena
 */
export async function handleTrestyVypis(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data } = interaction;

    const targetUser = data.options.find((opt) => opt.name === 'uživatel')?.value;

    if (!targetUser) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Musíš zadat uživatele')],
      });
    }

    // Načtení indexu trestu pro daného uživatele
    const clenevaIndexKey = `clen:tresty:${targetUser}`;
    const index = await kv.get(clenevaIndexKey);

    if (!index || index.length === 0) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createEmbed('✅ ČISTÝ SEZNAM', `<@${targetUser}> nemá žádný trest!\n\nJe to velmi dobrý/á člen! 👍`, '#00AA00')],
      });
    }

    // Načtení všech trestů
    const tresty = [];

    for (const trestId of index) {
      const trestKey = `trest:${trestId}`;
      const trest = await kv.get(trestKey);
      if (trest && trest.status === 'aktivni') {
        tresty.push(trest);
      }
    }

    // Seřazení podle data (nejnovější první)
    tresty.sort((a, b) => new Date(b.kdy) - new Date(a.kdy));

    // Výpočet celkové sumy pokut
    const celkovaPokuta = tresty.reduce((sum, t) => sum + t.penize, 0);

    // Vytvoření Embed zprávy
    const trestyEmbed = createEmbed(
      `⚖️ TRESTNÍ SEZNAM - <@${targetUser}>`,
      `
      **HISTORIKA PROHŘEŠKŮ**
      
      Počet trestů: ${tresty.length}
      Celková pokuta: ${celkovaPokuta.toLocaleString('cs-CZ')} Kč
      `,
      '#8B0000'
    );

    const fields = [];

    tresty.forEach((trest, index) => {
      fields.push({
        name: `${index + 1}. ${trest.trestLabel}`,
        value: `
        📋 Důvod: ${trest.duvodLabel}
        💰 Pokuta: ${trest.penize === 0 ? 'Bez pokuty' : trest.penize.toLocaleString('cs-CZ') + ' Kč'}
        ⏰ Kdy: ${new Date(trest.kdy).toLocaleDateString('cs-CZ')}
        👤 Kdo: ${trest.kym}
        `,
        inline: false,
      });
    });

    // Varovná zpráva pokud má moc trestů
    if (tresty.length >= 3) {
      fields.push({
        name: '⚠️ VAROVNÍ',
        value: 'Tento člen má příliš mnoho trestů. Zvažte jeho pozici ve frakci.',
        inline: false,
      });
    }

    trestyEmbed.fields = fields;

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [trestyEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u tresty-vypis:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Odebrání trestu (amnestie)
 */
export async function removeTrest(trestId) {
  const trestKey = `trest:${trestId}`;
  const trest = await kv.get(trestKey);

  if (trest) {
    trest.status = 'removed';
    trest.removedDne = new Date().toISOString();
    await kv.set(trestKey, trest);
    return true;
  }

  return false;
}

/**
 * Zobrazit všechny členy s trestaem
 */
export async function displayMembersWithTrest() {
  // Toto by vyžadovalo scan všech klíčů - v praxi bys měl seznam
  return [];
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
