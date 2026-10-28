/* ============================================================
   levels.js — the 14 cuts of Slice Lab
   Order matters: it walks the class from "flat cuts" to oblique
   cuts, then ends on two cube puzzles.

   accept : every shape name that counts as a win
   ideal  : a known-good aim (used by the "show me" ghost)
   rule   : the sentence a student should leave with
   ============================================================ */
(function (global) {
  "use strict";

  var TRI = ["triangle", "isosceles", "equilateral"];

  var LEVELS = [
    {
      id: 1, solid: "cube", title: "Flat Top",
      target: "Square", accept: ["square"],
      brief: "Cut the cube so the new face is a square.",
      hint: "Keep the blade flat — TILT 0°. Any depth works.",
      rule: "A cut parallel to the base of a prism gives exactly the shape of the base. The cube's base is a square, so the section is a square.",
      ideal: { tilt: 0, turn: 0, depth: 0.1 }
    },
    {
      id: 2, solid: "cylinder", title: "Coin Slice",
      target: "Circle", accept: ["circle"],
      brief: "Cut the cylinder so the new face is a circle.",
      hint: "Flat again — TILT 0°. Try several depths and watch the circle change size.",
      rule: "Every cut parallel to the base of a cylinder is a circle. The section is uniform — same shape at every height.",
      ideal: { tilt: 0, turn: 0, depth: -0.15 }
    },
    {
      id: 3, solid: "triPrism", title: "Three Sides",
      target: "Triangle", accept: TRI,
      brief: "Cut the triangular prism so the new face is a triangle.",
      hint: "Flat, like slicing bread: TILT 0°.",
      rule: "Same rule as the cube, different base. Parallel to the base of a triangular prism, the section is a triangle — congruent to the base.",
      ideal: { tilt: 0, turn: 0, depth: 0.2 }
    },
    {
      id: 4, solid: "sphere", title: "Any Which Way",
      target: "Circle", accept: ["circle"],
      brief: "Cut the sphere so the new face is a circle. Any angle you like.",
      hint: "No hint needed — every single cut of a sphere is a circle.",
      rule: "A sphere has no flat faces and no edges, so a plane can only ever cut it in a circle. Through the centre you get the biggest circle of all.",
      ideal: { tilt: 45, turn: 0, depth: 0 }
    },
    {
      id: 5, solid: "cuboid", title: "Standing Up",
      target: "Rectangle", accept: ["rectangle", "square"],
      brief: "Stand the blade up and cut the cuboid into a rectangle.",
      hint: "Stand the blade up: TILT 90°.",
      rule: "An upright cut through a prism is a rectangle. Its height is the height of the prism — that never changes, however you turn the blade.",
      ideal: { tilt: 90, turn: 0, depth: 0.15 }
    },
    {
      id: 6, solid: "cylinder", title: "Axis Cut",
      target: "Rectangle", accept: ["rectangle", "square"],
      brief: "Cut the cylinder so the new face is a rectangle.",
      hint: "Upright, straight down through the curved side: TILT 90°.",
      rule: "Cut a cylinder parallel to its axis and the curved surface unrolls into a rectangle. The width of the rectangle is a chord of the circle, so the widest one comes from a cut through the centre.",
      ideal: { tilt: 90, turn: 0, depth: 0.1 }
    },
    {
      id: 7, solid: "squarePyramid", title: "Through the Point",
      target: "Triangle", accept: TRI,
      brief: "Cut the square pyramid so the new face is a triangle.",
      hint: "Upright, and exactly through the top point: TILT 90°, DEPTH 0.",
      rule: "A cut through the apex of a pyramid is a triangle. One side of it is a line across the base; the other two run up to the top point.",
      ideal: { tilt: 90, turn: 0, depth: 0 }
    },
    {
      id: 8, solid: "squarePyramid", title: "Off Centre",
      target: "Trapezium", accept: ["trapezium", "isoTrapezium"],
      brief: "Keep the blade upright but miss the top point — make a trapezium.",
      hint: "Upright (TILT 90°) but slide it off-centre so it no longer passes through the apex.",
      rule: "Miss the apex and the triangle is chopped flat at the top — you get a trapezium, with one pair of parallel sides.",
      ideal: { tilt: 90, turn: 0, depth: 0.55 }
    },
    {
      id: 9, solid: "cone", title: "Cone Circle",
      target: "Circle", accept: ["circle"],
      brief: "Cut the cone so the new face is a circle.",
      hint: "Flat: TILT 0°. Slide the depth to change the size.",
      rule: "A cone cut parallel to its base gives a circle — big near the base, tiny near the apex.",
      ideal: { tilt: 0, turn: 0, depth: 0.2 }
    },
    {
      id: 10, solid: "cone", title: "Cone Triangle",
      target: "Triangle", accept: TRI,
      brief: "Cut the cone through its top point to expose a triangle.",
      hint: "Upright through the apex: TILT 90°, DEPTH 0.",
      rule: "A cone cut straight through the apex gives an isosceles triangle — the two slant sides are equal.",
      ideal: { tilt: 90, turn: 0, depth: 0 }
    },
    {
      id: 11, solid: "cylinder", title: "Stretch",
      target: "Ellipse", accept: ["ellipse"],
      brief: "Tilt the blade to stretch the circle into an ellipse.",
      hint: "Tilt the blade to 45°. Any steeper and the cut runs off the flat end.",
      rule: "Tilt the blade and the circle stretches into an ellipse. The more you tilt, the longer it gets — until the cut runs off the end of the cylinder.",
      ideal: { tilt: 45, turn: 0, depth: 0 }
    },
    {
      id: 12, solid: "cone", title: "Slanted Cone",
      target: "Ellipse", accept: ["ellipse"],
      brief: "Tilt the blade on the cone and find an ellipse.",
      hint: "A gentle tilt, about 30° — go further and the cut hits the base.",
      rule: "The same stretch happens on a cone. Keep the cut on the curved surface and it is a true ellipse.",
      ideal: { tilt: 30, turn: 0, depth: 0 }
    },
    {
      id: 13, solid: "cube", title: "Corner Chop",
      target: "Triangle", accept: TRI,
      brief: "Slice one corner off the cube — the new face is a triangle.",
      hint: "TILT 60°, TURN 45°, then slide the blade out towards a corner (DEPTH about 0.6).",
      rule: "A slanted cut near a corner crosses three edges, so the section is a triangle. Slice exactly across the diagonal and it is equilateral.",
      ideal: { tilt: 60, turn: 45, depth: 0.6 }
    },
    {
      id: 14, solid: "cube", title: "Hexagon Boss",
      target: "Hexagon", accept: ["hexagon"],
      brief: "The famous one: cut the cube so the section is a regular hexagon.",
      hint: "TILT 55°, TURN 45°, DEPTH 0 — straight through the middle, square to a body diagonal.",
      rule: "Aim the blade along a body diagonal through the centre and it crosses all six faces. Six equal sides, six equal angles — a regular hexagon.",
      ideal: { tilt: 55, turn: 45, depth: 0 }
    }
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = LEVELS;
  if (global) global.LEVELS = LEVELS;
})(typeof window !== "undefined" ? window : this);
