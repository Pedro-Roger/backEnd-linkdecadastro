# Redirect to WhatsApp Group + Hide Form Cities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a public registration succeeds, redirect the visitor straight to the event's WhatsApp group link instead of showing a link they must click; and let admins hide individual cities from the "Cidades do Formulário" list so they disappear from the public registration form without being deleted.

**Architecture:** Two independent, small changes across two sibling git repositories (no shared top-level repo). Feature 1 is frontend-only (`RegistrationForm.tsx`): on successful submit, if the event has a `groupInviteLink`, navigate the browser there via `window.location.href`. Feature 2 adds an optional `hidden` flag to each entry of the existing `Event.formCities` JSON array (no schema/migration needed — it's already `Json?`). The admin UI (`EditEventPage.tsx`) gets a per-city toggle to flip `hidden` without removing the city. The two public read paths (`EventsService.getEventByLink` / `getEventBySlug`) filter out `hidden` entries server-side before returning the event, so hidden cities never reach the public form regardless of frontend logic.

**Tech Stack:** Backend: NestJS 10, Prisma 5 (MongoDB), Jest. Frontend: React 18 + Vite, react-hook-form, Tailwind, lucide-react icons. No unit test framework on the frontend (only Playwright e2e, which requires a live seeded backend+DB and is out of scope for this plan — verification of frontend changes is manual, via Task 5).

**Repos:**
- Backend: `/Users/pedroroger/Documents/LinkdeCadastro/backEnd-linkdecadastro`
- Frontend: `/Users/pedroroger/Documents/LinkdeCadastro/linkdecadastro-app`

Each repo has its own independent git history — commit steps below `cd` into the correct one.

---

## File Map

| Action | Repo | Path |
|--------|------|------|
| Modify | backend | `src/events/events.service.ts` |
| Modify | backend | `src/events/events.service.spec.ts` |
| Modify | backend | `src/admin-events/dto/update-event.dto.ts` |
| Modify | frontend | `src/pages/admin/EditEventPage.tsx` |
| Modify | frontend | `src/components/forms/RegistrationForm.tsx` |

---

### Task 1: Backend — filter hidden cities out of public `formCities`

**Files:**
- Modify: `backEnd-linkdecadastro/src/events/events.service.ts`
- Test: `backEnd-linkdecadastro/src/events/events.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Open `backEnd-linkdecadastro/src/events/events.service.spec.ts`. Add a new test inside the existing `describe('getEventByLink', ...)` block (after the existing `it('should return the group invite link...')` test, still inside the same `describe`):

```ts
    it('should filter out cities marked as hidden from formCities', async () => {
      mockEventsRepository.findUnique.mockResolvedValue({
        id: 'event-id',
        title: 'Test Event',
        status: 'ACTIVE',
        formCities: [
          { city: 'Fortaleza', state: 'CE' },
          { city: 'Sobral', state: 'CE', hidden: true },
        ],
      });

      const result = await service.getEventByLink('evt-123');

      expect(result.formCities).toEqual([{ city: 'Fortaleza', state: 'CE' }]);
    });
```

Then add a brand new `describe` block for `getEventBySlug` right after the `getEventByLink` block closes (there is no existing coverage for this method):

```ts
  describe('getEventBySlug', () => {
    it('should filter out cities marked as hidden from formCities', async () => {
      mockEventsRepository.findUnique.mockResolvedValue({
        id: 'event-id',
        title: 'Test Event',
        status: 'ACTIVE',
        slug: 'evento-teste',
        formCities: [
          { city: 'Fortaleza', state: 'CE' },
          { city: 'Sobral', state: 'CE', hidden: true },
        ],
      });

      const result = await service.getEventBySlug('evento-teste');

      expect(result.formCities).toEqual([{ city: 'Fortaleza', state: 'CE' }]);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backEnd-linkdecadastro && npx jest src/events/events.service.spec.ts`
Expected: FAIL — both new tests fail because `result.formCities` still contains the `Sobral` entry (the service currently returns `formCities` untouched).

- [ ] **Step 3: Implement the filter**

Open `backEnd-linkdecadastro/src/events/events.service.ts`. Add a private method at the bottom of the class, and use it in both `getEventByLink` and `getEventBySlug`:

```ts
  async getEventByLink(linkId: string) {
    const event = await this.eventsRepository.findUnique({
      where: { linkId },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.status !== 'ACTIVE') {
      throw new ForbiddenException('Evento não está ativo');
    }

    return this.withVisibleFormCities(event);
  }

  async getEventBySlug(slug: string) {
    const normalizedSlug = slug.toLowerCase().trim();
    let event = await this.eventsRepository.findUnique({
      where: { slug: normalizedSlug },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event && normalizedSlug.startsWith('evt-')) {
      event = await this.eventsRepository.findUnique({
        where: { linkId: normalizedSlug },
        include: {
          _count: {
            select: { registrations: true },
          },
        },
      });
    }

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.status !== 'ACTIVE') {
      throw new ForbiddenException('Evento não está ativo');
    }

    return this.withVisibleFormCities(event);
  }

  private withVisibleFormCities(event: any) {
    if (!Array.isArray(event?.formCities)) {
      return event;
    }

    return {
      ...event,
      formCities: event.formCities.filter((city: any) => !city?.hidden),
    };
  }
```

Replace the final `return event;` line in both methods with `return this.withVisibleFormCities(event);` as shown above, and add the new private method after `getEventBySlug`, before the closing `}` of the class.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backEnd-linkdecadastro && npx jest src/events/events.service.spec.ts`
Expected: PASS — all tests (the 2 pre-existing plus the 2 new ones) pass.

- [ ] **Step 5: Commit**

```bash
cd backEnd-linkdecadastro
git add src/events/events.service.ts src/events/events.service.spec.ts
git commit -m "feat(events): hide formCities entries marked as hidden from public endpoints"
```

---

### Task 2: Backend — accept `hidden` on `formCities` entries in `UpdateEventDto`

**Files:**
- Modify: `backEnd-linkdecadastro/src/admin-events/dto/update-event.dto.ts`

This is a TypeScript type-only change — `formCities` is validated only with `@IsArray()` (loose validation, matching the existing pattern for this field), so there is no `class-validator` behavior to unit test here. `AdminEventsService.updateEvent` already forwards the array through unchanged (`updates.formCities = Array.isArray(formCities) ? formCities : null`), so no service change is needed — only widening the type so the extra field type-checks.

- [ ] **Step 1: Update the type**

Open `backEnd-linkdecadastro/src/admin-events/dto/update-event.dto.ts`. Replace:

```ts
  // Lista de cidades exibidas no dropdown do formulário público: [{ city, state }]
  @IsOptional()
  @IsArray()
  formCities?: { city: string; state: string }[];
```

with:

```ts
  // Lista de cidades exibidas no dropdown do formulário público: [{ city, state, hidden? }]
  @IsOptional()
  @IsArray()
  formCities?: { city: string; state: string; hidden?: boolean }[];
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `cd backEnd-linkdecadastro && npx tsc --noEmit`
Expected: no new errors (exits 0, or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
cd backEnd-linkdecadastro
git add src/admin-events/dto/update-event.dto.ts
git commit -m "feat(admin-events): accept hidden flag on formCities entries"
```

---

### Task 3: Frontend — admin toggle to hide/show individual form cities

**Files:**
- Modify: `linkdecadastro-app/src/pages/admin/EditEventPage.tsx`

- [ ] **Step 1: Widen the `formCities` types**

In `linkdecadastro-app/src/pages/admin/EditEventPage.tsx`, update the `EventResponse` interface (around line 76):

```ts
  formCities?: { city: string; state: string; hidden?: boolean }[] | null
```

And the local state declaration (around line 117):

```ts
  const [formCities, setFormCities] = useState<{ city: string; state: string; hidden?: boolean }[]>([])
```

- [ ] **Step 2: Add the toggle handler**

Right after the existing `removeFormCity` function (around line 204), add:

```ts
  const toggleFormCityHidden = (city: string, state: string) => {
    setFormCities((prev) =>
      prev.map((c) =>
        c.city === city && c.state === state ? { ...c, hidden: !c.hidden } : c,
      ),
    )
  }
```

- [ ] **Step 3: Update the section description**

Replace the description paragraph in the "Cidades do Formulário" section (around line 691-693):

```tsx
            <p className="text-[11px] text-[var(--text-muted)] font-medium mb-6">
              Estas são as cidades que aparecem no seletor "Cidade do Evento" do formulário público — independente das cidades participantes e de limites. Se a lista estiver vazia, o formulário usa o comportamento padrão.
            </p>
```

with:

```tsx
            <p className="text-[11px] text-[var(--text-muted)] font-medium mb-6">
              Estas são as cidades que aparecem no seletor "Cidade do Evento" do formulário público — independente das cidades participantes e de limites. Cidades marcadas como ocultas continuam salvas aqui, mas somem do formulário público. Se a lista estiver vazia, o formulário usa o comportamento padrão.
            </p>
```

- [ ] **Step 4: Add the hide/show toggle to each city chip**

Replace the chip rendering block (around lines 728-745):

```tsx
              <div className="flex flex-wrap gap-2">
                {formCities.map((c) => (
                  <span
                    key={`${c.city}-${c.state}`}
                    className="inline-flex items-center gap-2 pl-4 pr-2 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-bold text-[var(--secondary)]"
                  >
                    {c.city} <span className="text-emerald-600">{c.state}</span>
                    <button
                      type="button"
                      onClick={() => removeFormCity(c.city, c.state)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500 transition-all"
                      title="Remover"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
```

with:

```tsx
              <div className="flex flex-wrap gap-2">
                {formCities.map((c) => (
                  <span
                    key={`${c.city}-${c.state}`}
                    className={`inline-flex items-center gap-2 pl-4 pr-2 py-2 rounded-xl text-sm font-bold border ${
                      c.hidden
                        ? 'bg-slate-100 border-slate-200 text-[var(--text-muted)]'
                        : 'bg-emerald-50 border-emerald-100 text-[var(--secondary)]'
                    }`}
                  >
                    {c.city} <span className={c.hidden ? 'text-slate-400' : 'text-emerald-600'}>{c.state}</span>
                    {c.hidden && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Oculta</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleFormCityHidden(c.city, c.state)}
                      className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
                        c.hidden
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-[var(--text-muted)] hover:bg-slate-100'
                      }`}
                      title={c.hidden ? 'Mostrar no formulário público' : 'Esconder do formulário público'}
                    >
                      {c.hidden ? <Unlock size={14} /> : <Lock size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFormCity(c.city, c.state)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-50 hover:text-red-500 transition-all"
                      title="Remover"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
```

`Lock` and `Unlock` are already imported at the top of this file (used by the "Cidades Participantes" open/close toggle), so no new import is needed.

- [ ] **Step 5: Type-check**

Run: `cd linkdecadastro-app && npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 6: Commit**

```bash
cd linkdecadastro-app
git add src/pages/admin/EditEventPage.tsx
git commit -m "feat(admin): allow hiding individual form cities without deleting them"
```

---

### Task 4: Frontend — auto-redirect to WhatsApp group after public registration

**Files:**
- Modify: `linkdecadastro-app/src/components/forms/RegistrationForm.tsx`

- [ ] **Step 1: Add the redirect effect**

In `linkdecadastro-app/src/components/forms/RegistrationForm.tsx`, `useEffect` is already imported (line 1). Add this effect immediately before the `if (success) { ... }` block (around line 430):

```tsx
  useEffect(() => {
    if (success && groupInviteLink) {
      window.location.href = groupInviteLink
    }
  }, [success, groupInviteLink])

  if (success) {
    return (
```

(Keep the rest of the existing `if (success)` block — including the manual "Entrar no grupo do evento" link — unchanged. It now only remains visible as a fallback for the brief instant before the browser navigates away, or if the browser ever blocks the automatic navigation.)

- [ ] **Step 2: Type-check**

Run: `cd linkdecadastro-app && npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
cd linkdecadastro-app
git add src/components/forms/RegistrationForm.tsx
git commit -m "feat(registration): redirect to the WhatsApp group automatically after signup"
```

---

### Task 5: Manual verification in the browser

There is no frontend unit-test framework, and the existing Playwright e2e suite requires a running backend with a seeded MongoDB (`admin@linkdecadastro.com` user, etc.) that isn't available in this sandbox — so this task is a manual smoke test to run against a local dev environment with the backend, frontend, and database all running.

- [ ] **Step 1: Start both dev servers**

```bash
cd backEnd-linkdecadastro && npm run start:dev
```
```bash
cd linkdecadastro-app && npm run dev
```

- [ ] **Step 2: Verify hiding a form city**

1. Log into the admin panel and open an event's edit page (`/admin/events/:eventId`).
2. In "Cidades do Formulário", add two cities, e.g. `Fortaleza/CE` and `Sobral/CE`.
3. Click the lock icon on `Sobral/CE` — confirm the chip turns gray and shows an "Oculta" label.
4. Click "Salvar Alterações".
5. Reload the edit page — confirm `Sobral/CE` is still listed (not deleted) and still shows as hidden.
6. Open that event's public registration link (`/register/:linkId` or the `/e/:slug` page) — confirm the city selector shows `Fortaleza` but not `Sobral`.
7. Go back to the admin edit page, click the unlock icon on `Sobral/CE`, save, and reload the public form — confirm `Sobral` now appears again.

Expected: hidden cities never appear on the public form; toggling is reversible and persists across reloads.

- [ ] **Step 3: Verify the automatic redirect**

1. On the same event, set a `Link do grupo` (e.g. a real or dummy `https://chat.whatsapp.com/...` URL) and save.
2. Open the public registration link in a fresh tab and complete the form with valid data.
3. Submit — confirm the browser navigates directly to the WhatsApp link without showing a clickable "Entrar no grupo do evento" button first (the success screen should be visible for at most a fraction of a second, if at all).
4. Repeat with an event that has **no** group link set — confirm the success screen displays normally and no navigation happens.

Expected: automatic redirect only fires when `groupInviteLink` is set; otherwise the existing success screen behavior is unchanged.

- [ ] **Step 4: Stop the dev servers**

Stop both `npm run dev` / `npm run start:dev` processes (Ctrl+C) once verification is complete.
