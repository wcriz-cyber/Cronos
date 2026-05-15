export interface Level {
  level: number;
  dropLabel: string;
  price: number;
  baseAmount: number;
  status: 'Comprado' | 'Espera' | 'Gate.io';
}

export interface Slot {
  id: string;
  userId: string;
  pair: string;
  basePrice: number;
  change: string;
  badge: string;
  isDuplicated: boolean;
  mode?: 'Manual' | 'Bot' | 'Pausado';
  status: string;
  levels: Level[];
  operationsCount?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface DCAConfig {
  dropsPercent: number[];
  amounts: number[];
  takeProfit: number;
}

export interface BotConfig {
  scanInterval: number;
  autoReEntry: boolean;
  maxUsdtPerUser: number;
  pauseAll: boolean;
}
