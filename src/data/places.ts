/** Mock Tashkent places on a 0–100 normalized canvas used by the stylized map. */
export type PlaceKind = "university" | "metro" | "mall" | "competitor" | "candidate";

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  y: number;
  rating?: number;
}

export const PLACES: Place[] = [
  { id: "u1", name: "НУУз им. Мирзо Улугбека", kind: "university", x: 68, y: 28 },
  { id: "u2", name: "ТУИТ", kind: "university", x: 44, y: 40 },
  { id: "u3", name: "Вестминстерский университет", kind: "university", x: 38, y: 58 },
  { id: "m1", name: "м. Амира Темура", kind: "metro", x: 50, y: 50 },
  { id: "m2", name: "м. Буюк Ипак Йули", kind: "metro", x: 72, y: 36 },
  { id: "m3", name: "м. Чиланзар", kind: "metro", x: 24, y: 70 },
  { id: "t1", name: "ТЦ Samarqand Darvoza", kind: "mall", x: 30, y: 46 },
  { id: "t2", name: "ТЦ Mega Planet", kind: "mall", x: 58, y: 22 },
  { id: "c1", name: "Coffee Bean", kind: "competitor", x: 64, y: 32, rating: 4.4 },
  { id: "c2", name: "Bon!", kind: "competitor", x: 71, y: 25, rating: 4.6 },
  { id: "c3", name: "Safia", kind: "competitor", x: 47, y: 46, rating: 4.7 },
  { id: "c4", name: "Cafe Paris", kind: "competitor", x: 53, y: 55, rating: 4.2 },
  { id: "c5", name: "Black Bear", kind: "competitor", x: 41, y: 36, rating: 4.5 },
];
