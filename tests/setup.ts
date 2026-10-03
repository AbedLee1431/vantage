// Vitest setup: point every Prisma client at the isolated test database.
// Runs before test files import application modules (which read DATABASE_URL at load).
process.env.DATABASE_URL = "postgresql://vantage:vantage@localhost:5432/vantage_test";
