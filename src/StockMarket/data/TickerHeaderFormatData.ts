import { StockSymbols } from "./StockSymbols";

export const TickerHeaderFormatData = {
  longestName: 0,
  longestSymbol: 0,
};

for (const key of Object.keys(StockSymbols) as Array<keyof typeof StockSymbols>) {
  TickerHeaderFormatData.longestName = Math.max(key.length, TickerHeaderFormatData.longestName);
  TickerHeaderFormatData.longestSymbol = Math.max(StockSymbols[key].length, TickerHeaderFormatData.longestSymbol);
}
