/*  IFF 8SVX by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
    https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice
 */

"use strict";

IFF = (function (my) {
  //
  // Init
  //

  //
  // Private
  //
  function parse8SVX(f) {
    var size;
    // read VHDR
    my.findIndex(f, "VHDR");
    if (f.idx > 4) {
      f.vhdr = {};
      my.log("VHDR chunk size: "+ my.readLongU(f));

      f.vhdr.oneShotHiSamples = my.readLongU(f);
      f.vhdr.repeatHiSamples = my.readLongU(f);
      f.vhdr.samplesPerHiCycle = my.readLongU(f);
      f.vhdr.samplesPerSec = my.readWordU(f);
      f.vhdr.ctOctave = my.readByteU(f);
      f.vhdr.sCompression = my.readByteU(f);
      f.vhdr.volume = my.readLongU(f);

      my.log("oneShotHiSamples: "+ f.vhdr.oneShotHiSamples); // unpacked dest size
      my.log("repeatHiSamples: "+ f.vhdr.repeatHiSamples);
      my.log("samplesPerHiCycle: "+ f.vhdr.samplesPerHiCycle);
      my.log("samplesPerSec: "+ f.vhdr.samplesPerSec);
      my.log("ctOctave: "+ f.vhdr.ctOctave);
      my.log("sCompression: "+ f.vhdr.sCompression);
      my.log("volume: "+ f.vhdr.volume); // 0..65536 (not used)

      // 0 = uncompressed
      // 1 = Fibonacci delta (wavepak)
      // 2 = unoff Exponential delta (wavepak)
      // 3 = unoff ADPCM2 (8svx_comp)
      // 4 = unoff ADPCM3 (8svx_comp)
      switch (f.vhdr.sCompression) {
        case 1:
          f.data = unpack_Delta(f.data, "FDC");
          break;
        case 2:
          f.data = unpack_Delta(f.data, "EDC");
          break;
        case 3:
          f.data = unpack_ADPCM(f.data, 2, 0);
          break;
        case 4:
          f.data = unpack_ADPCM(f.data, 3, 0);
          break;
        default:
      }
    }

    // read CHAN
    my.findIndex(f, "CHAN");
    if (f.idx > 4) {
      my.log("CHAN chunk size: "+ my.readLongU(f));
      /*
        2=LEFT, 4=RIGHT, 6=STEREO, 30=QUADRO
        The BODY chunk for stereo
        pairs contains both left and right information. To adhere to existing
        conventions, sampling software should write first the LEFT information,
        followed by the RIGHT. The LEFT and RIGHT information should be equal in
        length.
      */
      f.chan = my.readLongU(f);
      my.log("CHAN: " + f.chan);
    }

    var channels = 1; // added by mrupp to support stereo and quadro files
    switch (f.chan) {
      case 6:
        channels = 2;
        break;
      case 30:
        channels = 4;
        break;
    }
    my.log("channels: " + channels);

    // read PAN
    my.findIndex(f, "PAN ");
    if (f.idx > 4) {
      my.log("PAN chunk size: "+ my.readLongU(f));
      /*
        not further used here but read
        sample has to be played on both channels
        max volume is set in vhdr
        leftChannelVolume = maxVolume - pan
        rightChannelVolume = maxVolume - leftChannelVolume
      */
      f.pan = my.readLongU(f);
    }

    // not used yet
    // read SEQN
    my.findIndex(f, "SEQN");
    if (f.idx > 4) {
      f.seqn = [];
      size = my.readLongU(f);
      my.log("SEQN chunk size: "+ size);
      for (let i = 0; i < size/8; i++) {
        f.seqn.push({start: my.readLongU(f), end: my.readLongU(f)});
      }
    }

    // not used yet
    // read FADE
    my.findIndex(f, "FADE");
    if (f.idx > 4) {
      my.log("FADE chunk size: "+ my.readLongU(f));
      f.fade = my.readLongU(f);
    }

    // https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice#Optional_Data_Chunks_ATAK_and_RLSE
    // not used yet
    // read ATAK
    my.findIndex(f, "ATAK");
    if (f.idx > 4) {
      f.atak = [];
      size = my.readLongU(f);
      my.log("ATAK chunk size: "+ size);
      for (let i = 0; i < size/6; i++) {
        f.atak.push({duration: my.readWordU(f), dest: my.readLongU(f)});
      }
    }

    // read RLSE
    my.findIndex(f, "RLSE");
    if (f.idx > 4) {
      f.rlse = [];
      size = my.readLongU(f);
      my.log("RLSE chunk size: "+ size);
      for (let i = 0; i < size/6; i++) {
        f.rlse.push({duration: my.readWordU(f), dest: my.readLongU(f)});
      }
    }

    play8SVX(f.data, f.vhdr.samplesPerSec, f.id, channels);
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
  function play8SVX(buf, srcRate, id, channels) { // channels: 1, 2 or 4
    var ctx;
    try {
      ctx = new AudioContext({sampleRate: srcRate});
    }
    catch (ex) {
      my.log("Error on init new AudioContext() with samplerate " + srcRate + ": " + ex);
      my.log("Retrying without specifying samplerate and using resample() instead.");
      ctx = new AudioContext();
    }
    var destRate = ctx.sampleRate;
    my.log("srcRate: "+ srcRate);
    my.log("destRate: "+ destRate);
    if (srcRate !== destRate) {
      // Edge for example cannot handle unusual sample rates
      buf = resample(buf, srcRate, destRate);
    }

    id = id || "id"; // ensure it has a value
    channels = channels || 1;
    my.stop8SVX(id);
    var node = ctx.createScriptProcessor(0, 0, channels); // added by mrupp: support for stereo and quadro
    my.audioNodes[id] = node;
    var j = 0;
    var buffer = new Int8Array(buf);
    var offset = channels > 1 ? (buffer.length / channels) : 0;
    if (offset != parseInt(offset)) {
      my.log("Invalid " + channels + " channels file: all channel data need to be of same length!");
      offset = parseInt(offset); // this might just work (or not)
    }
    node.onaudioprocess = function(e) {
      var outs = [];
      for (var c = 0; c < channels; c++) {
        outs[c] = e.outputBuffer.getChannelData(c);
      }
      for (let i = 0; i < outs[0].length; i++) {
        if (j < (buffer.length / channels)) {
          for (var c = 0; c < channels; c++) {
            outs[c][i] = buffer[j + (c * offset)] / 127;
          }
        } else {
          // end of source buffer reached
          for (var c = 0; c < channels; c++) {
            outs[c][i] = 0;
          }
          node.disconnect(0); // added my mrupp: without, node.onaudioprocess() will go on forever
          delete my.audioNodes[id];
          my.log("finished playing with id " + id);
          break;
        }
        j++;
      }
    }
    node.connect(ctx.destination);
    my.log("start playing with id " + id);
  }
  function stop8SVX(id) {
    if (my.audioNodes[id]) {
      my.audioNodes[id].disconnect(0);
      delete my.audioNodes[id];
      my.log("stop playing with id " + id);
    }
  }
  function resample(buf, srcRate, destRate) {
    // i only take care of upsampling and i do not even interpolate
    var ret = [];
    var fac = destRate/srcRate;
    var fac_int = Math.floor(destRate/srcRate);
    var fac_dec = fac - fac_int;
    var dec = 0;
    my.log("wanted fac: "+ fac);

    // loop
    for (let i = 0; i < buf.length; i++) { // loop this before end
      for (let j = 0; j < fac_int; j++) {
        // this takes care of int part of factor
        ret.push(buf[i]);
      }
      dec += fac_dec;
      if (dec >= 1) {
        // decimal part
        ret.push(buf[i]);
        dec -= 1;
      }
    }

    my.log("result fac: "+ ret.length/buf.length);
    return ret;
  }

  //
  // Public
  //
  my.parse8SVX = parse8SVX;
  my.play8SVX = play8SVX;
  my.stop8SVX = stop8SVX; // added my mrupp

  //
  // Exit
  //
  return my;
}(IFF || {}));
