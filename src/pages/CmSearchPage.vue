<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../components/EmptyState.vue";
import StatusTag from "../components/StatusTag.vue";
import { api } from "../services/api";

type CmRecord = { id:number; mac_address:string; display_mac?:string; cm_ip?:string; cmts_device_id:number; cmts_name?:string; primary_ip?:string; region?:string; room_group?:string; room?:string; device_model?:string; uplink_port?:string; downstream_port?:string; if_index?:string; down_if_index?:string; snr?:number; lvl?:number; down_snr?:number; down_lvl?:number; query_time?:string; collect_source?:string; collect_batches?:string; rank_label?:string };
type SearchItem = { keyword:string; time:string };
const route=useRoute();
const keyword=ref(""),loading=ref(false),error=ref(""),items=ref<CmRecord[]>([]),primary=ref<CmRecord|null>(null),expanded=ref("");
const history=ref<SearchItem[]>([]);
const selectedKey=computed(()=>String(primary.value?.id||""));
function fmt(value:unknown){return value===null||value===undefined||value===""?"-":String(value);}
function statusTone(value:unknown){const number=Number(value);return Number.isFinite(number)&&number<25?"warn":"ok";}
function loadLocalHistory(){try{history.value=JSON.parse(localStorage.getItem("netops2026_cm_search_history")||"[]");}catch{history.value=[];}}
function pushHistory(){const value=keyword.value.trim();if(!value)return;history.value=[{keyword:value,time:new Date().toLocaleString("zh-CN",{hour12:false})},...history.value.filter(item=>item.keyword!==value)].slice(0,12);localStorage.setItem("netops2026_cm_search_history",JSON.stringify(history.value));}
async function search(){if(!keyword.value.trim())return;loading.value=true;error.value="";items.value=[];primary.value=null;expanded.value="";try{const data=await api<{items:CmRecord[];primary:CmRecord|null}>(`/cm/search?mac=${encodeURIComponent(keyword.value.trim())}`);items.value=data.items||[];primary.value=data.primary||null;pushHistory();if(!primary.value)error.value="未找到匹配 CM，请检查 MAC 地址。";}catch(err){error.value=err instanceof Error?err.message:"查询失败，请稍后重试。";}finally{loading.value=false;}}
function select(record:CmRecord){primary.value=record;}
async function useHistory(item:SearchItem){keyword.value=item.keyword;await search();}
function clearHistory(){history.value=[];localStorage.removeItem("netops2026_cm_search_history");}
function reset(){keyword.value="";error.value="";items.value=[];primary.value=null;expanded.value="";}
onMounted(()=>{loadLocalHistory();const mac=String(route.query.mac||"");if(mac){keyword.value=mac;search();}});
</script>

