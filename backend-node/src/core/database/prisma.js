import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: ["error", "warn"], 
});

export default prisma;