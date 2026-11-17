export const formatMln = (v: number) =>
  `${v.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн сум`;

export const formatSum = (v: number) => `${v.toLocaleString("ru-RU")} сум`;