<template>
  <div class="onu-workbench cm-workbench">
    <aside class="onu-side">
      <section class="card card-pad onu-search-panel">
        <div class="card-title"><div><h2>查询条件</h2><p>按 CM MAC 地址定位最新在线与信号记录</p></div></div>
        <div class="field"><label>CM MAC 地址</label><div class="input-wrap"><span class="input-icon">⌕</span><input v-model="keyword" class="input mono" placeholder="例如 00:18:C0:28:F4:A8" @keydown.enter="search"/><button v-if="keyword" class="clear-btn" @click="keyword=''">×</button></div></div>
        <div class="filter-query-actions"><button class="btn btn-primary" :disabled="loading" @click="search">{{loading?"查询中":"查询"}}</button><button class="btn btn-secondary" @click="reset">重置</button></div>
      </section>
      <section class="card card-pad onu-history-panel"><div class="card-title"><div><h2>查询历史</h2><p>本机最近查询记录</p></div><button class="text-btn" @click="clearHistory">清空历史</button></div><div v-if="history.length" class="onu-history-list"><button v-for="item in history" :key="item.keyword" @click="useHistory(item)"><strong class="mono">{{item.keyword}}</strong><span>{{item.time}}</span></button></div><EmptyState v-else title="暂无查询历史" description="完成查询后自动保留最近记录"/></section>
    </aside>
    <main class="onu-main">
      <section class="card card-pad onu-result-head"><div class="card-title"><div><h2>CM 查询结果</h2><p v-if="primary"><StatusTag value="已采集" tone="ok"/> 最后采集时间：{{primary.query_time||"-"}}</p><p v-else>支持 MAC 地址精确或前缀查询，展示 CMTS、上下行端口和信号指标。</p></div></div><div v-if="loading" class="notice-card"><div class="loader"></div><div><strong>正在查询 CM</strong><p>正在检索最新 CM 记录。</p></div></div><div v-else-if="error" class="notice-card error"><div class="notice-icon">!</div><div><strong>查询失败或无结果</strong><p>{{error}}</p></div></div><EmptyState v-else-if="!primary" title="请输入 CM MAC 地址" description="输入至少 6 位 MAC 后开始查询"/>
        <div v-else class="onu-hero"><div class="onu-device-icon">CM</div><div><h1 class="mono">{{primary.display_mac||primary.mac_address}}</h1><p>CM 终端 <StatusTag value="已采集" tone="ok"/></p></div><div class="hero-info"><label>所属 CMTS</label><strong>{{fmt(primary.cmts_name)}}</strong><span>{{fmt(primary.primary_ip)}} · ID {{primary.cmts_device_id}}</span></div><div class="hero-info"><label>上行端口</label><strong>{{fmt(primary.uplink_port)}}</strong><span>ifIndex {{fmt(primary.if_index)}}</span></div><div class="hero-info"><label>下行端口</label><strong>{{fmt(primary.downstream_port)}}</strong><span>ifIndex {{fmt(primary.down_if_index)}}</span></div><div class="hero-info"><label>设备位置</label><strong>{{fmt(primary.room_group)}} / {{fmt(primary.room)}}</strong><span>{{fmt(primary.device_model)}}</span></div></div>
      </section>
      <template v-if="primary"><div class="onu-content-grid"><section class="card card-pad"><div class="card-title"><div><h2>信号质量</h2><p>展示最近一次 CMTS 采集的上行、下行信噪比与电平。</p></div></div><div class="cm-metric-grid"><div><label>上行 SNR</label><strong :class="{danger:statusTone(primary.snr)==='warn'}">{{fmt(primary.snr)}} <small>dB</small></strong></div><div><label>上行电平</label><strong>{{fmt(primary.lvl)}} <small>dBmV</small></strong></div><div><label>下行 SNR</label><strong :class="{danger:statusTone(primary.down_snr)==='warn'}">{{fmt(primary.down_snr)}} <small>dB</small></strong></div><div><label>下行电平</label><strong>{{fmt(primary.down_lvl)}} <small>dBmV</small></strong></div></div></section><aside class="onu-metric-column"><section class="card card-pad"><div class="card-title"><div><h2>终端信息</h2><p>最近采集信息</p></div></div><div class="status-list"><p><span>CM IP</span><b>{{fmt(primary.cm_ip)}}</b></p><p><span>采集来源</span><b>{{fmt(primary.collect_source)}}</b></p><p><span>采集批次</span><b>{{fmt(primary.collect_batches)}}</b></p><p><span>采集时间</span><b>{{fmt(primary.query_time)}}</b></p></div></section></aside></div>
      <section class="card table-card"><div class="table-head"><div><h2>匹配记录</h2><p>同一 MAC 可能存在不同 CMTS 或端口的最近记录，点击行切换主记录。</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>CM MAC</th><th>CMTS</th><th>上行 / 下行端口</th><th>上行 SNR / 电平</th><th>下行 SNR / 电平</th><th>采集时间</th></tr></thead><tbody><tr v-for="row in items" :key="row.id" class="selectable-row" :class="{selected:selectedKey===String(row.id)}" @click="select(row)"><td><strong class="mono">{{row.display_mac||row.mac_address}}</strong><div class="muted">{{row.rank_label}}</div></td><td>{{row.cmts_name}}<div class="muted">{{row.primary_ip}} · {{row.device_model}}</div></td><td>{{fmt(row.uplink_port)}}<div class="muted">{{fmt(row.downstream_port)}}</div></td><td>{{fmt(row.snr)}} / {{fmt(row.lvl)}}</td><td>{{fmt(row.down_snr)}} / {{fmt(row.down_lvl)}}</td><td>{{row.query_time}}</td></tr></tbody></table></div></section></template>
    </main>
  </div>
</template>
