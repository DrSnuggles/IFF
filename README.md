# IFF
Interchange File Format (IFF), is a generic container file format originally introduced by the Electronic Arts company in 1985 (in cooperation with Commodore) in order to facilitate transfer of data between software produced by different companies.

## Why
I started working on Bloodwych HTML version and maybe i use original data instead of converted data.

I found an ILBM to canvas renderer but nothing similar for 8SVX. There is a 8SVX import in BassoonTracker.

That's why i started this repo. I also included support for official and unofficial 8SVX packers.

## Found repos
There is a general node IFF parser done by Raphael Schweiker. https://github.com/sabberworm/node-iff-parser

This also offers ILBM and SMUS renderers.

## Chunks
See https://wiki.amigaos.net/wiki/IFF_FORM_and_Chunk_Registry

### ILBM
Used for images and animations. Some code is based on Matthias Wiesmann https://github.com/wiesmann/ilbm.js

#### Packers
    - ByteRun1 / PackBits

### 8SVX
For infos see https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice

#### Packers
    - official Fibonacci delta compression (FDC)
    - Exponential delta compression (EDC)
    - ADPCM2
    - ADPCM3

## Copyright / License
Multiple, see single files for information.
