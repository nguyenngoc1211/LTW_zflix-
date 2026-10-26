const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const mov1 = await prisma.productions.findFirst({ where: { title: 'Test Phim Lẻ' }});
  const mov2 = await prisma.productions.findFirst({ where: { title: 'Test Phim Bộ' }});
  
  const m1Eps = mov1 ? await prisma.episodes.findMany({ where: { production_id: mov1.id } }) : null;
  const m2Eps = mov2 ? await prisma.episodes.findMany({ where: { production_id: mov2.id }, orderBy: [{season_id: 'asc'}, {episode_number: 'asc'}] }) : null;

  console.log(JSON.stringify({ mov1, m1Eps, mov2, m2Eps }, null, 2));
}
run();
