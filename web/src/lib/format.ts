const int = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const fmtInt = (v: number) => int.format(Math.round(v));
export const fmt1 = (v: number) => one.format(v);

export function sumMacros<T extends { calories: number; protein_g: number; carb_g: number; fat_g: number; fiber_g: number; sugar_g: number }>(
  rows: T[]
) {
  return rows.reduce(
    (acc, r) => ({
      calories: acc.calories + num(r.calories),
      protein_g: acc.protein_g + num(r.protein_g),
      carb_g: acc.carb_g + num(r.carb_g),
      fat_g: acc.fat_g + num(r.fat_g),
      fiber_g: acc.fiber_g + num(r.fiber_g),
      sugar_g: acc.sugar_g + num(r.sugar_g),
    }),
    { calories: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 }
  );
}

export const KG_PER_LB = 0.45359237;

export function displayWeight(kg: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? kg / KG_PER_LB : kg;
}
