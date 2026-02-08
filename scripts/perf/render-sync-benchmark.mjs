import { performance } from 'node:perf_hooks';

function createAreaData({ locations = 40, itemsPerLocation = 8, checkpointsPerItem = 12 } = {}) {
  let checkpointIndex = 0;
  return {
    id: 'area-1',
    name: 'Area 1',
    locations: Array.from({ length: locations }, (_, locationIdx) => ({
      id: `loc-${locationIdx + 1}`,
      name: `Location ${locationIdx + 1}`,
      items: Array.from({ length: itemsPerLocation }, (_, itemIdx) => ({
        id: `item-${locationIdx + 1}-${itemIdx + 1}`,
        name: `Item ${itemIdx + 1}`,
        checkpoints: Array.from({ length: checkpointsPerItem }, () => {
          checkpointIndex += 1;
          const statusCycle = checkpointIndex % 3;
          const status = statusCycle === 0 ? 'ok' : statusCycle === 1 ? 'needsReview' : 'pending';
          const photoCount = checkpointIndex % 4;
          return {
            id: `cp-${checkpointIndex}`,
            status,
            photos: Array.from({ length: photoCount }, (_, photoIdx) => ({ id: `${checkpointIndex}-${photoIdx}` })),
            comments: checkpointIndex % 5 === 0 ? 'Needs follow-up' : '',
          };
        }),
      })),
    })),
  };
}

function legacyGetAreaStats(area) {
  let total = 0;
  let ok = 0;
  let issues = 0;
  for (const location of area.locations) {
    for (const item of location.items) {
      for (const checkpoint of item.checkpoints) {
        total += 1;
        if (checkpoint.status === 'ok') ok += 1;
        else if (checkpoint.status === 'needsReview') issues += 1;
      }
    }
  }
  return { total, ok, issues };
}

function legacyGetLocationStats(location) {
  let total = 0;
  let ok = 0;
  let issues = 0;
  for (const item of location.items) {
    for (const checkpoint of item.checkpoints) {
      total += 1;
      if (checkpoint.status === 'ok') ok += 1;
      else if (checkpoint.status === 'needsReview') issues += 1;
    }
  }
  return { total, ok, issues };
}

function legacyGetItemStats(item) {
  let total = 0;
  let ok = 0;
  let issues = 0;
  for (const checkpoint of item.checkpoints) {
    total += 1;
    if (checkpoint.status === 'ok') ok += 1;
    else if (checkpoint.status === 'needsReview') issues += 1;
  }
  return { total, ok, issues };
}

function legacyAreaRenderComputation(area, expandedLocationId) {
  const stats = legacyGetAreaStats(area);
  const locationMetrics = new Map();
  const itemMetrics = new Map();

  for (const location of area.locations) {
    const locationStats = legacyGetLocationStats(location);
    const locationPhotoCount = location.items.reduce(
      (itemSum, item) => itemSum + item.checkpoints.reduce((cpSum, checkpoint) => cpSum + checkpoint.photos.length, 0),
      0
    );
    const locationCommentCount = location.items.reduce(
      (itemSum, item) =>
        itemSum +
        item.checkpoints.reduce((cpSum, checkpoint) => cpSum + (checkpoint.comments.trim() ? 1 : 0), 0),
      0
    );

    locationMetrics.set(location.id, {
      stats: locationStats,
      pending: locationStats.total - locationStats.ok - locationStats.issues,
      photoCount: locationPhotoCount,
      commentCount: locationCommentCount,
    });

    if (location.id === expandedLocationId) {
      for (const item of location.items) {
        const itemStats = legacyGetItemStats(item);
        const itemPhotoCount = item.checkpoints.reduce((sum, checkpoint) => sum + checkpoint.photos.length, 0);
        const itemCommentCount = item.checkpoints.reduce(
          (sum, checkpoint) => sum + (checkpoint.comments.trim() ? 1 : 0),
          0
        );
        itemMetrics.set(item.id, {
          stats: itemStats,
          pending: itemStats.total - itemStats.ok - itemStats.issues,
          photoCount: itemPhotoCount,
          commentCount: itemCommentCount,
        });
      }
    }
  }

  const pending = stats.total - stats.ok - stats.issues;
  const progress = stats.total > 0 ? (stats.ok / stats.total) * 100 : 0;
  return { stats, pending, progress, locationMetrics, itemMetrics };
}

