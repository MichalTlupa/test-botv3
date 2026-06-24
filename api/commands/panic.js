/**
 * COMMAND HANDLER: Advanced Panic Systém
 * /panic [uživatel] - Aktivace paniku (únos člena)
 * /panic-off [uživatel] - Deaktivace paniku (bezpečný návrat)
 * /panicv [uživatel/všichni] - Nouzový poplach vedení
 */

import { InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../interactions.js';
import fetch from 'node-fetch';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const PANIC_ROLE_ID = process.env.PANIC_ROLE_ID || '1234567890'; // Role "PANIC"
const VEDENI_ROLE_ID = process.env.VEDENI_ROLE_ID || '0987654321'; // Role "Vedení"
const PANIC_CHANNEL_ID = process.env.PANIC_CHANNEL_ID || '1111111111'; // Nouzový kanál
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID || '2222222222'; // Kanál pro logy

/**
 * Handler pro /panic [uživatel]
 * Simuluje únos - uloží role, odebere je, nastaví PANIC roli
 */
export async function handlePanic(res, interaction) {
  // Defer - dlouhá operace s rolemi
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user, member, guild_id } = interaction;
    const targetUser = data.options.find((opt) => opt.name === 'uživatel')?.value;

    if (!targetUser) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Musíš zadat uživatele')],
      });
    }

    // Načtení info o cílovém uživateli
    const targetMember = await getMemberInfo(guild_id, targetUser);
    if (!targetMember) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`Uživatel ${targetUser} nenalezen`)],
      });
    }

    // Uložení všech rolí do KV (klíčové!)
    const panicKey = `panic:${targetUser}`;
    const originalRoles = targetMember.roles;

    await kv.set(panicKey, {
      userId: targetUser,
      originalRoles: originalRoles,
      timestamp: new Date().toISOString(),
      activatedBy: user.username,
    }, { ex: 604800 }); // 7 dní

    // Odstranění všech rolí
    for (const roleId of originalRoles) {
      await removeUserRole(guild_id, targetUser, roleId);
    }

    // Přidání PANIC role
    await addUserRole(guild_id, targetUser, PANIC_ROLE_ID);

    // Velký alert do chatu
    const panicAlert = createEmbed(
      '🚨🚨🚨 KRITICKÝ ALERT 🚨🚨🚨',
      `
      **ČLEN NAŠÍ FRAKCE BYL UNESEN!!!**
      
      👤 **Odsud:** ${targetMember.user.username}
      ⏰ **Čas:** ${new Date().toLocaleString('cs-CZ')}
      
      **VŠICHNI NA PÁTRÁNÍ!**
      
      \`\`\`
      • Hledej postavu ${targetMember.user.username}
      • Ber vzorky DNA
      • HLASITĚ volej po něm na frekvenční síti
      • Zjisti, kde ho mají
      • Buď opatrný - je to ÚNOS!
      \`\`\`
      `,
      '#FF0000'
    );

    panicAlert.fields = [
      {
        name: '🔴 STATUS PANIKU',
        value: '**AKTIVNÍ** - Všechny role jsou odebrány',
        inline: false,
      },
      {
        name: '🎯 Dostupné akce',
        value: '• Pátrání po členovi\n• Vyjednávání s únosci\n• Příprava zásahu',
        inline: false,
      },
      {
        name: '💡 Tip',
        value: 'Daný člen má přístup POUZE k nouzové místnosti. Tam čeká na evakuaci.',
        inline: false,
      },
    ];

    await sendMessageToChannel(PANIC_CHANNEL_ID, {
      content: `<@&${VEDENI_ROLE_ID}> 🚨 **VŠICHNI NA PÁTRÁNÍ!**`,
      embeds: [panicAlert],
    });

    // Logging
    await sendMessageToChannel(LOGS_CHANNEL_ID, {
      embeds: [createSuccessEmbed('PANIC AKTIVOVÁN', `${user.username} aktivoval PANIC pro ${targetMember.user.username}`)],
    });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      'PANIC AKTIVOVÁN',
      `
      ✅ PANIC pro ${targetMember.user.username} je nyní **AKTIVNÍ**
      
      **CO SE STALO:**
      • Všechny role byly uloženy do bezpečné databáze
      • Všechny role byly odebrány
      • Přidělena speciální role "PANIC"
      • Velký alert poslán do chatu
      • Vedení bylo upozorněno
      
      **Člen má přístup pouze k:**
      🔒 Nouzové místnosti v HQ
      
      **Kdy vrátit do normálu:**
      Použij \`/panic-off [uživatel]\` když je člen v bezpečí
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u paniku:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro /panic-off [uživatel]
 * Vrací člena do normálu - obnovuje všechny role
 */
export async function handlePanicOff(res, interaction) {
  // Defer - dlouhá operace
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user, guild_id } = interaction;
    const targetUser = data.options.find((opt) => opt.name === 'uživatel')?.value;

    if (!targetUser) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed('Musíš zadat uživatele')],
      });
    }

    // Načtení z KV
    const panicKey = `panic:${targetUser}`;
    const panicData = await kv.get(panicKey);

    if (!panicData) {
      return await sendFollowup(DISCORD_TOKEN, interaction.token, {
        embeds: [createErrorEmbed(`${targetUser} nemá aktivovaný PANIC`)],
      });
    }

    // Odstranění PANIC role
    await removeUserRole(guild_id, targetUser, PANIC_ROLE_ID);

    // Obnovení všech původních rolí
    for (const roleId of panicData.originalRoles) {
      await addUserRole(guild_id, targetUser, roleId);
    }

    // Smazání z KV
    await kv.del(panicKey);

    // Alert - "člen je v bezpečí"
    const safeAlert = createEmbed(
      '✅ ČLEN V BEZPEČÍ',
      `
      **${targetUser} byl úspěšně evakuován a vrácen do normálu.**
      
      ✅ Všechny původní role byly obnoveny
      ✅ PANIC role byla odebrána
      ✅ Přístup do všech kanálů obnoven
      
      Operace byla úspěšná. Chválíme si to.
      `,
      '#00AA00'
    );

    await sendMessageToChannel(PANIC_CHANNEL_ID, {
      embeds: [safeAlert],
    });

    // Logging
    await sendMessageToChannel(LOGS_CHANNEL_ID, {
      embeds: [createSuccessEmbed('PANIC DEAKTIVOVÁN', `${user.username} deaktivoval PANIC pro ${targetUser}`)],
    });

    // Potvrzení
    const confirmEmbed = createSuccessEmbed(
      'PANIC DEAKTIVOVÁN',
      `
      ✅ PANIC pro ${targetUser} byl **DEAKTIVOVÁN**
      
      **CO SE STALO:**
      • PANIC role byla odebrána
      • Všech ${panicData.originalRoles.length} původních rolí bylo obnoveno
      • Člen má nyní plný přístup do frakce
      • Vedení bylo informováno
      
      Vítejte zpět v rodině!
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u panic-off:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Handler pro /panicv [uživatel/všichni]
 * Nouzový poplach vedení - ping bez role změn
 */
