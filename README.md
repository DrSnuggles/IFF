# IFF
Interchange File Format (IFF), is a generic container file format originally introduced by the Electronic Arts company in 1985 (in cooperation with Commodore) in order to facilitate transfer of data between software produced by different companies.

## Why
I started working on Bloodwych HTML version and maybe i use original data instead of converted data.

I found an ILBM to canvas renderer but nothing similar for 8SVX. There is a 8SVX import in BassoonTracker.

That's why i started this repo. I also included support for official and unofficial 8SVX packers.

## Found repos
There is a general node IFF parser done by Raphael Schweiker. https://github.com/sabberworm/node-iff-parser

This also offers ILBM and SMUS renderers.

## IFF
- https://wiki.amigaos.net/wiki/EA_IFF_85_Standard_for_Interchange_Format_Files#Here_is_.E2.80.9CEA_IFF_1985.E2.80.9D

## Chunks
- https://wiki.amigaos.net/wiki/IFF_FORM_and_Chunk_Registry
- https://wiki.multimedia.cx/index.php/IFF

### ILBM
Used for images and animations. Some code is based on Matthias Wiesmann https://github.com/wiesmann/ilbm.js

#### Packers
    - ByteRun1 / PackBits

### 8SVX
For infos see https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice

### 16SV
Thanks to mrupp the creator of https://TAWS.ch there is now also support for stereo and 16SV

### AIFF
- https://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html
- https://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-1.3.pdf
- https://github.com/brianmhunt/float80

### Next steps: AIFF-C
- https://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-C.9.26.91.pdf
- https://github.com/rochars/alawmulaw

#### Packers
    - official Fibonacci delta compression (FDC)
    - Exponential delta compression (EDC)
    - ADPCM2
    - ADPCM3
	- A LAW
	- mu LAW

## Copyright / License
Multiple, see single files for information.
