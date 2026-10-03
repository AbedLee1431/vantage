import "dotenv/config";
import { prisma } from "../src/server/db/client";
import { buildDemoDataset } from "../src/server/db/seed-data";
import { hashPassword } from "../src/server/password";

/**
 * `pnpm db:seed` — idempotent demo seed (Prisma 7 runs it only via `prisma db seed`).
 * Creates (or reuses) a demo user + org, wipes THAT org's tenant data, rebuilds it.
 * Never touches other organizations.
 */

const DEMO_EMAIL = "demo@vantage.local";
const DEMO_PASSWORD = "VantageDemo123!";
const DEMO_ORG_NAME = "Demo Workspace";
const DEMO_ORG_SLUG = "demo-workspace";

async function wipeOrg(organizationId: string) {
  // Children before parents to respect foreign keys. Covers all tenant tables
  // so re-seeding never accumulates stale AI/monitoring rows.
  await prisma.aiMessage.deleteMany({ where: { organizationId } });
  await prisma.aiConversation.deleteMany({ where: { organizationId } });
  await prisma.aiAnalysis.deleteMany({ where: { organizationId } });
  await prisma.opportunity.deleteMany({ where: { organizationId } });
  await prisma.alert.deleteMany({ where: { organizationId } });
  await prisma.job.deleteMany({ where: { organizationId } });
  await prisma.syncState.deleteMany({ where: { organizationId } });
  await prisma.changeEvent.deleteMany({ where: { organizationId } });
  await prisma.watchlistItem.deleteMany({ where: { watchlist: { organizationId } } });
  await prisma.watchlist.deleteMany({ where: { organizationId } });
  await prisma.competitor.deleteMany({ where: { organizationId } });
  await prisma.review.deleteMany({ where: { organizationId } });
  await prisma.ad.deleteMany({ where: { organizationId } });
  await prisma.landingPage.deleteMany({ where: { organizationId } });
  await prisma.advertiser.deleteMany({ where: { organizationId } });
  await prisma.product.deleteMany({ where: { organizationId } });
  await prisma.store.deleteMany({ where: { organizationId } });
}

async function main() {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        name: "Demo User",
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });
  let organization = membership?.organization ?? null;
  if (!organization) {
    organization =
      (await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } })) ??
      (await prisma.organization.create({
        data: { name: DEMO_ORG_NAME, slug: DEMO_ORG_SLUG },
      }));
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      create: { userId: user.id, organizationId: organization.id, role: "owner" },
      update: { role: "owner" },
    });
  }

  await wipeOrg(organization.id);
  const counts = await buildDemoDataset(organization.id);

  console.log(`Seeded demo workspace (${organization.id}):`, counts);
  console.log(`Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD} (local dev only)`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
