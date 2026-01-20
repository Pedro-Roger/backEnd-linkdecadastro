import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for ALL events...');
  
  const allEvents = await prisma.event.findMany({
    select: { id: true, slug: true, title: true }
  });

  console.log(`Found ${allEvents.length} total events.`);
  
  const nullSlugs = allEvents.filter(e => e.slug === null);
  console.log(`Events with null slug: ${nullSlugs.length}`);
  
  if (nullSlugs.length > 0) {
      for (const event of nullSlugs) {
          console.log(`Fixing null slug for: ${event.id} - ${event.title}`);
          const baseSlug = (event.title || 'event')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'event';
            
          let newSlug = `${baseSlug}-${event.id.slice(-4)}`;
          await prisma.event.update({
              where: { id: event.id },
              data: { slug: newSlug }
          });
      }
  }

  // Check for duplicates
  const slugCounts: Record<string, number> = {};
  for (const e of allEvents) {
      if (e.slug) {
          slugCounts[e.slug] = (slugCounts[e.slug] || 0) + 1;
      }
  }
  
  const duplicates = Object.keys(slugCounts).filter(slug => slugCounts[slug] > 1);
  console.log(`Found ${duplicates.length} duplicate slugs.`);
  
  if (duplicates.length > 0) {
      console.log('Duplicate slugs:', duplicates);
      for (const slug of duplicates) {
          const eventsWithDuplicate = allEvents.filter(e => e.slug === slug);
          // Skip the first one, update the rest
          for (let i = 1; i < eventsWithDuplicate.length; i++) {
              const event = eventsWithDuplicate[i];
              const newSlug = `${slug}-${Math.floor(Math.random() * 1000)}`;
              console.log(`Resolving duplicate for ${event.id}: ${slug} -> ${newSlug}`);
              await prisma.event.update({
                  where: { id: event.id },
                  data: { slug: newSlug }
              });
          }
      }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
