/**
 * COMMAND HANDLER: Sklad - Management drog a nelegálního zboží
 * /sklad-drogy [akce] [druh] [množství] - Drogy
 * /sklad-log [akce] [předmět] [počet] - Ostatní věci (zbraně, lockpicky...)
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222';

// Druhy drog s ikonami
const DROGY_TYPY = {
  marihuana: { label: '🌿 Marihuana', jednotka: 'g (gramy)' },
  kokain: { label: '❄️ Kokain', jednotka: 'g (gramy)' },
  meth: { label: '⚗️ Methamphetamin', jednotka: 'g (gramy)' },
};

/**
 * Inicializace skladů
 */
export async function initSklady() {
  // Sklad drog
  const drogKey = 'sklad:drogy';
  const existing = await kv.get(drogKey);

  if (!existing) {
    const initialDrogy = {};
    Object.keys(DROGY_TYPY).forEach((typ) => {
      initialDrogy[typ] = 0;
    });
    initialDrogy.lastUpdate = new Date().toISOString();

    await kv.set(drogKey, initialDrogy);
    console.log('✅ Sklad drog inicializován');
  }

  // Sklad věcí
  const vecKey = 'sklad:veci';
  const existingVeci = await kv.get(vecKey);

  if (!existingVeci) {
    await kv.set(vecKey, {
      zbrane: 0,
      lockpicky: 0,
      neprustrelne_vesty: 0,
      kode_crackery: 0,
      lastUpdate: new Date().toISOString(),
    });
    console.log('✅ Sklad věcí inicializován');
  }
}

/**
 * Handler pro /sklad-drogy
 * Správa drog
 */
export async function handleSkladDrogy(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    await initSklady();

    const { data, user } = interaction;

    const akce = data.options.find((opt) => opt.name === 'akce')?.value;
    const druh = data.options.find((opt) => opt.name === 'druh')?.value;
    const mnozstvi = data.options.find((opt) => opt.name === 'mnozstvi')?.value;

    const drogKey = 'sklad:drogy';
    const drogy = await kv.get(drogKey);

    // VÝPIS
    if (akce === 'vypis') {
      const drogEmbed = createEmbed(
        '🏪 SKLAD NELEGÁLNÍHO ZBOŽÍ',
        `
        **INVENTÁŘ DROG**
        
        Poslední check: ${drogy.lastUpdate}
        `,
        '#4B0000'
      );

      const fields = [];

      Object.entries(DROGY_TYPY).forEach(([typ, info]) => {
        const mnozstvi = drogy[typ] || 0;
        const status = mnozstvi > 1000 ? '✅ OK' : mnozstvi > 500 ? '⚠️ Nízko' : '🔴 Kriticky nízko';

        fields.push({
          name: info.label,
          value: `${mnozstvi} ${info.jednotka} ${status}`,
          inline: true,
        });
      });

      // Hrozba odhalení
      const soucetMnozstvi = Object.keys(DROGY_TYPY).reduce((sum, typ) => sum + (drogy[typ] || 0), 0);
      const hrozbaProcentA = Math.min((soucetMnozstvi / 50000) * 100, 100);

      fields.push({
        name: '🚨 Hrozba odhalení',
        value: `
        Úroveň: ${Math.round(hrozbaProcentA)}%
        ${hrozbaProcentA > 75 ? '🔴 VELMI VYSOKÁ RIZIKA!' : hrozbaProcentA > 50 ? '🟠 Zvýšené riziko' : '🟢 Nízké riziko'}
        `,
        inline: false,
      });

      drogEmbed.fields = fields;

      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [drogEmbed],
      });
    }

    // PŘIDÁNÍ / ODEBRÁNÍ
    if (!druh || !mnozstvi) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Musíš zadat druh a množství')],
      });
    }

    const info = DROGY_TYPY[druh];
    if (!info) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Neznámý typ drogy: ${druh}`)],
      });
    }

    const castka = parseInt(mnozstvi);

    if (akce === 'pridat') {
      drogy[druh] = (drogy[druh] || 0) + castka;
    } else if (akce === 'odebrat') {
      if ((drogy[druh] || 0) < castka) {
        return await sendFollowup(DISCORD_TOKEN, interaction.token, {
          embeds: [createErrorEmbed(`Nemáš dost ${info.label}!\nMáš: ${drogy[druh] || 0}`)],
        });
      }
      drogy[druh] -= castka;
    } else {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Neznámá akce. Používej: pridat/odebrat/vypis')],
      });
    }

    drogy.lastUpdate = new Date().toISOString();
    await kv.set(drogKey, drogy);

    // Logování
    const logEmbed = createEmbed(
      `${akce === 'pridat' ? '➕ PŘIDÁNÍ' : '➖ ODEBRÁNÍ'} DROGY`,
      `
      **${user.username}** provedl operaci se skladem
      
      Typ: ${info.label}
      Akce: ${akce === 'pridat' ? 'Přidání ➕' : 'Odebrání ➖'}
      Množství: ${castka} ${info.jednotka}
      
      Nový stav: ${drogy[druh] || 0} ${info.jednotka}
      `,
      '#FF7700'
    );

    await sendMessageToChannel(LOGS_CHANNEL_ID, { embeds: [logEmbed] });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      `${akce === 'pridat' ? 'DROGA PŘIDÁNA' : 'DROGA ODEBRÁNA'}`,
      `
      ✅ Operace byla úspěšně provedena
      
      **Typ:** ${info.label}
      **Akce:** ${akce === 'pridat' ? 'Přidání ➕' : 'Odebrání ➖'}
      **Množství:** ${castka} ${info.jednotka}
      
      **Nový stav:** ${drogy[druh] || 0} ${info.jednotka}
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u skladu drog:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro /sklad-log
 * Logování ostatních věcí (zbraně, lockpicky atd.)
 */
