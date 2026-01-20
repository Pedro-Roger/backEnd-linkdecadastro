import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for events with null slugs...');
  
  const eventsWithoutSlug = await prisma.event.findMany({
    where: {
      slug: null,
    },
  });

  console.log(`Found ${eventsWithoutSlug.length} events without slug.`);

  for (const event of eventsWithoutSlug) {
    // Generate a simple slug based on title or id
    const baseSlug = event.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event';
    
    let newSlug = `${baseSlug}-${event.id.slice(-4)}`; // Append part of ID to ensure uniqueness
    
    // Check if it already exists (unlikely with ID suffix but good to be safe)
    let exists = await prisma.event.findUnique({ where: { slug: newSlug } });
    if (exists) {
        newSlug = `${newSlug}-${Math.floor(Math.random() * 1000)}`;
    }

    console.log(`Updating event "${event.title}" (ID: ${event.id}) with slug: ${newSlug}`);
    
    await prisma.event.update({
      where: { id: event.id },
      data: { slug: newSlug },
    });
  }

  console.log('Finished updating slugs.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
