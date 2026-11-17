/** Mock Tashkent places on a 0–100 × 0–80 normalized canvas used by MapView. */
export type PlaceKind = "university" | "metro" | "mall" | "competitor" | "candidate";

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  y: number;
  rating?: number;
  note?: string;
}

export const PLACES: Place[] = [
  { id: "u1", name: "НУУз им. Мирзо Улугбека", kind: "university", x: 68, y: 28, note: "≈ 20 000 студентов" },
  { id: "u2", name: "ТУИТ", kind: "university", x: 44, y: 40, note: "≈ 12 000 студентов" },
  { id: "u3", name: "Вестминстерский университет", kind: "university", x: 34, y: 62, note: "≈ 5 000 студентов" },
  { id: "m1", name: "м. Амира Темура", kind: "metro", x: 52, y: 52, note: "≈ 38 000 пассажиров/день" },
  { id: "m2", name: "м. Буюк Ипак Йули", kind: "metro", x: 76, y: 38, note: "≈ 22 000 пассажиров/день" },
  { id: "m3", name: "м. Чиланзар", kind: "metro", x: 22, y: 70, note: "≈ 30 000 пассажиров/день" },
  { id: "t1", name: "ТЦ Samarqand Darvoza", kind: "mall", x: 28, y: 46, note: "≈ 25 000 посетителей/день" },
  { id: "t2", name: "ТЦ Mega Planet", kind: "mall", x: 58, y: 18, note: "≈ 18 000 посетителей/день" },
  { id: "t3", name: "ТЦ Next", kind: "mall", x: 60, y: 62, note: "≈ 15 000 посетителей/день" },
  // Competitors (coffee / food)
  { id: "c1", name: "Coffee Bean", kind: "competitor", x: 64, y: 32, rating: 4.4 },
  { id: "c2", name: "Bon!", kind: "competitor", x: 71, y: 25, rating: 4.6 },
  { id: "c3", name: "Safia", kind: "competitor", x: 47, y: 44, rating: 4.7 },
  { id: "c4", name: "Cafe Paris", kind: "competitor", x: 53, y: 56, rating: 4.2 },
  { id: "c5", name: "Black Bear", kind: "competitor", x: 41, y: 37, rating: 4.5 },
  { id: "c6", name: "Chaikof", kind: "competitor", x: 58, y: 30, rating: 4.3 },
  { id: "c7", name: "Tom's Coffee", kind: "competitor", x: 66, y: 38, rating: 4.1 },
  { id: "c8", name: "Kofemaniya", kind: "competitor", x: 60, y: 39, rating: 4.0 },
  { id: "c9", name: "Starbucks-style kiosk", kind: "competitor", x: 57, y: 36, rating: 3.9 },
  { id: "c10", name: "Coffee Lab", kind: "competitor", x: 69, y: 42, rating: 4.5 },
  { id: "c11", name: "Brew Bar", kind: "competitor", x: 55, y: 27, rating: 4.2 },
  { id: "c12", name: "Latte Art", kind: "competitor", x: 72, y: 32, rating: 4.4 },
  { id: "c13", name: "Espresso House", kind: "competitor", x: 49, y: 40, rating: 4.3 },
  { id: "c14", name: "Café Central", kind: "competitor", x: 45, y: 47, rating: 4.6 },
  { id: "c15", name: "Moi Coffee", kind: "competitor", x: 37, y: 60, rating: 4.1 },
  { id: "c16", name: "Coffee Point", kind: "competitor", x: 31, y: 64, rating: 3.8 },
  { id: "c17", name: "Wake Up", kind: "competitor", x: 36, y: 66, rating: 4.0 },
  { id: "c18", name: "Kava", kind: "competitor", x: 50, y: 50, rating: 4.2 },
  { id: "c19", name: "Urban Cup", kind: "competitor", x: 55, y: 54, rating: 4.4 },
  { id: "c20", name: "Doppio", kind: "competitor", x: 78, y: 42, rating: 4.0 },
  { id: "c21", name: "Chilanzar Coffee", kind: "competitor", x: 25, y: 68, rating: 3.9 },
  { id: "c22", name: "Grand Café", kind: "competitor", x: 30, y: 48, rating: 4.3 },
  { id: "c23", name: "Coffee Time", kind: "competitor", x: 43, y: 43, rating: 4.0 },
  { id: "c24", name: "Bean Story", kind: "competitor", x: 46, y: 38, rating: 4.2 },
  { id: "c25", name: "Cup & Book", kind: "competitor", x: 33, y: 59, rating: 4.1 },
  { id: "c26", name: "Arabica", kind: "competitor", x: 38, y: 64, rating: 4.3 },
  { id: "c27", name: "Metro Coffee", kind: "competitor", x: 75, y: 37, rating: 3.9 },
  { id: "c28", name: "Go Coffee", kind: "competitor", x: 72, y: 43, rating: 4.0 },
  { id: "c29", name: "Flat White", kind: "competitor", x: 77, y: 39, rating: 4.4 },
  { id: "c30", name: "Sip", kind: "competitor", x: 50, y: 57, rating: 4.1 },
  { id: "c31", name: "Chilanzar Brew", kind: "competitor", x: 20, y: 67, rating: 3.8 },
  { id: "c32", name: "Kofe Doma", kind: "competitor", x: 25, y: 72, rating: 4.0 },
  { id: "c33", name: "Street Cup", kind: "competitor", x: 21, y: 72, rating: 3.7 },
];

/** Candidate spots the agent evaluates near each anchor type (first = best). */
export const CANDIDATE_SPOTS: Record<"university" | "metro" | "mall", { x: number; y: number; label: string; district: string }[]> = {
  university: [
    { x: 62, y: 34, label: "ул. Университетская, 4", district: "Мирзо-Улугбек" },
    { x: 45, y: 41, label: "ул. Амира Темура, 108", district: "Юнусабад" },
    { x: 34, y: 63, label: "ул. Истикбол, 12", district: "Яккасарай" },
  ],
  metro: [
    { x: 74, y: 40, label: "у м. Буюк Ипак Йули", district: "Мирзо-Улугбек" },
    { x: 52, y: 54, label: "у м. Амира Темура", district: "Юнусабад" },
    { x: 23, y: 69, label: "у м. Чиланзар", district: "Чиланзар" },
  ],
  mall: [
    { x: 29, y: 47, label: "рядом с ТЦ Samarqand Darvoza", district: "Шайхантахур" },
    { x: 58, y: 20, label: "рядом с ТЦ Mega Planet", district: "Юнусабад" },
    { x: 60, y: 60, label: "рядом с ТЦ Next", district: "Яккасарай" },
  ],
};

/** Address search suggestions (mock geocoder). */
export const SEARCH_PLACES: { label: string; x: number; y: number }[] = [
  { label: "Мирзо-Улугбек, ул. Университетская", x: 62, y: 34 },
  { label: "Юнусабад, ул. Амира Темура", x: 47, y: 42 },
  { label: "Чиланзар, 9-й квартал", x: 24, y: 68 },
  { label: "Яккасарай, ул. Шота Руставели", x: 40, y: 64 },
  { label: "Шайхантахур, Чорсу", x: 30, y: 44 },
  { label: "Сергели, ул. Янги Сергели", x: 46, y: 74 },
  { label: "Площадь Амира Темура", x: 52, y: 50 },
  { label: "Tashkent City", x: 44, y: 48 },
];