export async function handlePanicV(res, interaction) {
  res.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  });

  try {
    const { data, user } = interaction;
    const typ = data.options.find((opt) => opt.name === 'typ')?.value || 'vedeni';

    const panicVEmbed = createEmbed(
      '🚨 NOUZOVÝ POPLACH VEDENÍ 🚨',
      `
      **KRITICKÁ SITUACE!**
      
      👤 **Hlásitель:** ${user.username}
      ⏰ **Čas:** ${new Date().toLocaleString('cs-CZ')}
      
      **MOŽNÉ PŘÍČINY:**
      • 🚔 Razie na HQ
      • 📞 Schůzka vedení (urgent)
      • 🔥 Vnitřní konflikt
      • 💀 Smrtelná hrozba
      
      **VEDENÍ - OKAMŽITĚ REAGOVAT!**
      `,
      '#FF0000'
    );

    await sendMessageToChannel(PANIC_CHANNEL_ID, {
      content: `<@&${VEDENI_ROLE_ID}> 🚨 **POPLACH VEDENÍ!**`,
      embeds: [panicVEmbed],
    });

    // Logging
    await sendMessageToChannel(LOGS_CHANNEL_ID, {
      embeds: [createEmbed('🚨 PANICV AKTIVOVÁN', `${user.username} vyslal nouzový poplach vedení`)],
    });

    const confirmEmbed = createSuccessEmbed(
      'POPLACH ODESLÁN',
      `
      ✅ Vedení bylo **PINGOVÁNO**
      
      Nouzový poplach byl vyslán do nouzového kanálu.
      Vedení by mělo reagovat do 2 minut.
      
      Buď připravený/á!
      `
    );

    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [confirmEmbed],
    });
  } catch (error) {
    console.error('❌ Chyba u panicv:', error);
    return await sendFollowup(DISCORD_TOKEN, interaction.token, {
      embeds: [createErrorEmbed(`Chyba: ${error.message}`)],
    });
  }
}

/**
 * Pomocné funkce pro práci s rolemi
 */
async function getMemberInfo(guildId, userId) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bot ${DISCORD_TOKEN}` },
  });
  return response.ok ? await response.json() : null;
}

async function addUserRole(guildId, userId, roleId) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  return fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bot ${DISCORD_TOKEN}` },
  });
}

async function removeUserRole(guildId, userId, roleId) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  return fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bot ${DISCORD_TOKEN}` },
  });
}

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
