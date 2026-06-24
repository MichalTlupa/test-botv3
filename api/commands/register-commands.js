/**
 * REGISTRACE SLASH PŘÍKAZŮ
 * 
 * Spusť tento skript jednou pro registraci všech příkazů:
 * node register-commands.js
 * 
 * Uprav DISCORD_TOKEN a GUILD_ID v tomto souboru nebo v .env
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ Chyba: DISCORD_TOKEN a GUILD_ID nejsou nastaveny v .env.local!');
  process.exit(1);
}

// Definice všech Slash příkazů
const commands = [
  // RÁDIOVÝ SYSTÉM
  {
    name: 'vysilackamain',
    description: 'Zobrazí hlavní frekvenci vysílačky',
    type: 1,
  },
  {
    name: 'vysilackasec',
    description: 'Zobrazí sekundární frekvenci vysílačky (nouzová linka)',
    type: 1,
  },

  // ANONYMNÍ ZPRÁVY
  {
    name: 'anonym-vedeni',
    description: 'Pošli anonymní zprávu vedení (podezření, vnitřní problém)',
    type: 1,
    options: [
      {
        name: 'zprava',
        description: 'Obsah anonymní zprávy',
        type: 3, // string
        required: true,
      },
    ],
  },

  // PANIC SYSTÉM
  {
    name: 'panic',
    description: 'Aktivuj PANIC - simulace únosu člena',
    type: 1,
    options: [
      {
        name: 'uživatel',
        description: 'Uživatel, který je unesen',
        type: 6, // user
        required: true,
      },
    ],
  },
  {
    name: 'panic-off',
    description: 'Deaktivuj PANIC - bezpečný návrat člena',
    type: 1,
    options: [
      {
        name: 'uživatel',
        description: 'Uživatel, který se vrací',
        type: 6, // user
        required: true,
      },
    ],
  },
  {
    name: 'panicv',
    description: 'Nouzový poplach vedení (razie, schůzka)',
    type: 1,
    options: [
      {
        name: 'typ',
        description: 'Typ nouzové situace',
        type: 3, // string
        required: false,
      },
    ],
  },

  // TREZOR (FINANCE)
  {
    name: 'trezor-info',
    description: 'Zobrazí stav trezoru (čisté, špinavé, vyprané peníze)',
    type: 1,
  },
  {
    name: 'trezor-pohyb',
    description: 'Zaznamenaj finanční operaci (vklad/výběr)',
    type: 1,
    options: [
      {
        name: 'typ',
        description: 'Typ peněz (ciste/spinave/vyprane)',
        type: 3, // string
        required: true,
        choices: [
          { name: 'Čisté peníze', value: 'ciste' },
          { name: 'Špinavé peníze', value: 'spinave' },
          { name: 'Vyprané peníze', value: 'vyprane' },
        ],
      },
      {
        name: 'akce',
        description: 'Akce (vklad/vyber)',
        type: 3, // string
        required: true,
        choices: [
          { name: 'Vklad', value: 'vklad' },
          { name: 'Výběr', value: 'vyber' },
        ],
      },
      {
        name: 'castka',
        description: 'Částka v Kč',
        type: 4, // integer
        required: true,
      },
      {
        name: 'duvod',
        description: 'Důvod operace',
        type: 3, // string
        required: true,
      },
    ],
  },

  // SKLAD
  {
    name: 'sklad-drogy',
    description: 'Správa drog ve skladě (marihuana, kokain, meth)',
    type: 1,
    options: [
      {
        name: 'akce',
        description: 'Akce se skladem',
        type: 3, // string
        required: true,
        choices: [
          { name: 'Přidat', value: 'pridat' },
          { name: 'Odebrat', value: 'odebrat' },
          { name: 'Výpis', value: 'vypis' },
        ],
      },
      {
        name: 'druh',
        description: 'Typ drogy',
        type: 3, // string
        required: false,
        choices: [
          { name: 'Marihuana', value: 'marihuana' },
          { name: 'Kokain', value: 'kokain' },
          { name: 'Methamphetamin', value: 'meth' },
        ],
      },
      {
        name: 'mnozstvi',
        description: 'Množství (gramy)',
        type: 4, // integer
        required: false,
      },
    ],
  },
  {
    name: 'sklad-log',
    description: 'Logování ostatních věcí (zbraně, lockpicky...)',
    type: 1,
    options: [
      {
        name: 'akce',
        description: 'Akce se skladem',
        type: 3, // string
        required: true,
        choices: [
          { name: 'Vložit', value: 'vlozit' },
          { name: 'Vybrat', value: 'vybrat' },
        ],
      },
      {
        name: 'predmet',
        description: 'Předmět (zbrane, lockpicky, neprustrelne_vesty...)',
        type: 3, // string
        required: true,
      },
      {
        name: 'pocet',
        description: 'Počet kusů',
        type: 4, // integer
        required: true,
      },
    ],
  },

  // DLUŽNÍCI
  {
    name: 'dluh-pridat',
    description: 'Přidej nového dlužníka (člověka zvenčí)',
    type: 1,
    options: [
      {
        name: 'jmeno_ic',
        description: 'Jméno nebo IC dlužníka',
        type: 3, // string
        required: true,
      },
      {
        name: 'castka',
        description: 'Dlužená částka v Kč',
        type: 4, // integer
        required: true,
      },
      {
        name: 'datum_splatnosti',
        description: 'Datum splatnosti (např. 2024-12-25)',
        type: 3, // string
        required: true,
      },
      {
        name: 'kontakt',
        description: 'Kontakt na dlužníka (tel., nick...)',
        type: 3, // string
        required: true,
      },
    ],
  },
  {
    name: 'dluh-list',
    description: 'Zobrazí seznam všech dlužníků',
    type: 1,
  },
  {
    name: 'dluh-smazat',
    description: 'Smaž dlužníka z databáze (po zaplacení)',
    type: 1,
    options: [
      {
        name: 'jmeno_ic',
        description: 'Jméno nebo IC dlužníka',
        type: 3, // string
        required: true,
      },
    ],
  },

  // BLACKLIST
  {
    name: 'blacklist-add',
    description: 'Přidej osobu na černou listinu',
    type: 1,
    options: [
      {
        name: 'jmeno_ic',
        description: 'Jméno nebo IC osoby',
        type: 3, // string
        required: true,
      },
      {
        name: 'steam_hex/discord_id',
        description: 'Steam HEX nebo Discord ID',
        type: 3, // string
        required: true,
      },
      {
        name: 'duvod',
        description: 'Důvod pro blacklist',
        type: 3, // string
        required: true,
        choices: [
          { name: 'Zrada', value: 'zrada' },
          { name: 'Fízlování (Policie)', value: 'fical' },
          { name: 'Krádež od frakce', value: 'kradzez' },
          { name: 'Neplacení', value: 'neplaceni' },
          { name: 'Nepříjemná osoba', value: 'soupet' },
          { name: 'Jiný důvod', value: 'jine' },
        ],
      },
    ],
  },
  {
    name: 'blacklist-list',
    description: 'Zobrazí seznam osob na blacklistu',
    type: 1,
  },

  // MANAGEMENT ČLENŮ
  {
    name: 'hodnost',
    description: 'Nastav hodnost člena (Nováček/Ověřený/Elite/Vedení)',
    type: 1,
    options: [
      {
        name: 'uživatel',
        description: 'Uživatel',
        type: 6, // user
        required: true,
      },
      {
        name: 'hodnost',
        description: 'Nová hodnost',
        type: 3, // string
        required: false,
        choices: [
          { name: 'Nováček', value: 'novaček' },
          { name: 'Ověřený', value: 'overeny' },
          { name: 'Elite', value: 'elite' },
          { name: 'Vedení', value: 'vedeni' },
        ],
      },
    ],
  },

  // AKCE (PLÁNOVÁNÍ)
  {
    name: 'akce-plan',
    description: 'Naplánuj novou operaci s hlasovacím systémem',
    type: 1,
    options: [
      {
        name: 'nazev',
        description: 'Název operace (např. Vykradení banky)',
        type: 3, // string
        required: true,
      },
      {
        name: 'cas',
        description: 'Čas operace (např. 20:00)',
        type: 3, // string
        required: true,
      },
      {
        name: 'popis',
        description: 'Popis operace a cíl',
        type: 3, // string
        required: true,
      },
    ],
  },

  // TRESTNÍ SYSTÉM
  {
    name: 'trest',
    description: 'Uděluj trest nebo pokutu členovi',
    type: 1,
    options: [
      {
        name: 'uživatel',
        description: 'Člen, který dostane trest',
        type: 6, // user
        required: true,
      },
      {
        name: 'duvod',
        description: 'Důvod pro trest',
        type: 3, // string
        required: true,
        choices: [
          { name: 'Neposlušnost', value: 'neposlusalost' },
          { name: 'Pozdní příchod', value: 'pozde_prichod' },
          { name: 'Neúspěšná operace', value: 'neuspesna_operace' },
          { name: 'Krádež', value: 'kradez' },
          { name: 'Podezření na zradu', value: 'zrada' },
          { name: 'Nepřiměřené chování', value: 'neprimerefene_chovani' },
          { name: 'Porušení pravidel', value: 'poruseni_pravidel' },
          { name: 'Zanechání věcí', value: 'zanechal_veci' },
          { name: 'Jiný důvod', value: 'jine' },
        ],
      },
      {
        name: 'pokuta/trest',
        description: 'Typ trestu',
        type: 3, // string
        required: true,
        choices: [
          { name: 'Ústní napomenutí', value: 'suhlas' },
          { name: 'Pokuta 5,000 Kč', value: 'pokutas_5000' },
          { name: 'Pokuta 25,000 Kč', value: 'pokutas_25000' },
          { name: 'Pokuta 50,000 Kč', value: 'pokutas_50000' },
          { name: 'Pokuta 100,000 Kč', value: 'pokutas_100000' },
          { name: 'Snížení pozice', value: 'snizeni_pozice' },
          { name: 'Dočasné vyloučení (3 dny)', value: 'vyloučeni' },
        ],
      },
    ],
  },
  {
    name: 'tresty-vypis',
    description: 'Zobrazí historii prohřešků člena',
    type: 1,
    options: [
      {
        name: 'uživatel',
        description: 'Člen',
        type: 6, // user
        required: true,
      },
    ],
  },
];

/**
 * Registrace příkazů na Discord
 */
