const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const mov1 = await prisma.movie.findFirst({ where: { title: 'Test Phim Lẻ' }, include: { episodes: true } });
  const mov2 = await prisma.movie.findFirst({ where: { title: 'Test Phim Bộ' }, include: { episodes: true } });
  console.log(JSON.stringify({ mov1, mov2 }, null, 2));
}
run();
