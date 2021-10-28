export type Product = {
  abbr: string;
  code: string;
  kana: string;
  name: string;
  note: string;
  price: number | null;
};

export type Supplier = {
  code: string;
  name: string;
}
