export type PriceGroup = "uluslararasi" | "gram" | "ziynet";

export type PriceItem = {
  code: string;
  name: string;
  subText?: string;
  group: PriceGroup;
  buy: number | null;
  sell: number | null;
  change: number;
  unit?: string;
  featured?: boolean;
};

export type PricesResponse = {
  updatedAt: string;
  online: boolean;
  source: string;
  items: PriceItem[];
};

export type TruncgilRate = {
  Buying: number | null;
  Selling: number | null;
  Type: string;
  Change: number;
};

export type TruncgilResponse = {
  Meta_Data: {
    Minutes_Ago: number;
    Current_Date: string;
    Update_Date: string;
  };
  Rates: Record<string, TruncgilRate>;
};
