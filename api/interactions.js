/**
 * API ENDPOINT: /api/interactions
 * Hlavní Discord Webhook pro zpracování všech Slash příkazů
 * Vercel Serverless Function
 */

import { verifyKeyMiddleware } from 'discord-interactions';
import { InteractionType, InteractionResponseType } from 'discord-api-types/v10';
import { kv } from '@vercel/kv';
import dotenv from 'dotenv';

// Načtení env proměnných
dotenv.config();

// Import všech command handlerů
import { handleVysilackamain } from './commands/radio';
import { handleVysilackasec } from './commands/radio';
import { handleAnonymVedeni } from './commands/anonym';
import { handlePanic, handlePanicOff, handlePanicV } from './commands/panic';
import { handleTrezorInfo, handleTrezorPohyb } from './commands/trezor';
import { handleSkladDrogy, handleSkladLog } from './commands/sklad';
import { handleDluhPridat, handleDluhList, handleDluhSmazat } from './commands/dluhy';
import { handleBlacklistAdd, handleBlacklistList } from './commands/blacklist';
import { handleHodnost } from './commands/hodnost';
import { handleAkcePlan } from './commands/akce';
import { handleTrest, handleTrestyVypis } from './commands/trestyapokutny';

// Ověření Discord requestu
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const BOT_ICON = '🔫'; // Emoji pro bot

/**
 * Vytvoří bezpečný a stylizovaný Embed v kriminální tematikou
 * @param {string} title - Název embedu
 * @param {string} description - Popis
 * @param {string} color - Hex barva (default: tmavě červená)
 */
export function createEmbed(title, description, color = '#8B0000') {
  const hexToDecimal = (hex) => parseInt(hex.replace('#', ''), 16);
  
  return {
    title: `${BOT_ICON} ${title}`,
    description: description,
    color: hexToDecimal(color),
    timestamp: new Date().toISOString(),
    footer: {
      text: '🔐 INTERNÍ KOMUNIKACE - PŘÍSNĚ TAJNÉ',
    },
  };
}

/**
 * Vytvoří chybový Embed
 */
export function createErrorEmbed(message) {
  return createEmbed('⚠️ CHYBA', message, '#4B0000');
}

/**
 * Vytvoří úspěšný Embed
 */
export function createSuccessEmbed(title, description) {
  return createEmbed(`✅ ${title}`, description, '#8B0000');
}

/**
 * Hlavní handler pro Discord interactions
 */
