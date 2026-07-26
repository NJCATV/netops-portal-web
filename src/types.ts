export type ApiResult<T> = {
  code: number;
  message?: string;
  data: T;
};

export type User = {
  id?: number;
  real_name?: string;
  name?: string;
  account?: string;
  mobile?: string;
  oa_username?: string;
  oss_account?: string;
  oss_bind_status?: string;
  password_status?: string;
  org_name?: string;
  role_code?: string;
};

export type OnuRecord = {
  onu_mac: string;
  display_mac?: string;
  olt_device_id: number;
  olt_name?: string;
  room_group?: string;
  room?: string;
  device_model?: string;
  primary_ip?: string;
  backup_ip?: string;
  uplink_port_norm?: string;
  pon_port?: string;
  if_index?: string;
  rx_power?: number | string | null;
  tx_power?: number | string | null;
  status?: string | number | null;
  query_time?: string;
  quality_bad?: number | boolean;
  quality_code?: string;
  quality_label?: string;
  boss_customer_name?: string;
  boss_address?: string;
  gdf_account?: string;
  boss_region?: string;
  boss_grid?: string;
  rank_label?: string;
};

export type HistoryPoint = {
  sample_time: string;
  rx_power?: number | string | null;
  tx_power?: number | string | null;
  quality_bad?: number | boolean;
  quality_code?: string;
};