export async function handleSkladLog(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    await initSklady();

    const { data, user } = interaction;

    const akce = data.options.find((opt) => opt.name === 'akce')?.value;
    const predmet = data.options.find((opt) => opt.name === 'predmet')?.value;
    const pocet = data.options.find((opt) => opt.name === 'pocet')?.value;

    const vecKey = 'sklad:veci';
    const veci = await kv.get(vecKey);

    // Validace
    if (!predmet || !pocet) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Musíš zadat předmět a počet')],
      });
    }

    const count = parseInt(pocet);

    // Zkontroluj, zda je klíč validní
    if (!veci.hasOwnProperty(predmet)) {
      const dostupne = Object.keys(veci).filter((k) => k !== 'lastUpdate').join(', ');
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Neznámý předmět. Dostupné: ${dostupne}`)],
      });
    }

    // VLOŽENÍ nebo VÝBĚR
    if (akce === 'vlozit') {
      veci[predmet] = (veci[predmet] || 0) + count;
    } else if (akce === 'vybrat') {
      if ((veci[predmet] || 0) < count) {
        return await sendFollowup(DISCORD_TOKEN, interaction.token, {
          embeds: [createErrorEmbed(`Nemáš dost ${predmet}!\nMáš: ${veci[predmet] || 0}`)],
        });
      }
      veci[predmet] -= count;
    } else {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Neznámá akce. Používej: vlozit/vybrat')],
      });
    }

    veci.lastUpdate = new Date().toISOString();
    await kv.set(vecKey, veci);

    // Logging
    const logEmbed = createEmbed(
      `${akce === 'vlozit' ? '➕ VLOŽENÍ' : '➖ VÝBĚR'} VĚCI`,
      `
      **${user.username}** provedl operaci se skladem věcí
      
      Předmět: ${predmet}
      Akce: ${akce === 'vlozit' ? 'Vložení ➕' : 'Výběr ➖'}
      Počet: ${count} ks
      
      Nový stav: ${veci[predmet] || 0} ks
      `,
      '#0099FF'
    );

    await sendMessageToChannel(LOGS_CHANNEL_ID, { embeds: [logEmbed] });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      `${akce === 'vlozit' ? 'VĚC VLOŽENA' : 'VĚC VYTAŽENA'}`,
      `
      ✅ Operace byla úspěšně provedena
      
      **Předmět:** ${predmet}
      **Akce:** ${akce === 'vlozit' ? 'Vložení ➕' : 'Výběr ➖'}
      **Počet:** ${count} ks
      
      **Nový stav:** ${veci[predmet] || 0} ks
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u skladu-log:', error);
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
