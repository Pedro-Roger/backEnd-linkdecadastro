# Event City — Cidades Participantes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `MunicipalityLimit` with `isClosed`, `closedMessage`, `registrationCount`; create `event-city` module with public status endpoint and admin toggle; gate registrations against city availability atomically.

**Architecture:** The existing `MunicipalityLimit` model already relates events to cities (municipality + state string). We extend it with three new fields and create a dedicated `event-city` module. A new public controller exposes city status to the registration form. A new admin controller lets admins toggle `isClosed`/`closedMessage`. The registration flow gains a pre-check that reads city availability before inserting. Atomic slot reservation uses MongoDB `updateMany` with a count condition — if 0 rows updated the city is full (no pessimistic locks; Prisma + MongoDB does not support them).

**Tech Stack:** NestJS 10, Prisma 5, MongoDB, Jest 30, TypeScript

---

## File Map

| Action | Path |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `src/event-city/event-city.module.ts` |
| Create | `src/event-city/event-city.service.ts` |
| Create | `src/event-city/event-city.service.spec.ts` |
| Create | `src/event-city/event-city-public.controller.ts` |
| Create | `src/event-city/event-city-admin.controller.ts` |
| Create | `src/event-city/dto/update-city-status.dto.ts` |
| Modify | `src/app.module.ts` |
| Modify | `src/registrations/registrations.service.ts` |
| Modify | `src/registrations/registrations.service.spec.ts` |

---

### Task 1: Extend Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to MunicipalityLimit**

Open `prisma/schema.prisma`. Replace the `MunicipalityLimit` block with:

```prisma
model MunicipalityLimit {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  eventId           String   @db.ObjectId
  municipality      String
  state             String
  defaultLimit      Int      @default(20)
  registrationCount Int      @default(0)
  isClosed          Boolean  @default(false)
  closedMessage     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  event         Event               @relation(fields: [eventId], references: [id], onDelete: Cascade)
  registrations Registration[]
  classes       MunicipalityClass[]

  @@unique([eventId, municipality, state])
  @@map("municipality_limits")
}
```

- [ ] **Step 2: Regenerate Prisma client**

```bash
cd backEnd-linkdecadastro && npx prisma generate
```

Expected: `Generated Prisma Client` message, no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add isClosed, closedMessage, registrationCount to MunicipalityLimit"
```

---

### Task 2: Create EventCityService with tests (TDD)

**Files:**
- Create: `src/event-city/event-city.service.spec.ts`
- Create: `src/event-city/event-city.service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/event-city/event-city.service.spec.ts`:

```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventCityService } from './event-city.service';

const makePrisma = () => ({
  municipalityLimit: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
});

