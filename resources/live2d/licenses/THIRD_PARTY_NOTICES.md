# Live2D / Haru

Copyright © Live2D Inc. All rights reserved.

本应用使用了 Live2D Inc. 拥有著作权的示例数据，并依照其规定的使用条件使用。本应用内容由作者自行制作，不代表 Live2D 官方产品。

- Core: Live2D Proprietary Software License, https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html
- Cubism Web Framework: Live2D Open Software License, https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html
- Haru: Free Material License, https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html
- Haru individual sample terms: https://www.live2d.com/eula/live2d-sample-model-terms_en.html

Official SDK: https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.5.zip
Framework d4da0aa07e47d2c1e4f5fa7ea6047861ea5e5d0b; samples ed1e0b714826d92469b9e51cacc3346f4e393f03 (official 5-r.5 tag).

Only the four Sound references were removed from Haru's model manifest. No sound files are included in the application. Model, textures, expressions and motions are otherwise unchanged. Core redistribution list and upstream license notices are retained alongside assets; Framework source retains copyright headers. These materials are not relicensed as MIT or Apache.

License review, 2026-10-22: live website returned maintenance, so the official website's indexed texts were consulted: Core agreement v2.1 (2025-02-03), Open Software agreement v1.4 (2025-02-03), Free Material agreement v1.6, Sample terms v1.7 (2026-01-29). Haru is listed as an original character without additional individual restrictions. This build targets the user's personal local trial; no public publishing is performed. Commercial/organizational publication requires checking the applicable publication license and eligibility conditions separately.

Framework modification: scripts/cubism-framework.patch adds cancellable shader loading and per-context release so hidden/unmounted canvases do not retain resources. Official shader files are otherwise unchanged.