async function registerCommands() {
  console.log('📋 Zaregistrovávám Slash příkazy...\n');

  const url = `https://discord.com/api/v10/applications/APPLICATION_ID/guilds/${GUILD_ID}/commands`;

  // Nejdřív musíš dosazit APPLICATION_ID!
  // Jdi do Discord Developer Portal → General Information → Copy Application ID

  const APPLICATION_ID = 'DOPLŇ_ТВОЈ_APPLICATION_ID_ZDE';

  if (APPLICATION_ID === 'DOPLŇ_ТВОЈ_APPLICATION_ID_ZDE') {
    console.error('❌ Chyba: APPLICATION_ID není nastaven!');
    console.error('Jdi na Discord Developer Portal → General Information → Kopíruj Application ID');
    console.error('Doplň APPLICATION_ID v tomto souboru (řádek ~420)');
    process.exit(1);
  }

  const fullUrl = `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`;

  for (const command of commands) {
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (response.ok) {
        console.log(`✅ ${command.name} - OK`);
      } else {
        const error = await response.json();
        console.error(`❌ ${command.name} - Chyba: ${error.message}`);
      }
    } catch (error) {
      console.error(`❌ ${command.name} - Chyba: ${error.message}`);
    }
  }

  console.log('\n✅ Registrace příkazů hotova!');
  console.log('Zkontroluj svůj Discord server - měly by se objevit nové Slash příkazy.');
}

// Spuštění
registerCommands().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