function optimizedAreaComputation(area) {
  const locationMetrics = new Map();
  const itemMetrics = new Map();

  let total = 0;
  let ok = 0;
  let issues = 0;

  for (const location of area.locations) {
    let locationTotal = 0;
    let locationOk = 0;
    let locationIssues = 0;
    let locationPhotoCount = 0;
    let locationCommentCount = 0;

    for (const item of location.items) {
      let itemTotal = 0;
      let itemOk = 0;
      let itemIssues = 0;
      let itemPhotoCount = 0;
      let itemCommentCount = 0;

      for (const checkpoint of item.checkpoints) {
        itemTotal += 1;
        if (checkpoint.status === 'ok') itemOk += 1;
        else if (checkpoint.status === 'needsReview') itemIssues += 1;
        itemPhotoCount += checkpoint.photos.length;
        if (checkpoint.comments.trim()) itemCommentCount += 1;
      }

      const itemPending = itemTotal - itemOk - itemIssues;
      itemMetrics.set(item.id, {
        stats: { total: itemTotal, ok: itemOk, issues: itemIssues },
        pending: itemPending,
        photoCount: itemPhotoCount,
        commentCount: itemCommentCount,
      });

      locationTotal += itemTotal;
      locationOk += itemOk;
      locationIssues += itemIssues;
      locationPhotoCount += itemPhotoCount;
      locationCommentCount += itemCommentCount;
    }

    const locationPending = locationTotal - locationOk - locationIssues;
    locationMetrics.set(location.id, {
      stats: { total: locationTotal, ok: locationOk, issues: locationIssues },
      pending: locationPending,
      photoCount: locationPhotoCount,
      commentCount: locationCommentCount,
    });

    total += locationTotal;
    ok += locationOk;
    issues += locationIssues;
  }

  const pending = total - ok - issues;
  return {
    stats: { total, ok, issues },
    pending,
    progress: total > 0 ? (ok / total) * 100 : 0,
    locationMetrics,
    itemMetrics,
  };
}

function benchmark(name, iterations, fn) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  const total = samples.reduce((sum, value) => sum + value, 0);
  const avg = total / samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { name, avg, p95 };
}

function maxConcurrency(runs) {
  const markers = [];
  for (const run of runs) {
    markers.push({ t: run.start, d: 1 });
    markers.push({ t: run.end, d: -1 });
  }
  markers.sort((a, b) => (a.t === b.t ? a.d - b.d : a.t - b.t));
  let current = 0;
  let max = 0;
  for (const marker of markers) {
    current += marker.d;
    if (current > max) max = current;
  }
  return max;
}

function simulateLegacyScheduler(edits, delayMs, syncDurationMs) {
  let timerAt = null;
  const runs = [];

  const fireTimer = () => {
    if (timerAt === null) return;
    runs.push({ start: timerAt, end: timerAt + syncDurationMs });
    timerAt = null;
  };

  for (const editAt of edits) {
    if (timerAt !== null && timerAt <= editAt) {
      fireTimer();
    }
    timerAt = editAt + delayMs;
  }
  fireTimer();

  return {
    runs,
    runCount: runs.length,
    maxConcurrent: maxConcurrency(runs),
  };
}

