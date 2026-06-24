# 🔫 FiveM Faction Discord Bot

Kompletní Discord bot pro správu nelegální frakce na FiveM serveru s pokročilým systémem pro management peněz, drog, članů a operací.

## 📋 Features

### 1. **RÁDIOVÝ SYSTÉM & INTERNÍ KÓDY**
- `/vysilackamain` - Zobrazí hlavní frekvenci
- `/vysilackasec` - Zobrazí sekundární frekvenci
- `/anonym-vedeni [zprava]` - Anonymní zpráva vedení (s kompletní ochranou identity)

### 2. **ADVANCED PANIC SYSTÉM** (Krize & Únosy)
- `/panic [uživatel]` - Simulace únosu - uloží role, odebere je
- `/panic-off [uživatel]` - Bezpečný návrat - obnovení všech rolí
- `/panicv [uživatel/všichni]` - Nouzový poplach vedení

### 3. **MANAGEMENT FINANCÍ**
- `/trezor-info` - Zobrazí stav kasy (čisté, špinavé, vyprané peníze)
- `/trezor-pohyb [typ] [akce] [částka] [důvod]` - Zaznamená finanční operaci

### 4. **MANAGEMENT SKLADU**
- `/sklad-drogy [akce] [druh] [množství]` - Tracking drog (marihuana, kokain, meth)
- `/sklad-log [akce] [předmět] [počet]` - Logování věcí (zbraně, lockpicky...)

### 5. **SYSTÉM DLUŽNÍKŮ**
- `/dluh-pridat [jmeno_ic] [castka] [datum] [kontakt]` - Přidá nového dlužníka
- `/dluh-list` - Zobrazí seznam dlužníků (červeně označí po splatnosti)
- `/dluh-smazat [jmeno_ic]` - Smaže dlužníka po zaplacení

### 6. **BLACKLIST SYSTÉM**
- `/blacklist-add [jmeno] [steam/discord] [duvod]` - Přidá osobu na blacklist
- `/blacklist-list` - Zobrazí seznam nežádoucích osob

### 7. **MANAGEMENT ČLENŮ**
- `/hodnost [uživatel] [hodnost]` - Nastaví hodnost člena (Nováček/Ověřený/Elite/Vedení)

### 8. **PLÁNOVÁNÍ AKCÍ** (S interaktivními tlačítky)
- `/akce-plan [nazev] [cas] [popis]` - Vytvoří novou operaci s hlasovacím systémem
  - 🟢 Jdu (Základní tým)
  - 🟡 Náhradník / Hlídka
  - 🔴 Nemůžu

### 9. **TRESTNÍ SYSTÉM**
- `/trest [uživatel] [duvod] [pokuta/trest]` - Udělí trest s automatickou pokutou
- `/tresty-vypis [uživatel]` - Zobrazí historii prohřešků

---

## 🛠️ Technické Specifikace

- **Hostování:** Vercel Serverless Functions
- **Databáze:** Vercel KV (Redis)
- **API:** Discord Interactions API (Webhooks)
- **Jazyk:** JavaScript (Node.js)
- **Bez externích stylů:** Pouze tmavě červené a černé Embeds

---

## 📦 Instalace a Nastavení

### 1. **Příprava na Discord Developer Portálu**

1. Jdi na https://discord.com/developers/applications
2. Vytvoř novou aplikaci ("New Application")
3. Jdi na "Bot" sekci → "Add Bot"
4. Kopíruj **Token** a ulož si ho
5. Jdi na "OAuth2" → "URL Generator"
6. Vyber scopes: `bot`, `applications.commands`
7. Vyber permissions: 
   - `Read Messages/View Channels`
   - `Send Messages`
   - `Manage Roles`
   - `Manage Guild`
8. Zkopíruj vygenerovanou URL a otevři ji v prohlížeči → přidáš bota na svůj server

### 2. **Public Key a Interactions Endpoint**

1. V "General Information" sekci zkopíruj **Public Key**
2. V "Interactions Endpoint URL" nastav: `https://tvoj-bot.vercel.app/api/interactions`
   (Po nasazení na Vercel!)

### 3. **Lokální Setup**

```bash
# Klonuj repo
git clone <tvoj-repo>
cd fivem-faction-bot

# Instaluj závislosti
npm install

# Vytvoř .env.local (kopíruj z .env.example)
cp .env.example .env.local

# Vyplň .env.local svými hodnotami:
# - DISCORD_TOKEN
# - DISCORD_PUBLIC_KEY
# - GUILD_ID
# - Všechny CHANNEL_ID a ROLE_ID
```

### 4. **Nastavení Kanálů a Rolí**

V Discord serveru si vytvoř:

**Kanály:**
- `#radio-main` (CHANNEL_ID_RADIO)
- `#vedeni` (VEDENI_CHANNEL_ID) - skrytý kanál jen pro vedení
- `#krize` (PANIC_CHANNEL_ID)
- `#logy` (LOGS_CHANNEL_ID)
- `#operace` (AKCE_CHANNEL_ID)

**Role:**
- `PANIC` (PANIC_ROLE_ID) - pro únosy
- `Vedení` (VEDENI_ROLE_ID)

Zkopíruj ID těchto kanálů a rolí do `.env.local`

### 5. **Nasazení na Vercel**

```bash
# Přihlášení do Vercel
vercel login

# Deploy projektu
vercel

# Nebo připoj GitHub repo a deploy přes Vercel dashboard
```

