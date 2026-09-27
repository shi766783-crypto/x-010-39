<script setup>
import { computed } from 'vue'

const props = defineProps({
  // [{ key: 'YYYY-MM', label: '1月', value: 123 }]
  data: { type: Array, default: () => [] },
  color: { type: String, default: '#4f6ef7' },
  formatter: { type: Function, default: (v) => v },
})

const W = 640
const H = 260
const PAD = { top: 20, right: 20, bottom: 40, left: 56 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

// 纵轴取整刻度，数值都为 0 时按 1 处理
function niceMax(value) {
  if (value <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const base = value / exp
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return nice * exp
}

const maxValue = computed(() =>
  niceMax(Math.max(1, ...props.data.map((d) => Number(d.value) || 0)))
)

const ticks = computed(() => {
  const max = maxValue.value
  return [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    value: max * r,
    y: PAD.top + plotH * (1 - r),
  }))
})

// 紧凑金额刻度，避免纵轴文字拥挤
function compact(value) {
  if (value >= 10000) return `¥${(value / 10000).toFixed(value % 10000 ? 1 : 0)}万`
  if (value >= 1000) return `¥${Math.round(value / 1000)}k`
  return `¥${value}`
}

const points = computed(() => {
  const n = props.data.length
  return props.data.map((d, i) => ({
    ...d,
    x: n === 1 ? PAD.left + plotW / 2 : PAD.left + (plotW * i) / (n - 1),
    y: PAD.top + plotH * (1 - (Number(d.value) || 0) / maxValue.value),
  }))
})

const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
)

const areaPath = computed(() => {
  if (!points.value.length) return ''
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  const base = PAD.top + plotH
  return `${linePath.value} L${last.x},${base} L${first.x},${base} Z`
})

// 月份较多时间隔显示，并始终保留首尾
const labelStep = computed(() => Math.max(1, Math.ceil(points.value.length / 8)))

function showLabel(i) {
  const n = points.value.length
  return i === 0 || i === n - 1 || i % labelStep.value === 0
}

function labelAnchor(i) {
  if (i === 0) return 'start'
  if (i === points.value.length - 1) return 'end'
  return 'middle'
}

// 刻度标签：年初（1 月）显示年份，便于跨年阅读
function xLabel(p, i) {
  return i === 0 || p.key.slice(5) === '01'
    ? `${p.key.slice(2, 4)}年${p.label}`
    : p.label
}
</script>

<template>
  <svg class="line-chart" :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="月度花费趋势">
    <defs>
      <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity="0.22" />
        <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
      </linearGradient>
    </defs>

    <!-- 横向网格线与纵轴刻度 -->
    <g v-for="(t, i) in ticks" :key="i">
      <line
        :x1="PAD.left"
        :x2="W - PAD.right"
        :y1="t.y"
        :y2="t.y"
        stroke="#eef0f4"
        stroke-width="1"
      />
      <text :x="PAD.left - 8" :y="t.y + 4" text-anchor="end" class="axis-text">
        {{ compact(t.value) }}
      </text>
    </g>

    <!-- 数据区域 -->
    <path v-if="points.length > 1" :d="areaPath" fill="url(#lineArea)" />
    <path
      v-if="points.length > 1"
      :d="linePath"
      fill="none"
      :stroke="color"
      stroke-width="2.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <!-- 数据点 -->
    <g v-for="(p, i) in points" :key="p.key">
      <circle :cx="p.x" :cy="p.y" r="4" :fill="color" stroke="#fff" stroke-width="1.5" />
      <title>{{ p.key }}：{{ formatter(p.value) }}</title>
    </g>

    <!-- 横轴月份 -->
    <text
      v-for="(p, i) in points"
      v-show="showLabel(i)"
      :key="`label-${p.key}`"
      :x="p.x"
      :y="H - 14"
      :text-anchor="labelAnchor(i)"
      class="axis-text"
    >{{ xLabel(p, i) }}</text>
  </svg>
</template>

<style scoped>
.line-chart {
  width: 100%;
  height: auto;
  display: block;
}

.axis-text {
  font-size: 11px;
  fill: var(--text-muted);
}
</style>
