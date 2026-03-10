const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const eventId = "6571a32b21c43d0012345678"; // Just any event ID or we can find the first one
    const firstEvent = await prisma.event.findFirst();
    console.log("Found event:", firstEvent.title, firstEvent.id);

    const filters = { eventId: firstEvent.id };

    const registrations = await prisma.registration.findMany({
        where: {
            eventId: filters.eventId,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true,
            participantType: true,
        },
    });

    console.log('Query returned', registrations.length, 'registrations.');
    if (registrations.length > 0) {
        console.log('First reg phone:', registrations[0].phone);
    }

    // "Toda base" logic
    const allRegistrations = await prisma.registration.findMany({
        where: {
            phone: { not: '' },
            event: {},
        },
        select: { id: true, name: true, phone: true }
    });

    console.log('Toda base returned', allRegistrations.length, 'registrations.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
