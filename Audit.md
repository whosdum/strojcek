# Strojcek UI/UX Audit

> Kompletny audit vsetkych komponentov, stranok a stylov. Vysledky zoradene podla priority.
> Datum: 15. april 2026

---

## Obsah

- [P0 — Kriticke](#p0--kriticke)
- [P1 — Vysoka priorita](#p1--vysoka-priorita)
- [P2 — Stredna priorita](#p2--stredna-priorita)
- [P3 — Nizka priorita](#p3--nizka-priorita)
- [Pozitivne nalezy](#pozitivne-nalezy)

---

## P0 — Kriticke

### 1. Chybajuce ARIA atributy na formularoch (Booking + Admin)

**Dopad:** Screenreader pouzivatelia nevedia pouzit formulare.

- `src/components/booking/contact-form.tsx` — inputy nemaju `aria-invalid`, `aria-describedby`, `aria-required`
- `src/components/admin/barber-form.tsx` — rovnaky problem (riadky 93-169)
- `src/components/admin/service-form.tsx` — rovnaky problem (riadky 68-144)
- `src/components/admin/customer-edit-form.tsx` — rovnaky problem (riadky 59-113)

**Fix:** Ku kazdemu inputu pridat:
```tsx
aria-invalid={!!errors.fieldName}
aria-describedby="fieldName-error"
aria-required
```

---

### 2. Chybajuce ARIA na interaktivnych elementoch (Booking)

- `src/components/booking/slot-chip.tsx` (riadky 13-25) — casove sloty nemaju `aria-label` ani `aria-pressed`
- `src/components/booking/section-wrapper.tsx` (riadky 46-61) — pouziva `role="button"` namiesto `<button>` elementu
- `src/components/booking/booking-wizard.tsx` (riadky 601-622) — progress indikator nema `role="progressbar"` ani `aria-valuenow`

---

### 3. Prazdne stavy bez spravneho feedbacku

**Dopad:** Pouzivatel vidi prazdnu sekciu a nevie co sa deje.

- `src/components/booking/booking-wizard.tsx` (riadok 639) — ak su 0 sluzieb, sekcia sa vyrenderuje prazdna bez spravy
- `src/components/booking/booking-wizard.tsx` (riadok 668) — ak su 0 barberov pre sluzbu, prazdny grid bez spravy
- `src/app/(admin)/admin/customers/page.tsx` — tabulka zakaznikov nema empty state
- `src/app/(admin)/admin/barbers/page.tsx` — tabulka barberov nema explicitny empty state

**Fix:** Pridat `{items.length === 0 && <p>Ziadne polozky</p>}` do kazdeho listu.

---

### 4. JPEG favicon

**Dopad:** Favicon sa nezobrazuje spravne vo vacsine prehliadacov.

- `src/app/layout.tsx` (riadky 57-59) — pouziva `/logo.jpg` ako favicon
- Prehliadace ocakavaju `.ico`, `.svg`, alebo `.png`

**Fix:** Vygenerovat spravne favicon subory (16x16, 32x32, 192x192, 512x512) a aktualizovat metadata.

---

### 5. Nedefinovany monospace font

- `src/app/globals.css` (riadok 11) — referuje `--font-geist-mono` ktory nikde nie je definovany
- Vsledok: fallback na system monospace font

**Fix:** Pridat Geist Mono do fontu loadingu alebo odstranit referenciu.

---

### 6. Chybajuci error boundary na hlavnej stranke

- `src/app/page.tsx` — ziadny `error.tsx` subor pre pripad zlyhania data fetchingu
- Ak `getCachedActiveServices()` alebo `getCachedActiveBarbersWithServices()` zlyhaju, pouzivatel vidi prazdnu stranku alebo Next.js error

**Fix:** Pridat `src/app/error.tsx` s user-friendly chybovou spravou.

---

## P1 — Vysoka priorita

### 7. Chybajuce `aria-live` regiony pre async stavy (Booking)

- `src/components/booking/booking-wizard.tsx` (riadky 719-731) — loading stav "Nacitavam volne terminy..." nema `aria-live="polite"` ani `role="status"`
- Error blok (riadky 522-540) nema `role="alert"`
- Success screen (riadky 439-516) nema `aria-live="polite"`

---

### 8. Chybajuci toast/notification system v admin paneli

**Dopad:** Pouzivatel nevie ci operacia prebehla uspesne.

Iba 1 komponent (`src/components/admin/slot-interval-setting.tsx`) pouziva toasty. Vsetky ostatne operacie su "silent":

- Ulozenie barbera — tichy redirect (`src/components/admin/barber-form.tsx`, riadky 78-81)
- Uprava zakaznika — zavolanie `onClose()` + `router.refresh()` bez feedbacku
- Zmena statusu rezervacie — len refresh stranky (`src/components/admin/status-actions.tsx`, riadok 43)
- Vytvorenie sluzby — tichy redirect

**Fix:** Pridat `toast.success("...")` / `toast.error("...")` ku kazdej mutacii. Sonner uz je v projekte (`src/components/ui/sonner.tsx`).

---

### 9. Chybajuca podpora `prefers-reduced-motion`

- `src/components/booking/booking-wizard.tsx` (riadky 276-284) — `scrollIntoView({ behavior: "smooth" })` ignoruje pouzivatelske nastavenia
- `src/components/booking/booking-shell.tsx` (riadok 17) — `transition-colors duration-300`
- `src/components/admin/admin-calendar.tsx` — pulsujuca animacia pre IN_PROGRESS stav

**Fix:** Zabalit animacie do `@media (prefers-reduced-motion: reduce)` alebo pouzit `motion-safe:` Tailwind prefix.

---

### 10. Chybajuce potvrdenie pred zrusenim rezervacie

- `src/components/booking/cancel-button.tsx` (riadky 19-24) — priamo rusi bez confirmation dialogu
- Pouzivatel klikne "Zrusit rezervaciu" a ta sa okamzite zrusi

**Fix:** Pridat AlertDialog: "Naozaj chcete zrusit rezervaciu na [datum] o [cas]?"

---

### 11. Tema nerespektuje system preference

- `src/components/booking/theme-toggle.tsx` (riadky 15, 19) — default je "light", ignoruje `prefers-color-scheme: dark`
- Prvy navstevnik s dark system temou vidi flash bielej

**Fix:** Detekovat `window.matchMedia('(prefers-color-scheme: dark)')` pri prvom loade.

---

### 12. Chybajuci `font-display: swap`

- `src/app/layout.tsx` (riadky 6-9) — Plus_Jakarta_Sans nema `display: "swap"`
- Vysledok: FOIT (Flash of Invisible Text) pocas loadovania fontu

**Fix:** Pridat `display: "swap"` do font konfiguracie.

---

### 13. Duplicovane STATUS_LABELS definicie v admin paneli

Mapovanie statusov na labels a varianty je definovane na 5 miestach:
- `src/app/(admin)/admin/page.tsx`
- `src/app/(admin)/admin/reservations/page.tsx`
- `src/app/(admin)/admin/reservations/[id]/page.tsx`
- `src/app/(admin)/admin/customers/[id]/page.tsx`
- `src/components/admin/status-actions.tsx`

**Fix:** Vytvorit jedinu definicu v `src/lib/constants.ts` a importovat vsade.

---

### 14. Browser `confirm()` namiesto AlertDialog

- `src/components/admin/schedule-manager.tsx` (riadok 74) — pouziva `confirm("Naozaj chcete zmazat tuto prestavku?")`
- Nestylovatelne, nekonzistentne s ostatnymi confirmation dialogs

**Fix:** Nahradit `confirm()` za AlertDialog komponent.

---

### 15. Terms checkbox bez error spravy

- `src/components/booking/booking-wizard.tsx` (riadky 779-812) — checkbox je povinny, ale pri nezaskrtnuti sa len disable-ne submit button
- Pouzivatel nevie preco je button disabled

**Fix:** Pridat chybovu spravu pod checkbox ked je nezaskrtnuty a pouzivatel scrollne k buttonu.

---

### 16. Kontaktny formular nema loading stav pri submite

- `src/components/booking/contact-form.tsx` (riadky 194-201) — button je `disabled={!canSubmit}` ale nezobrazuje spinner
- Pouzivatel nevie ci sa nieco deje

---

## P2 — Stredna priorita

### 17. Back button prilis maly pre touch

- `src/components/booking/booking-wizard.tsx` (riadky 591-600) — `size-8` (32px)
- WCAG odporuca minimalne 44px pre touch targety

**Fix:** Zvysit na `size-11` (44px).

---

### 18. Telefonny input — nekonzistentny format

- `src/components/booking/contact-form.tsx` (riadky 116-136)
- Placeholder: "9XX XXX XXX" naznacuje formatovanie, ale input sa neformatuje
- Pouzivatel zada "903123456", ale v summary sa zobrazi "+421 903 123 456"

**Fix:** Bud auto-formatovat pocas typovania alebo zobrazit presny format v placeholder.

---

### 19. Chybajuce breadcrumbs v admin detail strankach

- `/admin/reservations/[id]` — iba maly "Spat" link
- `/admin/customers/[id]` — iba maly "Spat" link
- Ziadne breadcrumbs v celom admin paneli

---

### 20. Tabulky bez sortingu a bulk akcii

- `src/app/(admin)/admin/reservations/page.tsx` — ziadne kliknutelne hlavicky pre sort
- `src/app/(admin)/admin/barbers/page.tsx` — rovnako
- `src/app/(admin)/admin/services/page.tsx` — rovnako
- Ziadne checkboxy pre bulk operacie (napr. zmena statusu 20 rezervacii naraz)

---

### 21. Paginacia bez celkoveho poctu

- `src/app/(admin)/admin/reservations/page.tsx` (riadky 146-162) — zobrazuje iba cisla stranok
- Chyba: "Zobrazujem 1-25 z 500", tlacidla predchadzajuca/nasledujuca, volba poctu na stranku

---

### 22. Chybajuce autoComplete atributy

- `src/components/booking/contact-form.tsx` — inputy nemaju `autoComplete="given-name"`, `autoComplete="family-name"`, `autoComplete="email"`, `autoComplete="tel"`
- `src/app/(admin)/login/page.tsx` — login formular nema `autoComplete="email"` a `autoComplete="current-password"`

---

### 23. Chybajuce skeleton loading stavy

- Vsetky loading stavy pouzivaju iba spinner + text
- Ziadne skeleton screeny zobrazujuce ocakavany tvar obsahu
- Dotknutych: booking wizard, admin tabulky, calendar

---

### 24. Calendar nema loading indikator

- `src/components/admin/admin-calendar.tsx` (riadky 103-150) — fetchuje eventy bez loading stavu
- Ak API dlho odpoveda, kalendar vyzera prazdny
- Error handling iba loguje do konzoly, pouzivatel nic nevidi

---

### 25. Formatovanie cien bez tisicovych oddelovacov

- `src/app/(admin)/admin/services/page.tsx` — ceny su zobrazene ako `10000 €` namiesto `10 000 €`
- `src/app/(admin)/admin/page.tsx` (riadok 171) — revenue bez formatovania

**Fix:** Pouzit `Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' })`.

---

### 26. Schedule manager nie je mobilne optimalizovany

- `src/components/admin/schedule-manager.tsx` (riadky 212-252) — time inputy (`sm:w-28`) sa na mobile zle stackuju
- 7 tabov (po jednom na den) sa na mobile nezobrazuju dobre

---

### 27. Zmena statusu rezervacie bez potvrdenia

- `src/components/admin/status-actions.tsx` (riadky 48-65) — dropdown meni status bez confirmation dialogu
- Nahodne kliknute muze zmenit stav na nespravny

---

### 28. Admin logout bez potvrdenia

- `src/components/admin/sidebar.tsx` (riadok 98) — zavolanie `signOut` bez AlertDialog
- Pridat: "Naozaj sa chcete odhlasit?"

---

### 29. Chybajuci `<main>` tag

- `src/app/page.tsx` — BookingWizard nie je zabaleny v `<main>` tagu
- `src/app/(public)/cancel/page.tsx` — rovnako
- Dopad na semantiku a screen readery

---

### 30. Chybajuci `<noscript>` fallback

- Booking wizard je plne client-side (`"use client"`)
- Ak ma pouzivatel vypnuty JavaScript, vidi prazdnu stranku
- **Fix:** Pridat `<noscript>Pre pouzitie rezervacneho systemu zapnite JavaScript.</noscript>`

---

## P3 — Nizka priorita

### 31. Chybajuci character counter v cancel textarea

- `src/components/booking/cancel-button.tsx` (riadky 54-63) — textarea ma `maxLength={500}` ale pouzivatel nevidi kolko znakov zostava

---

### 32. Chybajuca PWA podpora

- Ziadny `manifest.json`
- Ziadny service worker
- Mobilni pouzivatelia si nemazu "nainstalovat" aplikaciu

---

### 33. Chybajuci `theme-color` meta tag

- `src/app/layout.tsx` — browser UI (address bar na mobile) nema nastavenu farbu
- **Fix:** Pridat `themeColor: "#A0623A"` do metadata

---

### 34. Nekonzistentne velkosti ikon

- `src/components/booking/booking-wizard.tsx`:
  - Clock ikona: `size-3.5`
  - Loader ikona: `size-5`
  - Service card ikona: `size-5`
  - Avatar ikona: `size-10`
- Chyba jasna hierarchia

---

### 35. Univerzalny `*` selektor v CSS

- `src/app/globals.css` (riadok 247) — `* { @apply border-border outline-ring/50; }` je drahy
- **Fix:** Pouzit specifickejsie selektory.

---

### 36. Chybajuce `::selection` a scrollbar styling

- `src/app/globals.css` — ziadne vlastne selection farby ani scrollbar stylovanie

---

### 37. Booking wizard neuchovava draft

- Ak pouzivatel zatvori tab uprostred bookingu, strati vsetko
- Moznost: `localStorage` alebo `sessionStorage` pre draft stav

---

### 38. Chybajuci "Zabudnute heslo" na login stranke

- `src/app/(admin)/login/page.tsx` — iba email + heslo formular bez recovery linku

---

### 39. Kalendar — farby bez textovych alternativ

- `src/components/admin/admin-calendar.tsx` (riadky 12-19) — barberi odliseni iba farbou
- Problematicke pre farboslepy pouzivatelov
- Legenda (riadky 164-221) pomaha ale nie je interaktivna (neda sa filtrovat kliknutim)

---

### 40. Dashboard — statistiky bez casoveho kontextu

- `src/app/(admin)/admin/page.tsx` (riadky 40-77) — cisla bez "Posledna aktualizacia" timestampu
- Cisla bez kontextu (je 5 dokonceny ch rezervacii dobry alebo zly vysledok?)

---

### 41. Tabulky na tablete mozu pretiekat

- Admin tabulky pouzivaju desktop layout od `md:` (768px)
- Na tablete v landscape moze byt prilis vela stlpcov
- `table-fixed` layout moze orezat obsah

---

### 42. Nebrandovane `confirm()` dialogy

- `src/components/admin/schedule-manager.tsx` — uz zmienenych v P1, ale aj UX aspekt: browser confirm vytvara pocit "lacnej" aplikacie

---

### 43. Chybajuce keyboard shortcuts pre power userov

- Ziadne `Ctrl+K` command palette
- Ziadne `Ctrl+S` pre ulozenie formulara
- Ziadne `Escape` pre zrusenie operacie

---

### 44. Filtrovanie rezervacii — chybajuce filtre

- `src/app/(admin)/admin/reservations/page.tsx` (riadky 57-68) — iba status filter
- Chyba: filter podla barbera, datumoveho rozsahu
- Parameter `barberId` existuje v kode (riadok 41) ale nie je vystaveny v UI

---

### 45. Mobile card view vs desktop table view — nekonzistentny UX

- Admin tabulky pouzivaju dva rozne layouty (karty na mobile, tabulka na desktope)
- Informacie zobrazene na kartach sa mozu lisit od tabulky

---

---

## Pozitivne nalezy

Projekt ma solidny zaklad:

- **Kvalitna komponentova kniznica** — vsetkych 18 shadcn/ui primitiv je spravne implementovanych s CVA variantmi
- **OKLCH farebny system** — perceptualne konzistentne farby s dobre nastavenym dark mode
- **Responzivny design** — mobile-first pristup s dobrymi breakpointmi
- **Touch-friendly rozmery** — vacsina interaktivnych elementov ma minimalne 44px
- **Spravne input typy** — `type="tel"`, `type="email"`, `inputMode="numeric"` kde treba
- **Label asociacia** — vsetky inputy maju `<label htmlFor>`
- **Casove sloty** — spravne zobrazenie "ziadne terminy" s moznostou vybrat iny den
- **Date handling** — konzistentne pouzitie `date-fns` + `date-fns-tz` so slovenskou lokalizaciou
- **Strukturovane data** — JSON-LD pre business markup
- **SEO zaklady** — metadata, OG tagy, Twitter cards
- **Admin navigacia** — jasne sidebar labely, ikonky, active stavy
- **Delete confirmations** — AlertDialog pred zmazanim zakaznika/rezervacie
- **Zod validacia** — konzistentne validacne schemy so slovenskymi chybovymi spravami
- **Focus styly** — konzistentny `focus-visible:ring-3` pattern napriec komponentmi
- **Antialiasing** — globalny `antialiased` class
- **Booking tema** — vizualne oddelena od admin panela

---

## Statistika

| Priorita | Pocet nalezov |
|----------|--------------|
| P0 — Kriticke | 6 |
| P1 — Vysoka | 10 |
| P2 — Stredna | 14 |
| P3 — Nizka | 15 |
| **Celkom** | **45** |

| Oblast | Pocet |
|--------|-------|
| Accessibility | 12 |
| User Feedback | 7 |
| Error/Loading States | 7 |
| Theme/Styling | 6 |
| Form UX | 5 |
| Navigation | 4 |
| Data Display | 4 |
