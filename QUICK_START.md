🚀 QUICK START GUIDE - FiveM Faction Bot
========================================

Chceš mít bota hotového v 10 krocích? Tady je postup:

---

## KROK 1: Discord Developer Portal

1. Jdi na https://discord.com/developers/applications
2. Klikni "New Application"
3. Pojmenuj ji (např. "FiveM Faction Bot")
4. Jdi na "Bot" → "Add Bot"
5. **KOPÍRUJ si Token** a ulož ho někam (DISCORD_TOKEN)
6. Jdi na "General Information"
7. **KOPÍRUJ si Application ID** (budeš ho potřebovat později)
8. **KOPÍRUJ si Public Key** (DISCORD_PUBLIC_KEY)

✅ Co máš: DISCORD_TOKEN, APPLICATION_ID, DISCORD_PUBLIC_KEY

---

## KROK 2: Vytvoření Kanálů na Discord Serveru

Na svém Discord serveru si vytvoř (pravý klik → Vytvořit kanál):

1. `#radio-main` → Zkopíruj ID (CHANNEL_ID_RADIO)
2. `#vedeni` (soukromý kanál pro vedení) → Zkopíruj ID (VEDENI_CHANNEL_ID)
3. `#krize` (pro PANIC systém) → Zkopíruj ID (PANIC_CHANNEL_ID)
4. `#logy` (pro logging všech akcí) → Zkopíruj ID (LOGS_CHANNEL_ID)
5. `#operace` (pro plánování akcí) → Zkopíruj ID (AKCE_CHANNEL_ID)

Pro kopírování ID: Nastavení → Vývojářský režim → Pravý klik na kanál → Kopírovat ID

✅ Co máš: Všechny CHANNEL_ID

---

## KROK 3: Vytvoření Rolí na Discord Serveru

Na svém serveru si vytvoř role (Nastavení → Role):

1. `PANIC` → Zkopíruj ID (PANIC_ROLE_ID)
2. `Vedení` → Zkopíruj ID (VEDENI_ROLE_ID)

✅ Co máš: Všechny ROLE_ID

---

## KROK 4: Přidání Bota na Server

1. V Discord Developer Portálu jdi na OAuth2 → URL Generator
2. Vyber Scopes: `bot`, `applications.commands`
3. Vyber Permissions:
   - Read Messages/View Channels
   - Send Messages
   - Manage Roles
   - Manage Guild
   - Use Application Commands
4. Zkopíruj vygenerovanou URL
5. Otevři ji v prohlížeči → Vyber svůj server → Autorizuj

✅ Bot je nyní na tvém serveru

---

## KROK 5: Naklonování Repozitáře

```bash
# V terminálu
git clone <URL_TVÉHO_REPO>
cd fivem-faction-bot

# Instalace závislostí
npm install
```

✅ Máš zdrojový kód

---

## KROK 6: Nastavení .env.local

```bash
# Zkopíruj .env.example do .env.local
cp .env.example .env.local
```

Otevři `.env.local` v editoru a vyplň:

```
DISCORD_TOKEN=<tvůj token z kroku 1>
DISCORD_PUBLIC_KEY=<tvůj public key z kroku 1>
GUILD_ID=<ID tvého serveru - pravý klik → Kopírovat ID>
CHANNEL_ID_RADIO=<ID kanálu #radio-main>
VEDENI_CHANNEL_ID=<ID kanálu #vedeni>
PANIC_CHANNEL_ID=<ID kanálu #krize>
LOGS_CHANNEL_ID=<ID kanálu #logy>
AKCE_CHANNEL_ID=<ID kanálu #operace>
PANIC_ROLE_ID=<ID role PANIC>
VEDENI_ROLE_ID=<ID role Vedení>
```

✅ Konfigurace je hotova

---

## KROK 7: Nasazení na Vercel

```bash
# Instalace Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Vercel ti dá URL (něco jako `https://tvoj-bot.vercel.app`)

✅ Bot je nasazen

---

## KROK 8: Nastavení Vercel KV (Databáze)

1. V Vercel dashboardu
2. Jdi na projekt
3. Storage → Create Database
4. Vyber "Vercel KV"
5. Pojmenuj ji (např. "faction-bot")
6. **DONE!** - Vercel automaticky nastaví proměnné

✅ Databáze je připravená

---

## KROK 9: Nastavení Interactions Endpoint

1. V Discord Developer Portálu
2. Jdi na "Interactions Endpoint URL"
3. Doplň: `https://tvoj-bot.vercel.app/api/interactions`
4. Klikni "Save" (Discord ověří URL - mělo by pípnout)

✅ Discord je připraven

---

## KROK 10: Registrace Slash Příkazů

```bash
# V terminálu
# 1. Otevři register-commands.js
# 2. Najdi řádek: const APPLICATION_ID = 'DOPLŇ_TVOJ_APPLICATION_ID_ZDE'
# 3. Doplň APPLICATION_ID z kroku 1
# 4. Spusť:

node register-commands.js
```

Měls viděti: ✅ vysilackamain - OK atd.

✅ Všechny příkazy jsou zaregistrovány!

---

## 🎉 HOTOVO!

Teď by měl bot fungovat! Zkus v Discord serveru:
```
/vysilackamain
/trezor-info
/blacklist-list
```

Měly by ti vyjít zprávy s embedy.

---

## ❌ Něco nefunguje?

### Bot nereaguje na příkazy
- Zkontroluj, že máš v .env správné CHANNEL_ID a ROLE_ID
- Zkontroluj, že bot má oprávnění na serveru (Role)
- Zkontroluj logs v Vercel dashboardu

### Chyba: "Unknown interaction"
- Tvoje Interactions Endpoint URL není správně nastavena
- Discord se nemohl připojit k tvému Vercel URL
- Zkus restartovat deployment

### Chyba: "Cannot read property of undefined"
- Někde chybí env proměnná
- Zkontroluj .env.local - všechno je vyplněno?

### Vercel KV chyba
- Zkontroluj, že je database vytvořená
- Restartuj deployment

---

## 📝 Příkazy pro testování

```
/vysilackamain                          # Rádiový systém
/trezor-info                            # Finance
/sklad-drogy wypis marihuana 0          # Sklad
/dluh-list                              # Dlužníci
/blacklist-list                         # Blacklist
/hodnost @user novaček                  # Hodnosti
/akce-plan "Vykradení banky" "20:00" "Cíl: Vault" # Akce
/tresty-vypis @user                     # Tresty
```

---

## 🔐 BEZPEČNOST!

⚠️ **VÁŽNÉ UPOZORNĚNÍ:**
- NIKDY nesdílej DISCORD_TOKEN
- NIKDY necommituj .env.local do GITu
- Ulož .env.local do `.gitignore`

```bash
# Přidej do .gitignore
.env.local
.env
node_modules/
```

---

## 📞 Problemy?

Zkontroluj README.md pro detailnější informace.

Problém s Vercel? https://vercel.com/docs
Problém s Discord? https://discord.com/developers/docs
Problém s Node.js? https://nodejs.org/docs

---

**Gratuluji! Máš funkční FiveM Faction bot! 🎉**

Teď ho můžeš používat k správě své frakce.

Užijte si! 🚀
