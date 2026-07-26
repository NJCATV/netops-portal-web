<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Building2, Network, Plus, ShieldCheck, Users } from "lucide-vue-next";
import OrganizationTree, { type OrganizationTreeNode } from "../components/OrganizationTree.vue";
import StatusTag from "../components/StatusTag.vue";
import { adminApi, api } from "../services/api";
const items=ref<any[]>([]),loading=ref(false),saving=ref(false),error=ref(""),message=ref(""),selectedId=ref<string|number>("");
const formOpen=ref(false),editingId=ref<number|null>(null),form=ref({name:"",parent_id:"",sort_order:0});
function levelLabel(v:number){return ({1:"公司",2:"区域",3:"班组/网格"} as Record<number,string>)[v]||`第 ${v} 级`;}
function statusLabel(v:string){return v==="active"?"正常":"停用";}
const selected=computed(()=>items.value.find(i=>String(i.id)===String(selectedId.value))||null);
const children=computed(()=>items.value.filter(i=>String(i.parent_id||"")===String(selectedId.value||"")));
const tree=computed<OrganizationTreeNode[]>(()=>{const map=new Map<string,any[]>();for(const i of items.value){const k=String(i.parent_id||"");if(!map.has(k))map.set(k,[]);map.get(k)!.push(i);}const build=(p:string):OrganizationTreeNode[]=>(map.get(p)||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(i=>({id:i.id,label:i.name,count:i.user_count,meta:i,children:build(String(i.id))}));return build("");});
async function load(){loading.value=true;error.value="";try{const data=await api<any>("/access/orgs/tree");items.value=data.items||[];if(selectedId.value&&!selected.value)selectedId.value="";if(!selectedId.value&&items.value.length)selectedId.value=items.value[0].id;}catch(e){error.value=e instanceof Error?e.message:"组织加载失败";}finally{loading.value=false;}}
function openCreate(parent:any=null){editingId.value=null;form.value={name:"",parent_id:parent?.id||selected.value?.id||"",sort_order:0};formOpen.value=true;}
function openEdit(row:any=selected.value){if(!row)return;editingId.value=row.id;form.value={name:row.name,parent_id:row.parent_id||"",sort_order:row.sort_order||0};formOpen.value=true;}
async function save(){saving.value=true;error.value="";try{await adminApi(editingId.value?`/orgs/${editingId.value}`:"/orgs",{method:editingId.value?"PUT":"POST",body:JSON.stringify(form.value)});message.value=editingId.value?"组织已更新":"组织已创建";formOpen.value=false;await load();}catch(e){error.value=e instanceof Error?e.message:"组织保存失败";}finally{saving.value=false;}}
async function action(row:any,name:"enable"|"disable"){if(!row)return;try{await adminApi(`/orgs/${row.id}/${name}`,{method:"POST"});message.value=name==="enable"?"组织已启用":"组织已停用";load();}catch(e){error.value=e instanceof Error?e.message:"操作失败";}}
async function removeOrg(node:OrganizationTreeNode|null){const row=(node?.meta as any)||selected.value;if(!row)return;if(!window.confirm(`确认删除“${row.name}”及其全部下级组织？相关用户会被解除组织关联。`))return;try{await adminApi(`/orgs/${row.id}`,{method:"DELETE"});message.value="用户组织已删除";selectedId.value="";load();}catch(e){error.value=e instanceof Error?e.message:"删除失败";}}
async function dropOrg(source:OrganizationTreeNode,target:OrganizationTreeNode){const sourceRow=source.meta as any,targetRow=target.meta as any;if(!sourceRow||!targetRow)return;try{await api(`/user-orgs/${source.id}/move`,{method:"POST",body:JSON.stringify({parent_id:target.id})});message.value=`已将“${sourceRow.name}”移动到“${targetRow.name}”下`;await load();}catch(e){error.value=e instanceof Error?e.message:"组织移动失败";}}
function move(direction:"up"|"down",node:OrganizationTreeNode|null){if(!node)return;const row=items.value.find(i=>String(i.id)===String(node.id));if(!row)return;openEdit(row);form.value.sort_order=Number(row.sort_order||0)+(direction==="up"?-10:10);message.value="已调整排序值，请确认后保存";}
onMounted(load);
</script>
<template><div class="manage-page">
  <section class="manage-hero card card-pad"><div><div class="eyebrow">用户与数据边界</div><h1>用户组织管理</h1><p>维护公司、区域和班组层级；可直接拖拽节点到新的上级组织。</p></div><button class="btn btn-primary" @click="openCreate()"><Plus :size="17"/>新增用户组织</button></section>
  <div v-if="error" class="quality-message error">{{error}}</div><div v-if="message" class="quality-message success">{{message}}</div>
  <div class="split-manage-layout org-admin-layout">
    <OrganizationTree :nodes="tree" :selected-id="selectedId" title="用户组织" subtitle="拖拽节点可调整上级" :total-label="`${items.length} 个`" editable draggable @select="selectedId=$event?.id||''" @add="openCreate(($event as any)?.meta)" @remove="removeOrg" @move="move" @drop="dropOrg" />
    <main class="split-manage-main">
      <section v-if="selected" class="card org-detail-card"><header><div class="org-detail-icon"><Building2 :size="24"/></div><div><span>{{levelLabel(selected.level)}}</span><h2>{{selected.name}}</h2><p>组织 ID {{selected.id}} · 上级 {{items.find(i=>i.id===selected.parent_id)?.name||'无'}}</p></div><StatusTag :value="statusLabel(selected.status)"/></header><div class="org-detail-stats"><div><Network :size="19"/><span>下级组织</span><strong>{{children.length}}</strong></div><div><Users :size="19"/><span>直属用户</span><strong>{{selected.user_count??'-'}}</strong></div><div><ShieldCheck :size="19"/><span>数据范围</span><strong>含下级</strong></div></div><div class="org-detail-actions"><button class="btn btn-primary" @click="openCreate(selected)">新增下级</button><button class="btn btn-secondary" @click="openEdit(selected)">编辑组织</button><button class="btn btn-secondary" @click="action(selected,selected.status==='active'?'disable':'enable')">{{selected.status==='active'?'停用':'启用'}}</button></div></section>
      <section v-else class="card org-welcome"><Building2 :size="36"/><h2>选择一个组织</h2><p>从左侧组织树选择节点，查看其基本信息、下级结构和权限范围。</p></section>
      <section class="card org-policy-card"><div><ShieldCheck :size="21"/><div><h3>权限继承规则</h3><p>系统管理员可访问全平台；组织管理员管理指定组织及其全部下级；普通用户只拥有授权业务功能。</p></div></div></section>
    </main>
  </div>
  <div v-if="formOpen" class="quality-detail-mask" @click.self="formOpen=false"><section class="quality-detail-panel compact-form-panel card"><header class="detail-panel-head"><div><span>{{editingId?'编辑组织':'新增组织'}}</span><h2>{{form.name||'组织信息'}}</h2></div><button class="round-icon-btn" @click="formOpen=false">×</button></header><div class="device-form-grid"><div class="field"><label>组织名称</label><input v-model="form.name" class="input"/></div><div v-if="!editingId" class="field"><label>上级组织</label><select v-model="form.parent_id" class="select"><option value="">顶级组织</option><option v-for="o in items.filter(i=>i.level<3&&i.status==='active')" :key="o.id" :value="o.id">{{o.name}}（{{levelLabel(o.level)}}）</option></select></div><div class="field"><label>排序值</label><input v-model.number="form.sort_order" type="number" class="input"/></div></div><footer class="device-form-actions"><button class="btn btn-secondary" @click="formOpen=false">取消</button><button class="btn btn-primary" :disabled="saving" @click="save">保存组织</button></footer></section></div>
</div></template>
