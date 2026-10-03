import { parseFilters, timelineFilterSchema } from "@/lib/validation";
import { tenantDb } from "@/server/db/tenant";

/**
 * Monitoring queries (Phase 6). Change timeline, alerts inbox, and overview —
 * all tenant-scoped. ChangeEvents are observed ledger rows (seeded or detected
 * by sync jobs); nothing here is real-time.
 */

export async function getLastSync(): Promise<Date | null> {
  const { db, organizationId } = await tenantDb();
  const state = await db.syncState.findUnique({
    where: { organizationId },
    select: { lastSyncAt: true },
  });
  if (state) return state.lastSyncAt;
  // Fallback for orgs predating sync state: latest completed sync run, if any.
  const job = await db.job.findFirst({
    where: { type: "catalog_sync", status: "done" },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  return job?.finishedAt ?? null;
}

export async function getMonitoringOverview() {
  const { db } = await tenantDb();
  const [listCount, itemCount, unackedAlerts, lastSync, recentAlerts, recentChanges] =
    await Promise.all([
      db.watchlist.count(),
      db.watchlistItem.count(),
      db.alert.count({ where: { acknowledgedAt: null } }),
      getLastSync(),
      db.alert.findMany({
        where: { acknowledgedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { changeEvent: { select: { type: true, summary: true, detectedAt: true } } },
      }),
      db.changeEvent.findMany({
        orderBy: { detectedAt: "desc" },
        take: 8,
      }),
    ]);
  return {
    listCount,
    itemCount,
    unackedAlertCount: unackedAlerts,
    lastSyncAt: lastSync,
    recentAlerts: recentAlerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      createdAt: a.createdAt,
      type: a.changeEvent.type,
      summary: a.changeEvent.summary,
      detectedAt: a.changeEvent.detectedAt,
    })),
    recentChanges: recentChanges.map((c) => ({
      id: c.id,
      type: c.type,
      summary: c.summary,
      detectedAt: c.detectedAt,
    })),
  };
}

export async function listAlerts(includeAcknowledged = false) {
  const { db } = await tenantDb();
  const rows = await db.alert.findMany({
    where: includeAcknowledged ? {} : { acknowledgedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { changeEvent: { select: { type: true, summary: true, detectedAt: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    severity: a.severity,
    acknowledgedAt: a.acknowledgedAt,
    createdAt: a.createdAt,
    type: a.changeEvent.type,
    summary: a.changeEvent.summary,
    detectedAt: a.changeEvent.detectedAt,
  }));
}

export async function listTimeline(rawFilters: unknown) {
  const { db } = await tenantDb();
  const filters = parseFilters(timelineFilterSchema, rawFilters);
  const where = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.ref ? { refId: filters.ref } : {}),
  };
  const [total, items] = await Promise.all([
    db.changeEvent.count({ where }),
    db.changeEvent.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return {
    items: items.map((c) => ({
      id: c.id,
      type: c.type,
      itemType: c.itemType,
      refId: c.refId,
      summary: c.summary,
      detectedAt: c.detectedAt,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}
