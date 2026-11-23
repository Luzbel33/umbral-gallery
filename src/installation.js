import { t } from "./i18n.js";

export const sizes = { intimate: 0.84, standard: 1, spacious: 1.2 };
export const positions = [
  [-3.1, -8.68, 0, "Fondo izquierdo"],
  [2.4, -8.68, 0, "Fondo derecho"],
  [-7.65, -4.6, Math.PI / 2, "Lateral izquierdo · fondo"],
  [-7.65, 1, Math.PI / 2, "Lateral izquierdo · centro"],
  [-7.65, 5.7, Math.PI / 2, "Lateral izquierdo · entrada"],
  [-3.8, 8.67, Math.PI, "Entrada izquierda"],
  [1, 8.67, Math.PI, "Entrada central"],
  [5.6, 8.67, Math.PI, "Entrada derecha"],
];
export const positionName = (n) => t(positions[n - 1][3]);
export const workLine = (w) => [w.medium, w.year].filter(Boolean).join(" · ");
