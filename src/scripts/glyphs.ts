/**
 * SVG Path Data for Heavy Grotesque Numerals 0-9 (compressed to 68% width)
 * Normalized to ViewBox 0 0 100 147 (aspect ratio ~0.68)
 */

export interface GlyphData {
  path: string;
  width: number;
  height: number;
  // For digit 6 zoom anchor:
  anchor?: { x: number; y: number; r: number };
}

export const GLYPHS: Record<number, GlyphData> = {
  0: {
    width: 100,
    height: 147,
    // Outer rounded rectangle with thick stroke and inner cutout
    path: `M 50 0 C 80 0 98 22 98 52 L 98 95 C 98 125 80 147 50 147 C 20 147 2 125 2 95 L 2 52 C 2 22 20 0 50 0 Z 
           M 50 32 C 34 32 28 44 28 62 L 28 85 C 28 103 34 115 50 115 C 66 115 72 103 72 85 L 72 62 C 72 44 66 32 50 32 Z`
  },
  1: {
    width: 100,
    height: 147,
    path: `M 35 32 L 8 48 L 8 20 L 42 0 L 70 0 L 70 147 L 35 147 Z`
  },
  2: {
    width: 100,
    height: 147,
    path: `M 4 45 C 4 18 24 0 52 0 C 80 0 96 16 96 42 C 96 68 80 88 56 108 L 26 122 L 98 122 L 98 147 L 2 147 L 2 120 L 48 84 C 64 70 70 58 70 42 C 70 30 62 24 50 24 C 38 24 30 32 28 45 Z`
  },
  3: {
    width: 100,
    height: 147,
    path: `M 4 38 L 28 32 C 32 24 40 22 50 22 C 62 22 70 28 70 38 C 70 48 60 54 46 54 L 30 54 L 30 76 L 48 76 C 64 76 74 82 74 94 C 74 106 64 116 50 116 C 38 116 30 110 26 98 L 2 104 C 8 128 26 147 52 147 C 82 147 98 125 98 96 C 98 78 88 66 74 62 C 86 56 94 44 94 32 C 94 12 76 0 48 0 C 22 0 6 16 4 38 Z`
  },
  4: {
    width: 100,
    height: 147,
    path: `M 62 0 L 0 96 L 0 118 L 60 118 L 60 147 L 88 147 L 88 118 L 100 118 L 100 94 L 88 94 L 88 0 Z 
           M 60 34 L 60 94 L 22 94 Z`
  },
  5: {
    width: 100,
    height: 147,
    path: `M 12 4 L 86 4 L 86 28 L 38 28 L 34 60 C 40 56 48 54 58 54 C 82 54 98 70 98 98 C 98 126 80 147 50 147 C 22 147 6 128 4 104 L 28 98 C 30 110 38 120 50 120 C 62 120 72 110 72 98 C 72 84 62 76 50 76 C 40 76 34 80 28 88 L 8 84 Z`
  },
  6: {
    width: 100,
    height: 147,
    // Glyph 6: thick stroke bowl at bottom-left
    // anchor inside lower-left bowl: x ~ 48, y ~ 102
    anchor: { x: 48, y: 102, r: 24 },
    path: `M 56 0 C 82 0 96 18 96 42 L 72 45 C 70 30 62 24 50 24 C 36 24 28 36 26 56 C 34 46 44 42 56 42 C 82 42 98 62 98 94 C 98 126 80 147 50 147 C 20 147 2 124 2 82 C 2 34 22 0 56 0 Z 
           M 50 66 C 36 66 28 78 28 94 C 28 112 36 124 50 124 C 64 124 72 112 72 94 C 72 78 64 66 50 66 Z`
  },
  7: {
    width: 100,
    height: 147,
    path: `M 4 4 L 96 4 L 96 28 L 44 147 L 14 147 L 66 28 L 4 28 Z`
  },
  8: {
    width: 100,
    height: 147,
    path: `M 50 0 C 74 0 90 14 90 35 C 90 52 78 63 64 68 C 80 74 94 86 94 106 C 94 130 76 147 50 147 C 24 147 6 130 6 106 C 6 86 20 74 36 68 C 22 63 10 52 10 35 C 10 14 26 0 50 0 Z 
           M 50 22 C 38 22 32 30 32 40 C 32 50 40 58 50 58 C 60 58 68 50 68 40 C 68 30 62 22 50 22 Z 
           M 50 78 C 36 78 28 88 28 102 C 28 116 36 125 50 125 C 64 125 72 116 72 102 C 72 88 64 78 50 78 Z`
  },
  9: {
    width: 100,
    height: 147,
    path: `M 44 147 C 18 147 4 129 4 105 L 28 102 C 30 117 38 123 50 123 C 64 123 72 111 74 91 C 66 101 56 105 44 105 C 18 105 2 85 2 53 C 2 21 20 0 50 0 C 80 0 98 23 98 65 C 98 113 78 147 44 147 Z 
           M 50 23 C 36 23 28 35 28 53 C 28 69 36 81 50 81 C 64 81 72 69 72 53 C 72 35 64 23 50 23 Z`
  }
};