### 6. **Nastavení Vercel KV (Redis)**

1. V Vercel dashboardu → Storage → Create Database
2. Vyber "Vercel KV"
3. Pojmenuj ji (např. "faction-bot-kv")
4. Vercel automaticky nastaví `KV_*` proměnné

### 7. **Discord Bot Slash Commands (Opět)**

Po nasazení musíš zaregistrovat Slash příkazy. Jdi do Discord Developer Portálu a přidej následující příkazy:

```
/vysilackamain
/vysilackasec
/anonym-vedeni (zprava: string)
/panic (uživatel: string)
/panic-off (uživatel: string)
/panicv (typ: string)
/trezor-info
/trezor-pohyb (typ: choice, akce: choice, castka: integer, duvod: string)
/sklad-drogy (akce: choice, druh: choice, mnozstvi: integer)
/sklad-log (akce: choice, predmet: string, pocet: integer)
/dluh-pridat (jmeno_ic: string, castka: integer, datum_splatnosti: string, kontakt: string)
/dluh-list
/dluh-smazat (jmeno_ic: string)
/blacklist-add (jmeno_ic: string, steam_hex/discord_id: string, duvod: choice)
/blacklist-list
/hodnost (uživatel: string, hodnost: choice)
/akce-plan (nazev: string, cas: string, popis: string)
/trest (uživatel: string, duvod: choice, pokuta/trest: choice)
/tresty-vypis (uživatel: string)
```

---

## 📁 Struktura Projektu

```
.
├── package.json
├── .env.example
├── api/
│   ├── interactions.js (Hlavní handler)
│   └── commands/
│       ├── radio.js
│       ├── anonym.js
│       ├── panic.js
│       ├── trezor.js
│       ├── sklad.js
│       ├── dluhy.js
│       ├── blacklist.js
│       ├── hodnost.js
│       ├── akce.js
│       └── trestyapokutny.js
└── README.md
```

---

## 🔐 Bezpečnost

⚠️ **DŮLEŽITÉ:**
- NIKDY nesdílej svůj `DISCORD_TOKEN` nebo `DISCORD_PUBLIC_KEY`
- Ulož `.env.local` do `.gitignore`
- Všechny citlivé informace jsou uloženy v Vercel environment variables

---

## 💾 Databáze (Vercel KV)

Bot používá Vercel KV (Redis) pro ukládání dat:

```
// Klíče v KV:
frakce:trezor                    // Stav kasy
sklad:drogy                      // Inventory drog
sklad:veci                       // Inventory věcí
dluznik:{jmeno}                  // Informace o dlužníkovi
dluhy:index                      // Seznam všech dlužníků
blacklist:{jmeno}                // Osoba na blacklistu
blacklist:index                  // Seznam blacklistu
clen:hodnost:{userId}            // Hodnost člena
clen:tresty:{userId}             // Lista trestů člena
trest:{trestId}                  // Informace o trestu
akce:{akceId}                    // Informace o akci
hlaseni:{hlaseniId}              // Anonymní hlášení
panic:{userId}                   // Data o paniku (uložené role)
```

---

## 🚀 Vercel Deploy Checklist

- [x] Máš vytvořeného Discord bota
- [x] Máš Token a Public Key
- [x] Máš vytvořené kanály a role
- [x] Máš Vercel účet
- [x] Máš nastavený Vercel KV storage
- [x] Máš vyplněné všechny env proměnné
- [x] Deploy je hotov na `https://tvoj-bot.vercel.app`
- [x] Discord Bot má nastavený Interactions Endpoint na `https://tvoj-bot.vercel.app/api/interactions`
- [x] Zaregisonoval jsi Slash příkazy

---

## 🐛 Troubleshooting

### Bot nereaguje na příkazy
- Zkontroluj, že Interactions Endpoint URL je správně nastavena
- Verifikuj, že máš spravný Discord Token v env
- Uprav na Discord serveru permise bota

### Chyby s Vercel KV
- Zkontroluj, že je database připojená
- Ověř, že máš správné `KV_*` proměnné
- Zkuste restartovat deployment

### Embed zprávy se nezobrazují
- Zkontroluj, že bot má permise "Send Messages"
- Ověř, že má bot roli s dostatečnými oprávněními

---

## 📝 Tips pro Používání

1. **Frecquence změna:** V `api/commands/radio.js` měníš `MAIN_FREQUENCY` a `SEC_FREQUENCY`
2. **Nová role:** Přidej do `HODNOSTI` objekt v `api/commands/hodnost.js`
3. **Nová droga:** Přidej do `DROGY_TYPY` v `api/commands/sklad.js`
4. **Logy:** Všechny operace jsou logované v `LOGS_CHANNEL_ID`

---

## ⚖️ Legální upozornění

Tento bot je určen POUZE pro privátní Discord server s členstvím frakce. Pokud používáš funkce spojené s nelegálními aktivitami v jakémkoliv oficiálním či komerčním účelu, přebíráš si plnou odpovědnost.

---

## 📞 Support & Kontakt

Máš problémy? Zkontroluj:
- Discord Developer Documentation: https://discord.com/developers/docs
- Vercel Documentation: https://vercel.com/docs
- Node.js Documentation: https://nodejs.org/docs

---

**Vytořeno pro FiveM komunitu 🎮**

*Poslední aktualizace: 2024*
#   t e s t  
 