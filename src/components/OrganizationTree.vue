<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Building2, ChevronDown, ChevronRight, Folder, FolderOpen, Plus, Search, Trash2, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-vue-next";

export type OrganizationTreeNode = {
  id: string | number;
  label: string;
  count?: number;
  meta?: unknown;
  children?: OrganizationTreeNode[];
};

const props = withDefaults(defineProps<{
  nodes: OrganizationTreeNode[];
  selectedId?: string | number;
  title?: string;
  subtitle?: string;
  totalLabel?: string;
  editable?: boolean;
  draggable?: boolean;
}>(), { title: "组织结构", subtitle: "按层级选择数据范围", totalLabel: "全部", editable: false, draggable: false });

const emit = defineEmits<{
  select: [node: OrganizationTreeNode | null];
  add: [node: OrganizationTreeNode | null];
  remove: [node: OrganizationTreeNode | null];
  move: [direction: "up" | "down", node: OrganizationTreeNode | null];
  drop: [source: OrganizationTreeNode, target: OrganizationTreeNode];
}>();

const keyword = ref("");
const expanded = ref<Set<string | number>>(new Set());
const selected = computed(() => findNode(props.nodes, props.selectedId));
const draggingId = ref<string | number | null>(null);

function findNode(nodes: OrganizationTreeNode[], id?: string | number): OrganizationTreeNode | null {
  if (id === undefined || id === "") return null;
  for (const node of nodes) {
    if (String(node.id) === String(id)) return node;
    const child = findNode(node.children || [], id);
    if (child) return child;
  }
  return null;
}

function filterTree(nodes: OrganizationTreeNode[], query: string): OrganizationTreeNode[] {
  if (!query) return nodes;
  return nodes.flatMap(node => {
    const children = filterTree(node.children || [], query);
    return node.label.toLowerCase().includes(query) || children.length ? [{ ...node, children }] : [];
  });
}

const visibleNodes = computed(() => filterTree(props.nodes, keyword.value.trim().toLowerCase()));
const flatNodes = computed(() => {
  const rows: Array<{ node: OrganizationTreeNode; depth: number }> = [];
  const visit = (nodes: OrganizationTreeNode[], depth: number) => nodes.forEach(node => {
    rows.push({ node, depth });
    if ((keyword.value || expanded.value.has(node.id)) && node.children?.length) visit(node.children, depth + 1);
  });
  visit(visibleNodes.value, 0);
  return rows;
});
watch(() => props.nodes, nodes => {
  if (!expanded.value.size) expanded.value = new Set(nodes.map(node => node.id));
}, { immediate: true });

function toggle(node: OrganizationTreeNode) {
  const next = new Set(expanded.value);
  next.has(node.id) ? next.delete(node.id) : next.add(node.id);
  expanded.value = next;
}
function handleDrop(target: OrganizationTreeNode) {
  const source = findNode(props.nodes, draggingId.value ?? undefined);
  draggingId.value = null;
  if (source && String(source.id) !== String(target.id)) emit("drop", source, target);
}
</script>

<template>
  <aside class="org-tree-panel card">
    <header class="org-tree-header">
      <div><h2>{{ title }}</h2><p>{{ subtitle }}</p></div>
      <span v-if="totalLabel" class="org-total">{{ totalLabel }}</span>
    </header>
    <div v-if="editable" class="org-tree-tools" aria-label="组织操作">
      <button title="新增下级组织" @click="emit('add', selected)"><Plus :size="16" /></button>
      <button title="删除或停用组织" @click="emit('remove', selected)"><Trash2 :size="16" /></button>
      <button title="上移" @click="emit('move', 'up', selected)"><ArrowUp :size="16" /></button>
      <button title="下移" @click="emit('move', 'down', selected)"><ArrowDown :size="16" /></button>
      <button title="更多操作"><MoreHorizontal :size="16" /></button>
    </div>
    <label class="org-tree-search"><Search :size="15" /><input v-model="keyword" placeholder="搜索组织" /></label>
    <div class="org-tree-scroll">
      <button class="org-tree-all" :class="{ active: selectedId === undefined || selectedId === '' }" @click="emit('select', null)">
        <Building2 :size="16" /><span>全部组织</span><em>{{ totalLabel }}</em>
      </button>
      <ul class="org-tree-list">
        <li v-for="row in flatNodes" :key="row.node.id" class="org-tree-branch">
          <div class="org-tree-row" :class="{ active: String(selectedId ?? '') === String(row.node.id), dragging: String(draggingId ?? '') === String(row.node.id) }" :style="{ paddingLeft: `${8 + row.depth * 18}px` }" :draggable="draggable" @dragstart="draggingId=row.node.id" @dragend="draggingId=null" @dragover.prevent @drop.prevent="handleDrop(row.node)">
            <button class="org-tree-toggle" :disabled="!row.node.children?.length" @click="toggle(row.node)">
              <ChevronDown v-if="row.node.children?.length && expanded.has(row.node.id)" :size="14" />
              <ChevronRight v-else-if="row.node.children?.length" :size="14" />
            </button>
            <FolderOpen v-if="row.node.children?.length && expanded.has(row.node.id)" :size="16" class="org-tree-folder" />
            <Folder v-else :size="16" class="org-tree-folder" />
            <button class="org-tree-name" @click="emit('select', row.node)">{{ row.node.label }}</button>
            <em v-if="row.node.count !== undefined">{{ row.node.count }}</em>
          </div>
        </li>
      </ul>
      <div v-if="!visibleNodes.length" class="org-tree-empty">没有匹配的组织</div>
    </div>
    <slot name="footer" />
  </aside>
</template>
