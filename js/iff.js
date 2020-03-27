/*  IFF tools by DrSnuggles
    License : Public Domain

    Actually recognized types: 8SVX, ILBM
    https://wiki.amigaos.net/wiki/IFF_FORM_and_Chunk_Registry
 */

"use strict";

var IFF = (function (my) {
  //
  // Init
  //
  var debug = true;

  //
  // Private
  //
  function log(out) {
    if (debug) console.log("IFF:", out);
  }
  function load(url) {
    log("load: "+ url);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function() {
      log("File loaded");
      parseIFF(xhr.response);
    }
    xhr.send();
  }
  function parseIFF(buf) {
    var sbuf8 = new Uint8Array(buf);
    var str = getAsString(sbuf8);
    var idx, size;

    // detect IFF
    if (str.indexOf("FORM") !== 0) {
      log("This is not an IFF file")
      return false;
    }
    idx = 4;

    size = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
    log("FORM size = "+ size);

    // detect BODY
    idx = str.indexOf("BODY") + 4;
    if (idx < 4) {
      log("no BODY chunk found");
      return false;
    }
    size = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
    log("BODY size = "+ size);

    //
    // get BODY Data
    //
    var data = [];
    for (let i = 0; i < size; i++) {
      if (idx+i > sbuf8.length) {
        log("BODY unexpected end");
        break;
      }
      data.push(sbuf8[idx+i]);
    }
    log(data);

    //
    // detect TYPE
    //
    var type = false;
    // 8SVX
    var idx = str.indexOf("8SVX") + 4;
    if (idx > 4) {
      type = "8SVX";
      log(type +" found");
      my.parse8SVX(str, sbuf8, idx, data);
    }

    // ILBM
    idx = str.indexOf("ILBM") + 4;
    if (idx > 4) {
      type = "ILBM";
      log(type +" found");
      my.parseILBM(str, sbuf8, idx, data);
    }

    // unsupported type
    if (!(type)) {
      log("unsupported IFF type");
      return false;
    }

  }
  function getAsString(buf) {
    var ret = [];
    var strLen = Math.min(buf.length, 1024*1024); // not all the buffer
    for (let i = 0; i < strLen; i++) {
      ret.push( String.fromCharCode(buf[i]) );
    }
    return ret.join("");
  }

  //
  // Public
  //
  my.load = load;
  my.parseIFF = parseIFF;
  my.log = log;

  //
  // Exit
  //
  return my;
}(IFF || {}));
