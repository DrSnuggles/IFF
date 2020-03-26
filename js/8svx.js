/*  IFF 8SVX by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
 */

"use strict";

IFF = (function (my) {
  //
  // Init
  //

  //
  // Private
  //
  function parse8SVX(str, sbuf8, idx, data) {
    // read VHDR
    if (str.substr(idx, 4) !== "VHDR") {
      my.log("no VHDR chunk found");
    } else {
      idx += 4;
      var size = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      my.log("VHDR chunk size: "+ size);

      var oneShotHiSamples = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var repeatHiSamples = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var samplesPerHiCycle = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var samplesPerSec = (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var ctOctave = (sbuf8[idx++]);
      var sCompression = (sbuf8[idx++]);
      var volume = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);

      my.log("oneShotHiSamples: "+ oneShotHiSamples); // unpacked dest size
      my.log("repeatHiSamples: "+ repeatHiSamples);
      my.log("samplesPerHiCycle: "+ samplesPerHiCycle);
      my.log("samplesPerSec: "+ samplesPerSec);
      my.log("ctOctave: "+ ctOctave);
      my.log("sCompression: "+ sCompression);
      my.log("volume: "+ volume);

      // 0 = uncompressed
      // 1 = Fibonacci delta (wavepak)
      // 2 = unoff Exponential delta (wavepak)
      // 3 = unoff ADPCM2 (8svx_comp)
      // 4 = unoff ADPCM3 (8svx_comp)
      switch (sCompression) {
        case 1:
          data = unpack_Delta(data, "FDC");
          break;
        case 2:
          data = unpack_Delta(data, "EDC");
          break;
        case 3:
          data = unpack_ADPCM(data, 2, 0);
          break;
        case 4:
          data = unpack_ADPCM(data, 3, 0);
          break;
        default:
      }

      play8SVX(data, samplesPerSec);

    }
  }
  function unpack_Delta(buf, typ) {
    // based on https://github.com/svanderburg/lib8svx/blob/master/src/lib8svx/fibdelta.c
    var codeToDelta;
    if (typ === "FDC") {
      // FDC
      codeToDelta = [-34, -21, -13, -8, -5, -3, -2, -1, 0, 1, 2, 3, 5, 8, 13, 21];
    } else {
      // EDC
      codeToDelta = [-128, -64, -32, -16, -8, -4, -2, -1, 0, 1, 2, 4, 8, 16, 32, 64];
    }
    var ret = [];

    /* First byte of compressed data is padding, second is not compressed */
	  ret.push(buf[1]);

    /* Decompress all the other bytes */
  	for(let i = 0; i < (buf.length-2)*2; ++i) {
	    var compressedByte = buf[Math.floor(i / 2) + 2];
      var code;

	    if(i % 2 == 0) {
        code = compressedByte >> 4; /* Take high word for even offsets */
      } else {
        code = compressedByte & 0xf; /* Take low word for odd offsets */
      }
	    ret.push( (ret[i] + codeToDelta[code]) & 0xff );
  	}

    return ret;
  }
  function unpack_ADPCM(buf, bits, joinCode) {
    // based on Tobias (MastaTabs) Seiler (tobi@themaster.de) C version (MT_ADPCM)
    // which is of course based on Christian (FlowerPower) Buchner ASM original

    var length = Math.ceil(buf.length / 3);
  	var estMax = (joinCode & 0xffff);
  	var delta = ((joinCode & 0xffff0000) >> 16);
  	var lDelta = 0;

  	if(!delta) delta = 5;
    var idx = 0;
    var ret = [];

    var matrix = [
      [0x3800, 0x5600, 0, 0, 0, 0, 0, 0],
      [0x399a, 0x3a9f, 0x4d14, 0x6607, 0, 0, 0, 0],
      [0x3556, 0x3556, 0x399A, 0x3A9F, 0x4200, 0x4D14, 0x6607, 0x6607],
    ];

    var bitmask = [0, 0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7f, 0xff];

  	while(length--) {
  		var sampleCount = 24/bits;
  		var temp = (buf[idx++] << 16) | (buf[idx++] << 8) | buf[idx++];

  		while(sampleCount--) {
  			var newEstMax = (delta >> 1);
  			var shifter = (temp >> sampleCount*bits);
  			var b = (shifter & bitmask[bits-1]);

  			if ((bits == 4) && ((shifter & 0xf) == 0))
  				delta = 4;

  			while(b--) {
  				newEstMax += delta;
  			}

  			lDelta = delta * matrix[bits-2][shifter & bitmask[bits-1]];

  			if(shifter & (1<<(bits-1))) {	// SignBit
  				newEstMax = -newEstMax;
  			}
  			estMax = (estMax + newEstMax) & 0xffff;

  			delta = ((lDelta + 8192) >> 14);

  			if(delta < 5) delta = 5;

  			newEstMax = estMax >> 6;
  			if(127 < newEstMax)
  				ret.push(127);
  			else if( -128 > newEstMax) {
  				ret.push(-128);
  			}
  			else
  				ret.push(newEstMax);
  		}
  	}
  	return ret; // joinCode (delta<<16|(estMax&0xffff));
  }
  function play8SVX(buf, srcRate) {
    var ctx = new AudioContext({sampleRate: srcRate});
    var destRate = ctx.sampleRate;
    my.log("srcRate: "+ srcRate + " destRate: "+ destRate);
    if (srcRate !== destRate) {
      // Edge for example cannot handle unusual sample rates
      buf = resample(buf, srcRate, destRate);
    }

    var node = ctx.createScriptProcessor(0, 0, 1);
    var j = 0;
    var buffer = new Int8Array(buf);
    node.onaudioprocess = function(e) {
      var out = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < out.length; i++) {
        if (j < buffer.length) {
          out[i] = buffer[j] / 127;
        } else {
          // end of source buffer reached
          out[i] = 0;
        }
        j++;
      }

    }
    node.connect(ctx.destination);
  }
  function resample(buf, srcRate, destRate) {
    // ToDo: linear, spline
    return buf;
  }

  //
  // Public
  //
  my.parse8SVX = parse8SVX;
  my.play8SVX = play8SVX;

  //
  // Exit
  //
  return my;
}(IFF || {}));
