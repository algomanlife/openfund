import { createContext, useContext } from "react";
import type { Product, Locale } from "./model";
type Context = {
  product: Product;
  locale: Locale;
  context: any;
  refresh: () => void;
  t: (fa: string, en: string) => string;
  message: (key: string) => string;
};
export const TerminalContext = createContext<Context>(null!);
export const useTerminal = () => useContext(TerminalContext);
