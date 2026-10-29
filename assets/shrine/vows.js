/* ============================================================
   vows.js — the cursed spirits and the cut each one demands.

   Control model these numbers come from:
     • the blade is hinged on the world Z axis, normal n = (sin t, cos t, 0)
     • it always passes through the spirit's centre (s = 0)
     • the player draws a line on screen and the blade leans to lie
       along it, so t is continuous over -90…90
     • on a pyramid or cone, a tilt within 7° of vertical snaps onto
       the apex (shrine.js `apexAssist`) — a point is too fine to aim at
     • each vow spawns its solid at `yaw` degrees, which is what makes the
       target reachable at all (the turn the player cannot control)

   `window` = how many of the 37 tilt steps (-90…90 in 5°) produce the
   target at that yaw, measured by dev/check_vows.js.  A narrow window
   means the vow wants a deliberate line (straight down, straight across).
   `tilt` is a known-good answer, used by the dev checker.

   accept[] lists every classifier kind that counts as a hit.
   ============================================================ */
(function (global) {
  "use strict";

  var TRI = ["triangle", "isosceles", "equilateral"];
  var TRAP = ["trapezium", "isoTrapezium"];

  var VOWS = [
    {
      id: "sphere-circle", solid: "sphere", yaw: 0,
      target: "Circle", zh: "圓形", accept: ["circle"], window: 37, tilt: 30,
      rule: "A sphere has no edges, so every cut through it is a circle."
    },
    {
      id: "hexprism-hexagon", solid: "hexPrism", yaw: 30,
      target: "Hexagon", zh: "六邊形", accept: ["hexagon"], window: 35, tilt: 0,
      rule: "Cut a prism parallel to its base and the section is the base itself."
    },
    {
      id: "pyramid-trapezium", solid: "squarePyramid", yaw: 0,
      target: "Trapezium", zh: "梯形", accept: TRAP, window: 32, tilt: 30,
      rule: "Tilt the cut and the square base is trimmed to a trapezium."
    },
    {
      id: "cuboid-rectangle", solid: "cuboid", yaw: 90,
      target: "Rectangle", zh: "長方形", accept: ["rectangle", "square"], window: 37, tilt: 20,
      rule: "Every centre cut of a cuboid gives a rectangle — the box has nothing else to offer."
    },
    {
      id: "cube-rectangle", solid: "cube", yaw: 0,
      target: "Rectangle", zh: "長方形", accept: ["rectangle"], window: 22, tilt: 30,
      rule: "Cut a cube at a slant and the square stretches into a rectangle."
    },
    {
      id: "cuboid-hexagon", solid: "cuboid", yaw: 60,
      target: "Hexagon", zh: "六邊形", accept: ["hexagon"], window: 22, tilt: 50,
      rule: "Slant the blade across a body diagonal and it crosses all six faces."
    },
    {
      id: "cube-hexagon", solid: "cube", yaw: 45,
      target: "Hexagon", zh: "六邊形", accept: ["hexagon"], window: 20, tilt: 50,
      rule: "Straight through the middle on the diagonal: six equal sides, a regular hexagon."
    },
    {
      id: "cube-square", solid: "cube", yaw: 0,
      target: "Square", zh: "正方形", accept: ["square"], window: 15, tilt: 0,
      rule: "Parallel to a face, the section is that face — a square."
    },
    {
      id: "triprism-triangle", solid: "triPrism", yaw: 30,
      target: "Triangle", zh: "三角形", accept: TRI, window: 17, tilt: 30,
      rule: "A slanted cut through a triangular prism still gives a triangle."
    },
    {
      id: "pyramid-triangle", solid: "squarePyramid", yaw: 45,
      target: "Triangle", zh: "三角形", accept: TRI, window: 4, tilt: 90,
      rule: "Cut through the apex and the pyramid's section is a triangle."
    },
    {
      id: "hexprism-rectangle", solid: "hexPrism", yaw: 0,
      target: "Rectangle", zh: "長方形", accept: ["rectangle", "square"], window: 12, tilt: 75,
      rule: "Upright through a prism, the section is a rectangle as tall as the prism."
    },
    {
      id: "cylinder-ellipse", solid: "cylinder", yaw: 0,
      target: "Ellipse", zh: "橢圓形", accept: ["ellipse"], window: 12, tilt: 35,
      rule: "Tilt a cylinder's cut and the circle stretches into an ellipse."
    },
    {
      id: "cylinder-circle", solid: "cylinder", yaw: 0,
      target: "Circle", zh: "圓形", accept: ["circle"], window: 9, tilt: 0,
      rule: "Parallel to the base, every slice of a cylinder is the same circle."
    },
    {
      id: "cone-circle", solid: "cone", yaw: 0,
      target: "Circle", zh: "圓形", accept: ["circle"], window: 9, tilt: 0,
      rule: "Parallel to its base, a cone cuts to a circle — smaller nearer the apex."
    },
    {
      id: "cone-ellipse", solid: "cone", yaw: 0,
      target: "Ellipse", zh: "橢圓形", accept: ["ellipse"], window: 10, tilt: 30,
      rule: "A gentle tilt on a cone gives an ellipse, as long as the cut stays on the curve."
    },
    {
      id: "cylinder-rectangle", solid: "cylinder", yaw: 0,
      target: "Rectangle", zh: "長方形", accept: ["rectangle", "square"], window: 2, tilt: 90,
      rule: "Dead upright through the axis and the curved surface unrolls into a rectangle."
    },
    {
      id: "cone-triangle", solid: "cone", yaw: 0,
      target: "Triangle", zh: "三角形", accept: TRI, window: 4, tilt: 90,
      rule: "Upright through the apex: an isosceles triangle, two slant sides equal."
    }
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = VOWS;
  if (global) global.VOWS = VOWS;
})(typeof window !== "undefined" ? window : this);
