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
  var debug = false;
  var size;

  //
  // Private
  //
  function setDebug(value) {
    debug = value;
  }
  function log(out) {
    if (debug) console.log("IFF:", out);
    var dbg_DOM = document.getElementById("info");
    if (dbg_DOM) dbg_DOM.innerHTML += out +"<br/>";
  }
  function load(url, canv, id) {
    if (id) {
      log("load with id '" + id + "': " + url);
    }
    else {
      id = url;
      log("no id provided, using url as id: " + url);
    }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function() {
      log("File loaded");
      parseIFF(xhr.response, canv, id);
    }
    xhr.send();
  }
  function parseIFF(buf, canv, id) {
    var f = {}; // form object, should be better group object....
    f.id = id; // added by mrupp: an id is needed to call stop8SVX(id)
    //f.i8 = new Int8Array(buf);
    f.u8 = new Uint8Array(buf);
    f.str = getAsString(f.u8);

    // detect EA IFF 85 group identifier
    var group = f.str.substr(0, 4);
    if (["FORM", "CAT ", "LIST", "PROP"].indexOf(group) === -1) {
      log("This is not an IFF file");
      return false;
    }
    f.idx = 4;
    log(group + " chunk size = "+ readLongU(f));
    if (group !== "FORM") {
      log("Only FORM group is supported");
      return false;
    }

    //
    // BODY Chunk
    //
    findIndex(f, "BODY");
    if (f.idx > 4) {
      f.data = [];
      size = readLongU(f);
      log("BODY chunk size = "+ size);
      for (let i = 0; i < size; i++) {
        if (f.idx+i > f.u8.length) { // it's not correct
          log("unexpected BODY end");
          break;
        }
        f.data.push(f.u8[f.idx+i]);
      }
    }

    //
    // Text Chunks
    //
    processTextChunk(f, "ANNO", "anno");
    processTextChunk(f, "AUTH", "auth");
    processTextChunk(f, "NAME", "name");
    processTextChunk(f, "(c) ", "copy");

    //
    // detect TYPE
    //
    if (f.str.indexOf("8SVX") !== -1) my.parse8SVX(f);
    if (f.str.indexOf("ILBM") !== -1) my.parseILBM(f, canv);
    if (f.str.indexOf("SMUS") !== -1) my.parseSMUS(f);

  }
  function findIndex(f, name) {
    f.idx = f.str.indexOf(name) + 4;
  }
  function readLongU(f) {
    return (f.u8[f.idx++]<<24) + (f.u8[f.idx++]<<16) + (f.u8[f.idx++]<<8) + (f.u8[f.idx++]);
  }
  function readWordU(f) {
    return (f.u8[f.idx++]<<8) + (f.u8[f.idx++]);
  }
  function readByteU(f) {
    return (f.u8[f.idx++]);
  }
  function processTextChunk(f, chkName, name) {
    f.idx = f.str.indexOf(chkName) + 4;
    if (f.idx > 4) {
      f[name] = "";
      var size = readLongU(f);
      for (let i = 0; i < size; i++) {
        f[name] += f.str[f.idx+i];
      }
      my.log(chkName +"="+ f[name]);
    }
  }
  function getAsString(buf) {
    var ret = [];
    //var strLen = Math.min(buf.length, 1024*1024); // not all the buffer
    for (let i = 0; i < buf.length; i++) {
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
  my.findIndex = findIndex;
  my.readLongU = readLongU;
  my.readWordU = readWordU;
  my.readByteU = readByteU;

  my.setDebug = setDebug;
  my.audioNodes = {};

  //
  // Exit
  //
  return my;
}(IFF || {}));
