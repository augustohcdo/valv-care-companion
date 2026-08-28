/**
 * Superfície corporal e índice de massa corporal.
 *
 * A fórmula é a de **DuBois & DuBois (1916)** — e a escolha não é indiferente.
 * Os limiares de *mismatch* prótese-paciente da EACVI foram derivados com EOA
 * indexada por DuBois; trocar por Mosteller desloca a superfície em alguns
 * centésimos e move um paciente de faixa sem que nada na tela mude. Por isso
 * há **uma** fórmula aqui, e não um seletor.
 */

/** DuBois: 0,007184 × altura(cm)^0,725 × peso(kg)^0,425 → m². */
export function superficieCorporal(alturaCm: number, pesoKg: number): number | null {
  if (!(alturaCm > 0) || !(pesoKg > 0)) return null;
  return 0.007184 * Math.pow(alturaCm, 0.725) * Math.pow(pesoKg, 0.425);
}

/** IMC em kg/m². Entra na conta do *mismatch* porque a faixa muda em IMC ≥ 30. */
export function imc(alturaCm: number, pesoKg: number): number | null {
  if (!(alturaCm > 0) || !(pesoKg > 0)) return null;
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}