export async function handleInteraction(req, res) {
  // Ověření podpisu (Discord security)
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const body = req.body;

  // Ověřovací logika (Discord API)
  if (!verifyRequest(signature, timestamp, body)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Zpracování URL verification (Discord challenge)
  if (body.type === InteractionType.Ping) {
    return res.json({ type: InteractionResponseType.Pong });
  }

  // Zpracování Slash příkazů
  if (body.type === InteractionType.ApplicationCommand) {
    const { data, member, user, guild_id } = body;
    const commandName = data.name;

    try {
      // Logging
      console.log(`📡 Příkaz: /${commandName} od ${user.username}`);

      // Router pro jednotlivé příkazy
      switch (commandName) {
        // RÁDIOVÝ SYSTÉM
        case 'vysilackamain':
          return await handleVysilackamain(res, body);
        case 'vysilackasec':
          return await handleVysilackasec(res, body);

        // ANONYMNÍ ZPRÁVY
        case 'anonym-vedeni':
          return await handleAnonymVedeni(res, body);

        // PANIC SYSTÉM
        case 'panic':
          return await handlePanic(res, body);
        case 'panic-off':
          return await handlePanicOff(res, body);
        case 'panicv':
          return await handlePanicV(res, body);

        // TREZOR (FINANCE)
        case 'trezor-info':
          return await handleTrezorInfo(res, body);
        case 'trezor-pohyb':
          return await handleTrezorPohyb(res, body);

        // SKLAD
        case 'sklad-drogy':
          return await handleSkladDrogy(res, body);
        case 'sklad-log':
          return await handleSkladLog(res, body);

        // DLUŽNÍCI
        case 'dluh-pridat':
          return await handleDluhPridat(res, body);
        case 'dluh-list':
          return await handleDluhList(res, body);
        case 'dluh-smazat':
          return await handleDluhSmazat(res, body);

        // BLACKLIST
        case 'blacklist-add':
          return await handleBlacklistAdd(res, body);
        case 'blacklist-list':
          return await handleBlacklistList(res, body);

        // MANAGEMENT ČLENŮ
        case 'hodnost':
          return await handleHodnost(res, body);

        // PLÁNOVÁNÍ AKCÍ
        case 'akce-plan':
          return await handleAkcePlan(res, body);

        // TRESTYAPOKUTNY
        case 'trest':
          return await handleTrest(res, body);
        case 'tresty-vypis':
          return await handleTrestyVypis(res, body);

        default:
          return res.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              embeds: [createErrorEmbed(`Neznámý příkaz: /${commandName}`)],
            },
          });
      }
    } catch (error) {
      console.error('❌ Chyba:', error);
      return res.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [createErrorEmbed(`Došlo k chybě: ${error.message}`)],
        },
      });
    }
  }

  // Button interactions (pro akce a další interaktivní prvky)
  if (body.type === InteractionType.MessageComponent) {
    const { data, member, user } = body;
    const customId = data.custom_id;

    try {
      // Routing button handlerů
      if (customId.startsWith('akceprihlaska-')) {
        return await handleAkceButton(res, body, customId);
      }

      return res.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [createErrorEmbed('Neznámé tlačítko')],
        },
      });
    } catch (error) {
      console.error('❌ Chyba u button:', error);
      return res.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [createErrorEmbed(`Button chyba: ${error.message}`)],
        },
      });
    }
  }

  res.status(400).json({ error: 'Neznámý typ requestu' });
}

/**
 * Ověření Discord podpisu (bezpečnost)
 */
function verifyRequest(signature, timestamp, body) {
  // V produkci by se měl používat nacl pro ověření
  // Pro dev je to zjednodušené
  if (!DISCORD_PUBLIC_KEY) {
    console.warn('⚠️ DISCORD_PUBLIC_KEY není nastavený!');
    return false;
  }
  return true;
}

/**
 * Handler pro button interactions u akcí
 */
async function handleAkceButton(res, body, customId) {
  const [, akceId, buttonType] = customId.split('-');
  const { user, message } = body;

  // Načtení akce z KV
  const akceKey = `akce:${akceId}`;
  let akce = await kv.get(akceKey);

  if (!akce) {
    return res.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [createErrorEmbed('Akce nenalezena v databázi')],
      },
    });
  }

  // Přidání/odebrání uživatele do kategorie
  if (!akce.pripraveni) akce.pripraveni = [];
  if (!akce.nahradnici) akce.nahradnici = [];
  if (!akce.nemuzu) akce.nemuzu = [];

  const userName = user.username;

  // Odstranění z ostatních kategorií
  akce.pripraveni = akce.pripraveni.filter((u) => u !== userName);
  akce.nahradnici = akce.nahradnici.filter((u) => u !== userName);
  akce.nemuzu = akce.nemuzu.filter((u) => u !== userName);

  // Přidání do relevantní kategorie
  if (buttonType === 'pripraveni') akce.pripraveni.push(userName);
  else if (buttonType === 'nahradnici') akce.nahradnici.push(userName);
  else if (buttonType === 'nemuzu') akce.nemuzu.push(userName);

  // Uložení zpět do KV
  await kv.set(akceKey, akce, { ex: 86400 * 7 }); // 7 dní

  // Odeslání potvrzení
  return res.json({
    type: InteractionResponseType.DeferredMessageUpdate,
  });
}

/**
 * Vercel serverless export
 */
export default async function handler(req, res) {
  return handleInteraction(req, res);
}