describe('EventCityService', () => {
  describe('getStatus', () => {
    it('returns CLOSED when isClosed is true', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: true, defaultLimit: 10, registrationCount: 0 };
      expect((svc as any).getStatus(ec)).toBe('CLOSED');
    });

    it('returns FULL when registrationCount >= defaultLimit', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: false, defaultLimit: 5, registrationCount: 5 };
      expect((svc as any).getStatus(ec)).toBe('FULL');
    });

    it('returns OPEN when there are vacancies and not closed', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: false, defaultLimit: 10, registrationCount: 3 };
      expect((svc as any).getStatus(ec)).toBe('OPEN');
    });

    it('returns OPEN when defaultLimit is 0 meaning unlimited', () => {
      const svc = new EventCityService(makePrisma() as any);
      const ec = { isClosed: false, defaultLimit: 0, registrationCount: 999 };
      expect((svc as any).getStatus(ec)).toBe('OPEN');
    });
  });

  describe('listAvailable', () => {
    it('returns city list with computed status and message', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findMany.mockResolvedValue([
        { id: '1', municipality: 'Fortaleza', state: 'CE', isClosed: false, defaultLimit: 100, registrationCount: 20, closedMessage: null },
        { id: '2', municipality: 'Sobral',    state: 'CE', isClosed: false, defaultLimit: 5,   registrationCount: 5,  closedMessage: 'Vagas esgotadas.' },
        { id: '3', municipality: 'Juazeiro',  state: 'CE', isClosed: true,  defaultLimit: 50,  registrationCount: 10, closedMessage: 'Encerrado pelo admin.' },
      ]);
      const svc = new EventCityService(prisma as any);
      const result = await svc.listAvailable('event-1');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: '1', municipality: 'Fortaleza', state: 'CE', status: 'OPEN',   message: null });
      expect(result[1]).toEqual({ id: '2', municipality: 'Sobral',    state: 'CE', status: 'FULL',   message: 'Vagas esgotadas.' });
      expect(result[2]).toEqual({ id: '3', municipality: 'Juazeiro',  state: 'CE', status: 'CLOSED', message: 'Encerrado pelo admin.' });
    });
  });

  describe('reserveSlot', () => {
    it('throws NotFoundException when city not found', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue(null);
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException with message when city is closed', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: '1', isClosed: true, defaultLimit: 10, registrationCount: 0, closedMessage: 'Encerrado.',
      });
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when city is full', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: '1', isClosed: false, defaultLimit: 5, registrationCount: 5, closedMessage: null,
      });
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(ConflictException);
    });

    it('atomically increments registrationCount when slot is available', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: 'limit-1', isClosed: false, defaultLimit: 10, registrationCount: 3, closedMessage: null,
      });
      prisma.municipalityLimit.updateMany.mockResolvedValue({ count: 1 });
      const svc = new EventCityService(prisma as any);
      await svc.reserveSlot('event-1', 'Fortaleza', 'CE');
      expect(prisma.municipalityLimit.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'limit-1',
          registrationCount: { lt: 10 },
          isClosed: false,
        },
        data: { registrationCount: { increment: 1 } },
      });
    });

    it('throws ConflictException when atomic update returns count 0 (race condition)', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: 'limit-1', isClosed: false, defaultLimit: 10, registrationCount: 9, closedMessage: null,
      });
      prisma.municipalityLimit.updateMany.mockResolvedValue({ count: 0 });
      const svc = new EventCityService(prisma as any);
      await expect(svc.reserveSlot('event-1', 'Fortaleza', 'CE')).rejects.toThrow(ConflictException);
    });

    it('skips limit check when defaultLimit is 0 (unlimited)', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({
        id: 'limit-1', isClosed: false, defaultLimit: 0, registrationCount: 999, closedMessage: null,
      });
      prisma.municipalityLimit.update.mockResolvedValue({});
      const svc = new EventCityService(prisma as any);
      await svc.reserveSlot('event-1', 'Fortaleza', 'CE');
      expect(prisma.municipalityLimit.update).toHaveBeenCalledWith({
        where: { id: 'limit-1' },
        data: { registrationCount: { increment: 1 } },
      });
    });
  });

  describe('updateStatus', () => {
    it('updates isClosed and closedMessage on the limit record', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.update.mockResolvedValue({ id: '1', isClosed: true, closedMessage: 'Encerrado.' });
      const svc = new EventCityService(prisma as any);
      const result = await svc.updateStatus('limit-1', { isClosed: true, closedMessage: 'Encerrado.' });
      expect(prisma.municipalityLimit.update).toHaveBeenCalledWith({
        where: { id: 'limit-1' },
        data: { isClosed: true, closedMessage: 'Encerrado.' },
      });
      expect(result.isClosed).toBe(true);
    });
  });

  describe('upsertCity', () => {
    it('creates a MunicipalityLimit when one does not exist', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue(null);
      prisma.municipalityLimit.create.mockResolvedValue({ id: 'new-1' });
      const svc = new EventCityService(prisma as any);
      await svc.upsertCity('event-1', { municipality: 'Fortaleza', state: 'CE', defaultLimit: 100 });
      expect(prisma.municipalityLimit.create).toHaveBeenCalledWith({
        data: { eventId: 'event-1', municipality: 'Fortaleza', state: 'CE', defaultLimit: 100 },
      });
    });

    it('updates defaultLimit when limit already exists', async () => {
      const prisma = makePrisma();
      prisma.municipalityLimit.findFirst.mockResolvedValue({ id: 'existing-1' });
      prisma.municipalityLimit.update.mockResolvedValue({ id: 'existing-1' });
      const svc = new EventCityService(prisma as any);
      await svc.upsertCity('event-1', { municipality: 'Fortaleza', state: 'CE', defaultLimit: 200 });
      expect(prisma.municipalityLimit.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: { defaultLimit: 200 },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd backEnd-linkdecadastro && npx jest src/event-city/event-city.service.spec.ts --no-coverage
```

Expected: `Cannot find module './event-city.service'`

- [ ] **Step 3: Implement EventCityService**

Create `src/event-city/event-city.service.ts`:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CityStatus = 'OPEN' | 'FULL' | 'CLOSED';

interface MunicipalityLimitLike {
  id: string;
  isClosed: boolean;
  defaultLimit: number;
  registrationCount: number;
  closedMessage: string | null;
}

@Injectable()
export class EventCityService {
  constructor(private readonly prisma: PrismaService) {}

  private getStatus(ec: MunicipalityLimitLike): CityStatus {
    if (ec.isClosed) return 'CLOSED';
    if (ec.defaultLimit > 0 && ec.registrationCount >= ec.defaultLimit) return 'FULL';
    return 'OPEN';
  }

  private buildMessage(ec: MunicipalityLimitLike): string | null {
    const status = this.getStatus(ec);
    if (status === 'OPEN') return null;
    return ec.closedMessage ?? 'As inscrições para esta cidade estão encerradas.';
  }

  async listAvailable(eventId: string) {
    const limits = await this.prisma.municipalityLimit.findMany({
      where: { eventId },
    });
    return limits.map((ec) => ({
      id: ec.id,
      municipality: ec.municipality,
      state: ec.state,
      status: this.getStatus(ec as any),
      message: this.buildMessage(ec as any),
    }));
  }

  async reserveSlot(eventId: string, municipality: string, state: string) {
    const ec = await this.prisma.municipalityLimit.findFirst({
      where: { eventId, municipality, state },
    });

    if (!ec) throw new NotFoundException('Cidade não participa deste evento.');

    const status = this.getStatus(ec as any);
    if (status !== 'OPEN') {
      throw new ConflictException(this.buildMessage(ec as any));
    }

    if (ec.defaultLimit === 0) {
      // unlimited — simple increment
      await this.prisma.municipalityLimit.update({
        where: { id: ec.id },
        data: { registrationCount: { increment: 1 } },
      });
      return;
    }

    // Atomic conditional increment — avoids overbooking
    const result = await this.prisma.municipalityLimit.updateMany({
      where: {
        id: ec.id,
        registrationCount: { lt: ec.defaultLimit },
        isClosed: false,
      },
      data: { registrationCount: { increment: 1 } },
    });

    if (result.count === 0) {
      throw new ConflictException(
        this.buildMessage(ec as any) ?? 'Vagas esgotadas.',
      );
    }
  }

  async updateStatus(
    limitId: string,
    data: { isClosed?: boolean; closedMessage?: string | null },
  ) {
    return this.prisma.municipalityLimit.update({
      where: { id: limitId },
      data,
    });
  }

  async upsertCity(
    eventId: string,
    dto: { municipality: string; state: string; defaultLimit?: number },
  ) {
    const existing = await this.prisma.municipalityLimit.findFirst({
      where: { eventId, municipality: dto.municipality, state: dto.state },
    });

    if (existing) {
      return this.prisma.municipalityLimit.update({
        where: { id: existing.id },
        data: { defaultLimit: dto.defaultLimit ?? existing.defaultLimit },
      });
    }

    return this.prisma.municipalityLimit.create({
      data: {
        eventId,
        municipality: dto.municipality,
        state: dto.state,
        defaultLimit: dto.defaultLimit ?? 0,
      },
    });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backEnd-linkdecadastro && npx jest src/event-city/event-city.service.spec.ts --no-coverage
```

Expected: all tests pass (`11 passed`).

- [ ] **Step 5: Commit**

```bash
git add src/event-city/event-city.service.ts src/event-city/event-city.service.spec.ts
git commit -m "feat(event-city): EventCityService with status logic and atomic reserveSlot"
```

---

### Task 3: Create DTOs, controllers, and module

**Files:**
- Create: `src/event-city/dto/update-city-status.dto.ts`
- Create: `src/event-city/dto/upsert-city.dto.ts`
- Create: `src/event-city/event-city-public.controller.ts`
- Create: `src/event-city/event-city-admin.controller.ts`
- Create: `src/event-city/event-city.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create DTOs**

Create `src/event-city/dto/update-city-status.dto.ts`:

```typescript
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCityStatusDto {
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  closedMessage?: string | null;
}
```

Create `src/event-city/dto/upsert-city.dto.ts`:

```typescript
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertCityDto {
  @IsString()
  municipality: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultLimit?: number;
}
```

- [ ] **Step 2: Create public controller**

Create `src/event-city/event-city-public.controller.ts`:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { EventCityService } from './event-city.service';

@Controller('events/:eventId/cities')
export class EventCityPublicController {
  constructor(private readonly service: EventCityService) {}

  @Get()
  list(@Param('eventId') eventId: string) {
    return this.service.listAvailable(eventId);
  }
}
```

- [ ] **Step 3: Create admin controller**

Create `src/event-city/event-city-admin.controller.ts`:

```typescript
import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EventCityService } from './event-city.service';
import { UpdateCityStatusDto } from './dto/update-city-status.dto';
import { UpsertCityDto } from './dto/upsert-city.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin/events/:eventId/cities')
export class EventCityAdminController {
  constructor(private readonly service: EventCityService) {}

  @Post()
  upsert(@Param('eventId') eventId: string, @Body() dto: UpsertCityDto) {
    return this.service.upsertCity(eventId, dto);
  }

  @Patch(':limitId/status')
  updateStatus(
    @Param('limitId') limitId: string,
    @Body() dto: UpdateCityStatusDto,
  ) {
    return this.service.updateStatus(limitId, dto);
  }
}
```

- [ ] **Step 4: Create module**

Create `src/event-city/event-city.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventCityService } from './event-city.service';
import { EventCityPublicController } from './event-city-public.controller';
import { EventCityAdminController } from './event-city-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EventCityPublicController, EventCityAdminController],
  providers: [EventCityService],
  exports: [EventCityService],
})
export class EventCityModule {}
```

- [ ] **Step 5: Register in AppModule**

In `src/app.module.ts`, add the import:

```typescript
import { EventCityModule } from './event-city/event-city.module';
```

Add `EventCityModule` to the `imports` array (after `EventsModule`):

```typescript
EventsModule,
EventCityModule,
RegistrationsModule,
```

- [ ] **Step 6: Run all tests to ensure nothing broken**

```bash
cd backEnd-linkdecadastro && npx jest --no-coverage
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/event-city/ src/app.module.ts
git commit -m "feat(event-city): controllers, DTOs, module wired in AppModule"
```

---

### Task 4: Gate registrations against city availability

The registration service auto-creates a `MunicipalityLimit` when one doesn't exist. We need to:
1. Call `reserveSlot` before proceeding (for cities that already have a limit configured).
2. If `reserveSlot` throws `ConflictException`, surface it to the caller.
3. If city has no limit yet (auto-created), `upsertCity` creates it with `defaultLimit: 0` (unlimited), so `reserveSlot` will succeed.

**Files:**
- Modify: `src/registrations/registrations.service.ts`
- Modify: `src/registrations/registrations.service.spec.ts`

- [ ] **Step 1: Write failing test for blocked city**

Add this test block to `src/registrations/registrations.service.spec.ts`:

```typescript
import { ConflictException } from '@nestjs/common';
import { EventCityService } from '../event-city/event-city.service';

// Inside the existing describe('RegistrationsService') block, add:

describe('createRegistration — city availability', () => {
  const createServiceWithCity = (cityServiceOverrides: Partial<EventCityService> = {}) => {
    const prisma: any = {
      registration: { findFirst: jest.fn().mockResolvedValue(null) },
      municipalityLimit: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'ml-1', defaultLimit: 0 }),
        updateMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      municipalityClass: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'mc-1', limit: 999999, currentCount: 0 }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const emailService: any = { sendRegistrationEmail: jest.fn(), sendAdminNotificationEmail: jest.fn() };
    const whatsappService: any = { sendMessageToPhone: jest.fn() };
    const cityService = new EventCityService(prisma);
    Object.assign(cityService, cityServiceOverrides);

    // RegistrationsService must accept EventCityService as 4th constructor param
    const service = new RegistrationsService(prisma, emailService, whatsappService, cityService);
    return { service, prisma, cityService };
  };

  it('throws ConflictException when city is closed', async () => {
    const { service, cityService } = createServiceWithCity();
    jest.spyOn(cityService, 'reserveSlot').mockRejectedValue(
      new ConflictException('Inscrições encerradas para esta cidade.'),
    );

    await expect(
      service.createRegistration({
        eventId: 'ev-1', name: 'João', cpf: '12345678901',
        phone: '85999999999', email: 'joao@test.com', cep: '60000000',
        locality: 'Centro', city: 'Fortaleza', state: 'CE',
        participantType: 'PRODUTOR' as any,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (RegistrationsService doesn't accept 4th arg)**

```bash
cd backEnd-linkdecadastro && npx jest src/registrations/registrations.service.spec.ts --no-coverage
```

Expected: type error or `ConflictException` not thrown.

- [ ] **Step 3: Update RegistrationsService to accept and use EventCityService**

In `src/registrations/registrations.service.ts`, add the import:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventCityService } from '../event-city/event-city.service';
```

Update the constructor:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly emailService: EmailService,
  private readonly whatsappService: WhatsAppService,
  private readonly eventCityService: EventCityService,
) {}
```

In `createRegistration`, add the availability check **after** the duplicate CPF check and **before** the municipality auto-creation block:

```typescript
// After the existingRegistration check, before municipalityLimit lookup:
await this.eventCityService.reserveSlot(data.eventId, data.city, data.state);
```

- [ ] **Step 4: Update RegistrationsModule to inject EventCityModule**

In `src/registrations/registrations.module.ts`, import `EventCityModule`:

```typescript
import { EventCityModule } from '../event-city/event-city.module';

@Module({
  imports: [EventCityModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, RegistrationsRepository, PrismaService, EmailService, WhatsAppService],
})
export class RegistrationsModule {}
```

Check the actual contents of `registrations.module.ts` first and adjust accordingly — only add `EventCityModule` to `imports` and ensure `EventCityService` is provided (it comes from `EventCityModule` exports).

- [ ] **Step 5: Run all tests**

```bash
cd backEnd-linkdecadastro && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/registrations/registrations.service.ts src/registrations/registrations.service.spec.ts src/registrations/registrations.module.ts
git commit -m "feat(registrations): gate city availability via EventCityService before slot reservation"
```

---

### Task 5: Push to main

- [ ] **Step 1: Switch to main and merge**

```bash
git checkout main
git merge feat/event-whatsapp-groups --no-ff -m "merge: event-whatsapp-groups into main"
```

Or if working directly on a new branch from main:

```bash
git checkout main
git merge <your-branch> --ff-only
```

- [ ] **Step 2: Push**

```bash
git push origin main
```

Expected: push accepted on GitHub.

---

## Self-Review

**Spec coverage:**
- ✅ RN-01 Admin adds cities explicitly → `upsertCity` + admin `POST /admin/events/:eventId/cities`
- ✅ RN-02 Limit auto-closes → `getStatus` returns FULL when `registrationCount >= defaultLimit`
- ✅ RN-03 Admin manual close → `updateStatus` + admin `PATCH /admin/events/:eventId/cities/:limitId/status`
- ✅ RN-04 `defaultLimit=0` means unlimited → `getStatus` returns OPEN when `defaultLimit === 0`
- ✅ RN-05 Message on closed/full → `buildMessage` returns `closedMessage` or default text
- ✅ RN-06 Atomic no-overbooking → `updateMany` with `{ registrationCount: { lt: defaultLimit } }` condition
- ✅ RN-07 Status computed in real-time → no persisted status field; derived on each request

**Missing endpoint:** `GET /admin/events/:eventId/cities` (list with counts for the admin panel) is not in the plan — the existing `GET /admin/events/:eventId/regions` already covers this via `AdminEventsService.getRegionsSummary`. No gap.

**Placeholder scan:** None found.

**Type consistency:** `MunicipalityLimitLike` interface in service matches the Prisma model fields used in tests and controllers throughout.
