# Local third-party runtime

This directory keeps the Word World renderer fully offline inside the APK.

- `three-r128.min.js`: Three.js r128 production build.
- `GLTFLoader-r128.js`: matching Three.js r128 glTF loader.
- `LICENSE-three.txt`: upstream MIT license and copyright notice.

Upstream source: https://github.com/mrdoob/three.js/tree/r128

The pinned r128 build is intentional: it retains the older WebGL renderer path
needed by a wider range of Android TV WebView/GPU combinations. Do not replace
it with a current release without testing both WebGL 1 fallback and TCL hardware.