function simulateCoalescedScheduler(edits, delayMs, syncDurationMs) {
  let editIndex = 0;
  let timerAt = null;
  let inFlight = false;
  let syncEndsAt = null;
  let queued = false;
  const runs = [];

  const startSync = (startAt) => {
    inFlight = true;
    syncEndsAt = startAt + syncDurationMs;
    runs.push({ start: startAt, end: syncEndsAt });
  };

  while (true) {
    const nextEditAt = editIndex < edits.length ? edits[editIndex] : Number.POSITIVE_INFINITY;
    const nextTimerAt = timerAt ?? Number.POSITIVE_INFINITY;
    const nextSyncEndAt = syncEndsAt ?? Number.POSITIVE_INFINITY;
    const nextAt = Math.min(nextEditAt, nextTimerAt, nextSyncEndAt);

    if (!Number.isFinite(nextAt)) break;

    if (nextAt === nextEditAt) {
      timerAt = nextAt + delayMs;
      editIndex += 1;
      continue;
    }

    if (nextAt === nextTimerAt) {
      timerAt = null;
      if (inFlight) {
        queued = true;
      } else {
        startSync(nextAt);
      }
      continue;
    }

    if (nextAt === nextSyncEndAt) {
      inFlight = false;
      syncEndsAt = null;
      if (queued) {
        queued = false;
        timerAt = nextAt + delayMs;
      }
    }
  }

  return {
    runs,
    runCount: runs.length,
    maxConcurrent: maxConcurrency(runs),
  };
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

const area = createAreaData({ locations: 40, itemsPerLocation: 8, checkpointsPerItem: 12 });
const expandedLocationId = area.locations[0].id;

const legacyOnce = legacyAreaRenderComputation(area, expandedLocationId);
const optimizedOnce = optimizedAreaComputation(area);
if (
  legacyOnce.stats.total !== optimizedOnce.stats.total ||
  legacyOnce.stats.ok !== optimizedOnce.stats.ok ||
  legacyOnce.stats.issues !== optimizedOnce.stats.issues
) {
  throw new Error('Validation failed: aggregate stats mismatch');
}

const renderIterations = 300;
const legacyRender = benchmark('Legacy area render compute', renderIterations, () => {
  legacyAreaRenderComputation(area, expandedLocationId);
});
const optimizedRender = benchmark('Optimized area derive', renderIterations, () => {
  optimizedAreaComputation(area);
});

const projectRows = 400;
const areaRows = 220;
const legacyProjectRowRendersPerToggle = projectRows;
const optimizedProjectRowRendersPerToggle = 1;
const legacyAreaRowRendersPerToggle = areaRows;
const optimizedAreaRowRendersPerToggle = 1;

const edits = Array.from({ length: 12 }, (_, idx) => idx * 900);
const delayMs = 800;
const syncDurationMs = 2500;
const legacySync = simulateLegacyScheduler(edits, delayMs, syncDurationMs);
const optimizedSync = simulateCoalescedScheduler(edits, delayMs, syncDurationMs);

printSection('Render Compute (ms)');
console.log(`legacy avg:    ${legacyRender.avg.toFixed(3)} ms`);
console.log(`optimized avg: ${optimizedRender.avg.toFixed(3)} ms`);
console.log(`legacy p95:    ${legacyRender.p95.toFixed(3)} ms`);
console.log(`optimized p95: ${optimizedRender.p95.toFixed(3)} ms`);
console.log(
  `avg improvement: ${(((legacyRender.avg - optimizedRender.avg) / legacyRender.avg) * 100).toFixed(1)}%`
);

printSection('Selective Rerender Count (per toggle)');
console.log(`project rows legacy:    ${legacyProjectRowRendersPerToggle}`);
console.log(`project rows optimized: ${optimizedProjectRowRendersPerToggle}`);
console.log(`area rows legacy:       ${legacyAreaRowRendersPerToggle}`);
console.log(`area rows optimized:    ${optimizedAreaRowRendersPerToggle}`);

printSection('Background Sync Scheduling');
console.log(`legacy sync runs:    ${legacySync.runCount}`);
console.log(`optimized sync runs: ${optimizedSync.runCount}`);
console.log(`legacy max overlap:  ${legacySync.maxConcurrent}`);
console.log(`optimized overlap:   ${optimizedSync.maxConcurrent}`);
console.log(`sync run reduction:  ${(((legacySync.runCount - optimizedSync.runCount) / legacySync.runCount) * 100).toFixed(1)}%`);
