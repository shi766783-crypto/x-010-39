import { TRIP_TYPES, EXPENSE_CATEGORIES } from '../constants'
import { luggageCompletionRate } from './luggage'
import { planTotalSpend, planPackingRate, planSpendBreakdown, recordTotalSpend } from './selectors'

// 月度花费趋势：按行程记录日期所在月份汇总（与总花费同一口径，每条记录只计入一次），
// 首末月份之间没有花费的月份补 0 占位，保证时间序列连续
function computeMonthlySpend(plans) {
  const byMonth = new Map()
  plans.forEach((p) => {
    ;(p.records || []).forEach((r) => {
      const month = typeof r.date === 'string' ? r.date.slice(0, 7) : ''
      if (!/^\d{4}-\d{2}$/.test(month)) return
      byMonth.set(month, (byMonth.get(month) || 0) + recordTotalSpend(r))
    })
  })
  if (!byMonth.size) return []

  const sorted = [...byMonth.keys()].sort()
  let [y, m] = sorted[0].split('-').map(Number)
  const [endY, endM] = sorted[sorted.length - 1].split('-').map(Number)

  const months = []
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    months.push({ label: key, value: byMonth.get(key) || 0 })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return months
}

// ===== 出行看板统计 =====
export function computeDashboardStats(plans) {
  const totalTrips = plans.length
  const totalSpend = plans.reduce((sum, p) => sum + planTotalSpend(p), 0)
  const totalBudget = plans.reduce((sum, p) => sum + (Number(p.budget) || 0), 0)
  const totalDays = plans.reduce((sum, p) => sum + (Number(p.days) || 0), 0)

  const avgDays = totalTrips ? Math.round((totalDays / totalTrips) * 10) / 10 : 0
  const avgPackingRate = totalTrips
    ? Math.round(plans.reduce((sum, p) => sum + planPackingRate(p), 0) / totalTrips)
    : 0

  // 最常去目的地
  const destCount = {}
  plans.forEach((p) => {
    if (p.destination) destCount[p.destination] = (destCount[p.destination] || 0) + 1
  })
  const mostVisited =
    Object.entries(destCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  // 出行类型分布
  const tripTypeDist = TRIP_TYPES.map((label) => ({
    label,
    value: plans.filter((p) => p.tripType === label).length,
  }))

  // 花费分类汇总（所有出行）
  const categorySpend = EXPENSE_CATEGORIES.map(({ label }) => ({ label, value: 0 }))
  plans.forEach((p) => {
    const breakdown = planSpendBreakdown(p)
    categorySpend.forEach((c) => {
      c.value += breakdown[c.label] || 0
    })
  })

  // 各次出行花费对比
  const perTripSpend = plans.map((p) => ({ label: p.name, value: planTotalSpend(p) }))

  return {
    totalTrips,
    totalSpend,
    totalBudget,
    avgDays,
    avgPackingRate,
    mostVisited,
    balance: totalBudget - totalSpend,
    tripTypeDist,
    categorySpend,
    perTripSpend,
    monthlySpend: computeMonthlySpend(plans),
  }
}

// ===== 成员聚合（供排行榜使用） =====
export function computeMemberLeaderboard(plans) {
  const map = new Map()

  plans.forEach((plan) => {
    ;(plan.members || []).forEach((m) => {
      if (!map.has(m.name)) {
        map.set(m.name, {
          name: m.name,
          trips: 0,
          packingSum: 0,
          packingCount: 0,
          ratingSum: 0,
          ratingCount: 0,
        })
      }
      const entry = map.get(m.name)
      entry.trips += 1

      const list = (plan.luggage || []).find((l) => l.memberId === m.id)
      if (list) {
        entry.packingSum += luggageCompletionRate(list.items)
        entry.packingCount += 1
      }

      if (plan.summary && plan.summary.rating) {
        entry.ratingSum += plan.summary.rating
        entry.ratingCount += 1
      }
    })
  })

  const members = [...map.values()].map((e) => ({
    name: e.name,
    trips: e.trips,
    avgPackingRate: e.packingCount ? Math.round(e.packingSum / e.packingCount) : 0,
    avgRating: e.ratingCount ? Math.round((e.ratingSum / e.ratingCount) * 10) / 10 : 0,
    // 出行达人综合分：出行次数权重更高，总结质量作为加成
    travelScore: e.trips * 10 + (e.ratingCount ? e.ratingSum / e.ratingCount : 0),
  }))

  return {
    travelMasterBoard: [...members].sort(
      (a, b) => b.travelScore - a.travelScore || b.avgRating - a.avgRating
    ),
    luggageMasterBoard: [...members].sort(
      (a, b) => b.avgPackingRate - a.avgPackingRate || b.trips - a.trips
    ),
  }
}
