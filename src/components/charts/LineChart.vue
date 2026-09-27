<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  color: { type: String, default: '' },
  formatter: { type: Function, default: (v) => v },
})

const W = 720
const H = 240
const PAD = { top: 16, right: 20, bottom: 30, left: 64 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom
const baseY = PAD.top + innerH

const maxValue = computed(
  () => Math.max(1, ...props.data.map((d) => Number(d.value) || 0))
)

// 纵轴刻度（含 0），用于网格线与刻度文案
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => (maxValue.value / 4) * i))

function x(i) {
  if (props.data.length <= 1) return PAD.left + innerW / 2
  return PAD.left + (i / (props.data.length - 1)) * innerW
}

function y(value) {
  return baseY - ((Number(value) || 0) / maxValue.value) * innerH
}

const points = computed(() =>
  props.data.map((d, i) => ({ ...d, x: x(i), y: y(d.value) }))
)

const linePath = computed(() =>
  points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
)

const areaPath = computed(() => {
  if (!points.value.length) return ''
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  return `${linePath.value} L${last.x},${baseY} L${first.x},${baseY} Z`
})

// 横轴标签抽稀，月份过多时避免拥挤
const labelStep = computed(() => Math.ceil(points.value.length / 8))
const showLabel = (i) => i % labelStep.value === 0
</script>

<template>
  <svg class="line-chart" :viewBox="`0 0 ${W} ${H}`" role="img">
    <!-- 横向网格线与纵轴刻度 -->
    <g v-for="(t, i) in ticks" :key="i">
      <line
        class="grid-line"
        :x1="PAD.left"
        :x2="W - PAD.right"
        :y1="y(t)"
        :y2="y(t)"
      />
      <text class="tick-label" :x="PAD.left - 8" :y="y(t) + 4" text-anchor="end">
        {{ formatter(t) }}
      </text>
    </g>

    <!-- 面积 + 折线 -->
    <path
      v-if="points.length"
      class="area"
      :d="areaPath"
      :style="{ fill: color || 'var(--primary)' }"
    />
    <path
      v-if="points.length > 1"
      class="line"
      :d="linePath"
      :style="{ stroke: color || 'var(--primary)' }"
    />

    <!-- 数据点（悬停显示数值） -->
    <circle
      v-for="(p, i) in points"
      :key="i"
      class="dot"
      :cx="p.x"
      :cy="p.y"
      r="3.5"
      :style="{ stroke: color || 'var(--primary)' }"
    >
      <title>{{ p.label }} {{ formatter(p.value) }}</title>
    </circle>

    <!-- 横轴月份标签 -->
    <text
      v-for="(p, i) in points"
      v-show="showLabel(i)"
      :key="`l${i}`"
      class="tick-label"
      :x="p.x"
      :y="H - 8"
      text-anchor="middle"
    >
      {{ p.label }}
    </text>
  </svg>
</template>

<style scoped>
.line-chart {
  width: 100%;
  height: auto;
  display: block;
}

.grid-line {
  stroke: var(--border);
  stroke-width: 1;
}

.tick-label {
  font-size: 11px;
  fill: var(--text-muted);
}

.area {
  opacity: 0.1;
}

.line {
  fill: none;
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.dot {
  fill: var(--surface);
  stroke-width: 2;
}
</style>
