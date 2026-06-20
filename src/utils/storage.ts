const NS = "reagent_lab_v1_";

export const loadLS = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const saveLS = <T>(key: string, value: T) => {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (e) {
    console.warn("saveLS failed", e);
  }
};
