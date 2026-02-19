export type ShotType = "3PT" | "2PT";

export type Spot = {
  id: string;
  label: string; // "1".."7" o "X" o "TL"
  shotType: ShotType;
  x: number; // 0..1
  y: number; // 0..1
  order: number;
};

// 15 TRIPLES (incluye eje X abajo)
// 1, 2, 3 de cada lado: línea recta vertical
// 4, 5, 6, 7, X: siguiendo la ampliación del arco
export const TRIPLE_SPOTS: Spot[] = [
  // Línea recta izquierda - Spot 1
  { id: "3pt_l1", label: "1", shotType: "3PT", x: 0.10, y: 0.07, order: 1 },
  
  // Línea recta izquierda - Spot 2
  { id: "3pt_l2", label: "2", shotType: "3PT", x: 0.10, y: 0.19, order: 2 },
  
  // Línea recta izquierda - Spot 3
  { id: "3pt_l3", label: "3", shotType: "3PT", x: 0.10, y: 0.31, order: 3 },
  
  // Arco izquierdo - Spot 4
  { id: "3pt_l4", label: "4", shotType: "3PT", x: 0.16, y: 0.38, order: 4 },
  
  // Arco izquierdo - Spot 5
  { id: "3pt_l5", label: "5", shotType: "3PT", x: 0.24, y: 0.44, order: 5 },
  
  // Arco izquierdo - Spot 6
  { id: "3pt_l6", label: "6", shotType: "3PT", x: 0.34, y: 0.50, order: 6 },
  
  // Arco izquierdo - Spot 7
  { id: "3pt_l7", label: "7", shotType: "3PT", x: 0.42, y: 0.55, order: 7 },

  // Centro - Spot X
  { id: "3pt_axis", label: "X", shotType: "3PT", x: 0.50, y: 0.58, order: 8 },

  // Arco derecho - Spot 7
  { id: "3pt_r7", label: "7", shotType: "3PT", x: 0.58, y: 0.55, order: 9 },
  
  // Arco derecho - Spot 6
  { id: "3pt_r6", label: "6", shotType: "3PT", x: 0.66, y: 0.50, order: 10 },
  
  // Arco derecho - Spot 5
  { id: "3pt_r5", label: "5", shotType: "3PT", x: 0.76, y: 0.44, order: 11 },
  
  // Arco derecho - Spot 4
  { id: "3pt_r4", label: "4", shotType: "3PT", x: 0.84, y: 0.38, order: 12 },
  
  // Línea recta derecha - Spot 3
  { id: "3pt_r3", label: "3", shotType: "3PT", x: 0.90, y: 0.31, order: 13 },
  
  // Línea recta derecha - Spot 2
  { id: "3pt_r2", label: "2", shotType: "3PT", x: 0.90, y: 0.19, order: 14 },
  
  // Línea recta derecha - Spot 1
  { id: "3pt_r1", label: "1", shotType: "3PT", x: 0.90, y: 0.07, order: 15 },
];

// 7 DOBLES (reducido: solo 3, 5, 7, TL de ambos lados)
// Distribuidos uniformemente con espaciado uniforme
export const DOBLE_SPOTS: Spot[] = [
  { id: "2pt_l3", label: "3", shotType: "2PT", x: 0.30, y: 0.08, order: 3 },
  { id: "2pt_l5", label: "5", shotType: "2PT", x: 0.37, y: 0.20, order: 5 },
  { id: "2pt_l7", label: "7", shotType: "2PT", x: 0.42, y: 0.30, order: 7 },

  { id: "2pt_ft", label: "TL", shotType: "2PT", x: 0.50, y: 0.38, order: 8 },

  { id: "2pt_r7", label: "7", shotType: "2PT", x: 0.58, y: 0.30, order: 9 },
  { id: "2pt_r5", label: "5", shotType: "2PT", x: 0.63, y: 0.20, order: 11 },
  { id: "2pt_r3", label: "3", shotType: "2PT", x: 0.70, y: 0.08, order: 13 },
];

export const ALL_SPOTS: Spot[] = [...TRIPLE_SPOTS, ...DOBLE_SPOTS];
