# World asset licenses

## Gameplay reference: Astray

- Author: wwwtyro
- Official repository: <https://github.com/wwwtyro/Astray>
- License: The Unlicense, <https://github.com/wwwtyro/Astray/blob/master/License.md>
- Use in LexTV: the depth-first maze-generation idea informed the lightweight
  layout generator in `memory-maze.js`. Rendering, remote-control movement,
  enemy behavior, learning state, Canvas loop and all visual assets are original
  LexTV code; no upstream runtime, physics engine or art is redistributed.

## Gameplay reference: ThreeJSEndlessRunner3D

- Author: Juwal Bose
- Official repository: <https://github.com/juwalbose/ThreeJSEndlessRunner3D>
- License: MIT, <https://github.com/juwalbose/ThreeJSEndlessRunner3D/blob/master/LICENSE>
- Use in LexTV: the general three-lane runner, pooled obstacle and scrolling-world
  structure informed `sky-run.js`. The renderer, geometry, fixed-step state
  machine, Android TV controls and all learning integration were rewritten for
  Three.js r128; no upstream art or bundled runtime is redistributed.

## Gameplay reference: Truncate (Echo Heist)

- Author/project: Truncate Game
- Official repository: <https://github.com/TruncateGame/Truncate>
- License: MIT, <https://github.com/TruncateGame/Truncate/blob/main/LICENSE>
- Use in LexTV: the high-level idea that spelling/word decisions can change
  territory and risk informed `rift-heist.js`. The Echo Heist renderer,
  movement, maze generation, gates, particles, story text, word selection and
  learning integration are original LexTV code; no upstream code, art or word
  list is redistributed.

The upstream MIT notice is retained here for provenance:

```text
MIT License

Copyright (c) 2017 Juwal Bose

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## KayKit Medieval Hexagon Pack 1.0

- Creator and distributor: Kay Lousberg, <https://www.kaylousberg.com>
- Official download: <https://kaylousberg.itch.io/kaykit-medieval-hexagon>
- Official GitHub repository: <https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0>
- Audited upstream commit: `84fa4e91af6a88989be7c99e0891cede11f2ca38`
- License: Creative Commons Zero 1.0 Universal (CC0), <https://creativecommons.org/publicdomain/zero/1.0/>
- Upstream license file: repository-root `LICENSE.txt`

The selected files are redistributed unmodified and are also embedded
byte-for-byte in `bundle.js` for file-safe Android WebView loading. Attribution
is not required by CC0, but the creator and original sources are retained here
for provenance.

## Selected files

| Bundled ID | Original upstream file | Triangles | Use in scene |
| --- | --- | ---: | --- |
| `grass-hex` | `tiles/base/hex_grass.gltf` | 36 | Plain satellite island |
| `coast-hex` | `tiles/coast/hex_coast_A.gltf` | 100 | Central and coastal islands |
| `citadel` | `buildings/blue/building_castle_blue.gltf` | 5,659 | Single high-detail central landmark |
| `sky-tower` | `buildings/blue/building_tower_A_blue.gltf` | 2,138 | Northern review landmark |
| `cottage` | `buildings/blue/building_home_A_blue.gltf` | 1,011 | Village satellite |
| `lodge` | `buildings/blue/building_home_B_blue.gltf` | 1,393 | Village satellite |
| `windmill` | `buildings/blue/building_windmill_blue.gltf` | 2,653 | Eastern game landmark |
| `academy-hall` | `buildings/blue/building_church_blue.gltf` | 1,601 | Academy/library-like landmark; semantic alias only |
| `forum-market` | `buildings/blue/building_market_blue.gltf` | 3,125 | Village learning forum |
| `tree-single` | `decoration/nature/tree_single_A.gltf` | 50 | Small island detail |
| `tree-grove` | `decoration/nature/trees_A_medium.gltf` | 480 | Central island foliage |
| `mountain-grove` | `decoration/nature/mountain_A_grass_trees.gltf` | 468 | Northern island backdrop |
| `cloud-small` | `decoration/nature/cloud_small.gltf` | 366 | Near/far parallax cloud |
| `cloud-large` | `decoration/nature/cloud_big.gltf` | 672 | Near/far parallax cloud |

Each model folder contains its original `.gltf`, referenced `.bin`, and the
original `hexagons_medieval.png` atlas. `bundle.js` additionally contains each
original `.gltf` and `.bin` payload plus one shared atlas; the runtime
reconstructs data URIs in memory and never uses `file://` XHR.

## Upstream `LICENSE.txt` (verbatim)

```text
KayKit : Medieval Hexagon Pack (1.0)

Created/distributed by Kay Lousberg (www.kaylousberg.com)
Creation date: 26/04/2024 12:00

------------------------------

License: (Creative Commons Zero, CC0)
http://creativecommons.org/publicdomain/zero/1.0/

This content is free to use in personal, educational and commercial projects.

Support me by crediting Kay Lousberg, www.kaylousberg.com (this is not mandatory)

------------------------------

This asset pack is here thanks to all the wonderful people who support KayKit on Patreon and those who buy EXTRA or SOURCE packs on itch.io.

And a big, special thank you to my Super Supporters on Patreon:

- Brian McBarron
- Silva
- Eric Allamby
- Joseph Preston
- Alexander Würfl
- Danielle Smith
- 7dg2s
- Leon Burkhardt
- PSYLESS
- NickyBHobbying
- Emilia
- Rudolf Bouzek

------------------------------

Patreon:  http://patreon.com/kaylousberg

Follow here for updates:
http://twitter.com/KayLousberg
https://mastodon.gamedev.place/@Kay
```
