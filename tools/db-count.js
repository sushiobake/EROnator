const { PrismaClient } = require("@prisma/client");

(async () => {
  const p = new PrismaClient();
  try {
    console.log("DATABASE_URL=", process.env.DATABASE_URL);
    console.log("works=", await p.work.count());
    console.log("tags=", await p.tag.count());
    console.log("workTags=", await p.workTag.count());
  } finally {
    await p.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
